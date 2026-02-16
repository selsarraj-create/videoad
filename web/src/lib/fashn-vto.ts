/**
 * Fashn VTO Client — fal.ai REST API
 *
 * Replaces Vertex AI VTO with Fashn tryon/v1.6 (quality mode).
 * Uses fal.ai's queue-based REST API: submit → poll status → fetch result.
 *
 * Output images are hosted on fal.ai CDN — no GCS upload needed.
 */

export interface FashnVTOResult {
    imageUrls: string[];
    primaryUrl: string;
}

const FAL_API_BASE = 'https://queue.fal.run';
const TRYON_ENDPOINT = 'fal-ai/fashn/tryon/v1.6';

export class FashnVTO {
    private apiKey: string;

    constructor() {
        this.apiKey = process.env.FAL_API_KEY || '';
    }

    private getHeaders(): Record<string, string> {
        return {
            'Authorization': `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Generate a virtual try-on using Fashn tryon/v1.6 in quality mode.
     *
     * @param productImageUrl  - The garment image URL
     * @param modelImageUrl    - The mannequin/model image URL (optional, uses default if not set)
     * @returns VTO result with CDN-hosted image URLs, or null on failure
     */
    async generateVTO(
        productImageUrl: string,
        modelImageUrl?: string,
    ): Promise<FashnVTOResult | null> {
        if (!this.apiKey) {
            console.log('[FashnVTO] FAL_API_KEY not set, skipping.');
            return null;
        }

        const mannequinUrl = modelImageUrl || process.env.FASHN_UNIVERSAL_MANNEQUIN_URL;
        if (!mannequinUrl) {
            console.error('[FashnVTO] No mannequin/model URL configured.');
            return null;
        }

        try {
            const input = {
                model_image: mannequinUrl,
                garment_image: productImageUrl,
                category: 'auto',
                mode: 'quality',
                garment_photo_type: 'auto',
                output_format: 'png',
                num_samples: 1,
            };

            console.log('[FashnVTO] Submitting tryon request...');

            // Submit to queue
            const submitResp = await fetch(`${FAL_API_BASE}/${TRYON_ENDPOINT}`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(input),
            });

            if (!submitResp.ok) {
                const errText = await submitResp.text();
                console.error('[FashnVTO] Submit error:', submitResp.status, errText);
                return null;
            }

            const submitData = await submitResp.json();
            const requestId = submitData.request_id;

            // If synchronous response
            if (!requestId && submitData.images) {
                return this.extractResult(submitData);
            }

            if (!requestId) {
                console.error('[FashnVTO] No request_id in response:', submitData);
                return null;
            }

            console.log(`[FashnVTO] Queued: request_id=${requestId}`);

            // Poll for completion
            const statusUrl = `${FAL_API_BASE}/${TRYON_ENDPOINT}/requests/${requestId}/status`;
            const resultUrl = `${FAL_API_BASE}/${TRYON_ENDPOINT}/requests/${requestId}`;
            const maxWait = 300_000; // 5 minutes
            const start = Date.now();

            while (Date.now() - start < maxWait) {
                await new Promise(r => setTimeout(r, 3000));

                const statusResp = await fetch(statusUrl, { headers: this.getHeaders() });
                if (!statusResp.ok) {
                    console.warn(`[FashnVTO] Status poll ${statusResp.status}`);
                    continue;
                }

                const statusData = await statusResp.json();
                const status = statusData.status;

                if (status === 'COMPLETED') {
                    const resultResp = await fetch(resultUrl, { headers: this.getHeaders() });
                    if (!resultResp.ok) {
                        console.error('[FashnVTO] Result fetch error:', resultResp.status);
                        return null;
                    }
                    const result = await resultResp.json();
                    console.log(`[FashnVTO] Completed: request_id=${requestId}`);
                    return this.extractResult(result);
                }

                if (status === 'FAILED' || status === 'ERROR') {
                    console.error('[FashnVTO] Job failed:', statusData.error || 'Unknown');
                    return null;
                }
            }

            console.error(`[FashnVTO] Timed out after ${maxWait / 1000}s`);
            return null;
        } catch (error: any) {
            console.error('[FashnVTO] Error:', error.message);
            return null;
        }
    }

    private extractResult(data: any): FashnVTOResult | null {
        const images = data.images || [];
        if (images.length === 0) {
            console.warn('[FashnVTO] No images in result.');
            return null;
        }

        const imageUrls = images
            .map((img: any) => img.url)
            .filter((url: string) => !!url);

        if (imageUrls.length === 0) {
            console.warn('[FashnVTO] No URLs in images.');
            return null;
        }

        return {
            imageUrls,
            primaryUrl: imageUrls[0],
        };
    }

    /**
     * For cached assets, URLs are already public (fal.ai CDN).
     * This is a no-op compatibility shim replacing vertexVTO.getPublicUrl().
     */
    async getPublicUrl(url: string): Promise<string> {
        return url;
    }
}

export const fashnVTO = new FashnVTO();
