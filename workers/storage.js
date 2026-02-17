/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  storage.js — Unified Cloudflare R2 Asset Ingestion
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  All platform assets flow through this module.
 *  R2 is S3-compatible, so we use the AWS SDK v3 directly.
 *
 *  Bucket Structure:
 *    identity/{userId}/...           → Private identity photos (multi-angle)
 *    showcase/{videoId}.mp4          → Private generated showcase videos (signed access)
 *    public/assets/...               → Public static assets (logos, thumbnails)
 *
 *  Env vars required:
 *    R2_ACCOUNT_ID                   → Cloudflare account ID
 *    R2_ACCESS_KEY_ID                → R2 API token access key
 *    R2_SECRET_ACCESS_KEY            → R2 API token secret key
 *    R2_BUCKET_NAME                  → Target bucket name
 *    R2_PUBLIC_URL                   → (Optional) Custom domain for public assets
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const axios = require("axios");

// ── R2 Client ────────────────────────────────────────────────────────────────

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET_NAME || "assets";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

// ── Streaming Ingest ─────────────────────────────────────────────────────────

/**
 * Ingest an asset from an external URL directly into R2.
 *
 * Uses axios responseType: 'stream' to pipe bytes straight from the
 * source (Kie.ai, Veo, etc.) into R2 via multipart upload.
 * The full file is NEVER loaded into server RAM.
 *
 * @param {string}  url             — Source URL to fetch from
 * @param {string}  destinationKey  — R2 object key (e.g. "showcase/abc123.mp4")
 * @param {string}  mimeType        — MIME type (e.g. "video/mp4", "image/png")
 * @param {Object}  [metadata={}]   — Optional metadata tags to attach
 * @returns {Promise<{ key: string, size: number, etag: string }>}
 */
async function ingestFromUrl(url, destinationKey, mimeType, metadata = {}) {
    const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        timeout: 300_000, // 5 min — large video downloads
    });

    const upload = new Upload({
        client: r2,
        params: {
            Bucket: BUCKET,
            Key: destinationKey,
            Body: response.data,              // readable stream — never buffered
            ContentType: mimeType,
            Metadata: metadata,
        },
        // Multipart tuning
        queueSize: 4,                         // concurrent part uploads
        partSize: 1024 * 1024 * 10,           // 10 MB parts
        leavePartsOnError: false,             // clean up on failure
    });

    // Optional: progress tracking
    upload.on("httpUploadProgress", (progress) => {
        if (progress.total) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            console.log(`  ↑ ${destinationKey}: ${pct}% (${(progress.loaded / 1_048_576).toFixed(1)} MB)`);
        }
    });

    const result = await upload.done();

    return {
        key: destinationKey,
        size: response.headers["content-length"]
            ? parseInt(response.headers["content-length"], 10)
            : 0,
        etag: result.ETag,
    };
}

// ── Presigned Upload URL ─────────────────────────────────────────────────────

/**
 * Generate a presigned PUT URL for direct browser → R2 uploads.
 * The server never touches the file bytes.
 *
 * Usage:
 *   1. Client calls this to get a signed URL
 *   2. Client PUTs the raw binary blob to the URL
 *   3. Client notifies the server with the final key
 *
 * @param {string}  key          — R2 object key (e.g. "identity/usr_123/front.jpg")
 * @param {string}  contentType  — Expected MIME type (e.g. "image/jpeg")
 * @param {number}  [expiresIn]  — URL validity in seconds (default: 60)
 * @returns {Promise<{ signedUrl: string, key: string }>}
 */
async function getSignedUploadUrl(key, contentType, expiresIn = 60) {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(r2, command, { expiresIn });

    return { signedUrl, key };
}

// ── Presigned View URL ───────────────────────────────────────────────────────

/**
 * Generate a presigned GET URL for secure, time-limited asset viewing.
 * Ideal for private showcase videos and identity photos.
 *
 * @param {string}  key          — R2 object key
 * @param {number}  [expiresIn]  — URL validity in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>}    — Signed URL
 */
async function getSignedViewUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
    });

    return getSignedUrl(r2, command, { expiresIn });
}

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete an asset from R2.
 *
 * @param {string}  key  — R2 object key to delete
 * @returns {Promise<void>}
 */
async function deleteAsset(key) {
    await r2.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key,
    }));

    console.log(`  🗑  Deleted: ${key}`);
}

// ── Public URL Helper ────────────────────────────────────────────────────────

/**
 * Get the public URL for a publicly accessible asset.
 * Requires the object to be in the `public/` prefix with public read access,
 * or a custom domain configured for the bucket.
 *
 * @param {string}  key  — R2 object key (e.g. "public/assets/logo.png")
 * @returns {string}
 */
function getPublicUrl(key) {
    const customDomain = process.env.R2_PUBLIC_URL;
    if (customDomain) {
        return `${customDomain.replace(/\/$/, "")}/${key}`;
    }
    // Fallback: R2 dev URL (not recommended for production)
    return `https://${BUCKET}.${ACCOUNT_ID}.r2.dev/${key}`;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    r2,                     // Raw S3Client for advanced use
    BUCKET,
    ingestFromUrl,
    getSignedUploadUrl,
    getSignedViewUrl,
    deleteAsset,
    getPublicUrl,
};
