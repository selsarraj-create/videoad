/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  trash-manager.js — Soft Deletion & Restoration for Cloudflare R2
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Assets are never hard-deleted immediately. Instead:
 *    1. softDeleteAsset()  → copies to trash/{originalKey}, deletes original
 *    2. restoreAsset()     → copies from trash/{originalKey} back, deletes trash copy
 *    3. emptyTrashForUser() → batch-deletes all trash for a specific user
 *
 *  Cloudflare R2 Lifecycle Rules auto-purge the trash/ prefix after 24 hours.
 *
 *  Bucket layout:
 *    identity/{userId}/front.jpg          ← live asset
 *    trash/identity/{userId}/front.jpg    ← soft-deleted (auto-expires 24h)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const {
    CopyObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
} = require("@aws-sdk/client-s3");

const { r2, BUCKET } = require("./storage");

const TRASH_PREFIX = "trash/";

// ── Soft Delete ──────────────────────────────────────────────────────────────

/**
 * Move an asset to the trash/ prefix (soft delete).
 *
 * Steps:
 *   1. Verify the source object exists (HEAD)
 *   2. Copy to trash/{originalKey}
 *   3. Delete the original
 *
 * @param {string} originalKey — The R2 key of the asset to soft-delete
 * @returns {Promise<{ trashKey: string, deletedAt: string }>}
 * @throws {Error} "File not found" if the source object doesn't exist
 */
async function softDeleteAsset(originalKey) {
    // 1. Verify the object exists
    try {
        await r2.send(new HeadObjectCommand({
            Bucket: BUCKET,
            Key: originalKey,
        }));
    } catch (err) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
            throw new Error(`File not found: ${originalKey}`);
        }
        throw err;
    }

    const trashKey = `${TRASH_PREFIX}${originalKey}`;

    // 2. Copy to trash
    await r2.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${originalKey}`,
        Key: trashKey,
        MetadataDirective: "COPY",
    }));

    // 3. Delete original
    await r2.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: originalKey,
    }));

    const deletedAt = new Date().toISOString();
    console.log(`  🗑  Soft-deleted: ${originalKey} → ${trashKey}`);

    return { trashKey, deletedAt };
}

// ── Restore ──────────────────────────────────────────────────────────────────

/**
 * Restore a soft-deleted asset from trash back to its original location.
 *
 * Steps:
 *   1. Verify the trash copy exists (HEAD)
 *   2. Copy from trash/{originalKey} back to {originalKey}
 *   3. Delete the trash copy
 *
 * @param {string} originalKey — The original R2 key (without trash/ prefix)
 * @returns {Promise<{ restoredKey: string, restoredAt: string }>}
 * @throws {Error} "File permanently deleted" if the trash copy no longer exists
 */
async function restoreAsset(originalKey) {
    const trashKey = `${TRASH_PREFIX}${originalKey}`;

    // 1. Check if the file still exists in trash
    try {
        await r2.send(new HeadObjectCommand({
            Bucket: BUCKET,
            Key: trashKey,
        }));
    } catch (err) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
            throw new Error(
                `File permanently deleted: ${originalKey} — the 24-hour recovery window has expired.`
            );
        }
        throw err;
    }

    // 2. Copy back to original location
    await r2.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${trashKey}`,
        Key: originalKey,
        MetadataDirective: "COPY",
    }));

    // 3. Delete trash copy
    await r2.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: trashKey,
    }));

    const restoredAt = new Date().toISOString();
    console.log(`  ♻️  Restored: ${trashKey} → ${originalKey}`);

    return { restoredKey: originalKey, restoredAt };
}

// ── Empty Trash for User ─────────────────────────────────────────────────────

/**
 * Permanently delete all trashed assets for a specific user.
 * Useful for "Empty Trash" UI or GDPR data deletion requests.
 *
 * Lists all objects under trash/identity/{userId}/ and batch-deletes them.
 * Handles pagination for users with many trashed assets.
 *
 * @param {string} userId — The user ID whose trash to empty
 * @returns {Promise<{ deleted: number }>}
 */
async function emptyTrashForUser(userId) {
    const prefix = `${TRASH_PREFIX}identity/${userId}/`;
    let totalDeleted = 0;
    let continuationToken = undefined;

    do {
        // List objects in this user's trash
        const listResult = await r2.send(new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            MaxKeys: 1000,
            ContinuationToken: continuationToken,
        }));

        const objects = listResult.Contents || [];
        if (objects.length === 0) break;

        // Batch delete (up to 1000 per request)
        await r2.send(new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
                Objects: objects.map((obj) => ({ Key: obj.Key })),
                Quiet: true,
            },
        }));

        totalDeleted += objects.length;
        continuationToken = listResult.IsTruncated
            ? listResult.NextContinuationToken
            : undefined;

    } while (continuationToken);

    console.log(`  🧹 Emptied trash for user ${userId}: ${totalDeleted} file(s) permanently deleted`);

    return { deleted: totalDeleted };
}

// ── List Trash ───────────────────────────────────────────────────────────────

/**
 * List all trashed assets for a specific user.
 * Returns key, size, and last-modified for each item.
 *
 * @param {string} userId — The user ID
 * @param {number} [limit=100] — Max items to return
 * @returns {Promise<Array<{ key: string, originalKey: string, size: number, lastModified: Date }>>}
 */
async function listTrashForUser(userId, limit = 100) {
    const prefix = `${TRASH_PREFIX}identity/${userId}/`;

    const listResult = await r2.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        MaxKeys: limit,
    }));

    return (listResult.Contents || []).map((obj) => ({
        key: obj.Key,
        originalKey: obj.Key.replace(TRASH_PREFIX, ""),
        size: obj.Size,
        lastModified: obj.LastModified,
    }));
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    softDeleteAsset,
    restoreAsset,
    emptyTrashForUser,
    listTrashForUser,
    TRASH_PREFIX,
};
