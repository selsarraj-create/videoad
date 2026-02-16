/**
 * Vertex AI Virtual Try-On (VTO)
 * 
 * Calls the virtual-try-on-001 model to generate Universal Model renders.
 * Stores 4K results in GCS with SynthID watermarking enabled.
 * 
 * Endpoint: POST https://{LOCATION}-aiplatform.googleapis.com/v1/
 *   projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/virtual-try-on-001:predict
 */

export interface VTOResult {
    gcsUris: string[];
    primaryUri: string;
    watermarked: boolean;
}

export class VertexVTO {
    private projectId: string;
    private location: string;
    private vtoBucket: string;
    private universalModelUri: string;
    private _auth: any = null;

    constructor() {
        this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
        this.location = process.env.VERTEX_LOCATION || 'us-central1';
        this.vtoBucket = process.env.GCS_VTO_BUCKET || 'videoad-vto-renders';
        this.universalModelUri = process.env.GCS_UNIVERSAL_MODEL_URI || '';
    }

    /** Lazy auth — only runs at request time, never at build time. */
    private async getAuth() {
        if (this._auth) return this._auth;
        try {
            const { GoogleAuth } = await import('google-auth-library');
            const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
            if (keyJson) {
                const credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString());
                this._auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
            } else {
                this._auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
            }
            return this._auth;
        } catch (error: any) {
            console.error('[VertexVTO] Auth init error:', error.message);
            return null;
        }
    }

    async generateVTO(
        productImageUrl: string,
        personImageUri?: string,
        sampleCount: number = 4
    ): Promise<VTOResult | null> {
        if (!this.projectId) {
            console.log('[VertexVTO] GOOGLE_CLOUD_PROJECT_ID not set, skipping.');
            return null;
        }

        const modelUri = personImageUri || this.universalModelUri;
        if (!modelUri) {
            console.error('[VertexVTO] No universal model URI configured.');
            return null;
        }

        try {
            const auth = await this.getAuth();
            if (!auth) return null;
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/virtual-try-on-001:predict`;

            console.log(`[VertexVTO] Generating VTO: ${sampleCount} samples, SynthID enabled`);

            const personImage = modelUri.startsWith('gs://')
                ? { gcsUri: modelUri }
                : { bytesBase64Encoded: await this.urlToBase64(modelUri) };

            const productImage = productImageUrl.startsWith('gs://')
                ? { gcsUri: productImageUrl }
                : { bytesBase64Encoded: await this.urlToBase64(productImageUrl) };

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instances: [{ personImage, productImages: [productImage] }],
                    parameters: { sampleCount, addWatermark: true },
                }),
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error('[VertexVTO] Predict Error:', resp.status, errText);
                return null;
            }

            const data = await resp.json();
            const predictions = data.predictions || [];
            if (predictions.length === 0) {
                console.warn('[VertexVTO] No predictions returned.');
                return null;
            }

            const gcsUris: string[] = [];
            const timestamp = Date.now();

            for (let i = 0; i < predictions.length; i++) {
                const prediction = predictions[i];
                if (prediction.bytesBase64Encoded) {
                    const gcsPath = `vto-renders/${timestamp}_variant_${i}.png`;
                    const gcsUri = await this.uploadToGCS(prediction.bytesBase64Encoded, gcsPath);
                    if (gcsUri) gcsUris.push(gcsUri);
                } else if (prediction.gcsUri) {
                    gcsUris.push(prediction.gcsUri);
                }
            }

            console.log(`[VertexVTO] Generated ${gcsUris.length} VTO renders`);
            return { gcsUris, primaryUri: gcsUris[0] || '', watermarked: true };
        } catch (error: any) {
            console.error('[VertexVTO] Error:', error.message);
            return null;
        }
    }

    private async uploadToGCS(base64Data: string, objectPath: string): Promise<string | null> {
        try {
            const auth = await this.getAuth();
            if (!auth) return null;
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            const buffer = Buffer.from(base64Data, 'base64');
            const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.vtoBucket}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;

            const resp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken.token}`, 'Content-Type': 'image/png' },
                body: buffer,
            });

            if (!resp.ok) {
                console.error('[VertexVTO] GCS Upload Error:', resp.status);
                return null;
            }

            const gcsUri = `gs://${this.vtoBucket}/${objectPath}`;
            console.log(`[VertexVTO] Uploaded to ${gcsUri}`);
            return gcsUri;
        } catch (error: any) {
            console.error('[VertexVTO] GCS Upload Error:', error.message);
            return null;
        }
    }

    private async urlToBase64(url: string): Promise<string> {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }

    async getPublicUrl(gcsUri: string): Promise<string> {
        const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
        if (!match) return gcsUri;
        const [, bucket, objectPath] = match;
        return `https://storage.googleapis.com/${bucket}/${objectPath}`;
    }
}

export const vertexVTO = new VertexVTO();
