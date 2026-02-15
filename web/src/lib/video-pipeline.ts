import { createClient } from './supabase/client';

export interface StitchResult {
    success: boolean;
    url: string;
    duration_ms: number;
    compute_savings: string;
}

/**
 * Orchnestration for the video pipeline ingredients.
 * Calls the local Railway stitcher service to build 4K collages.
 */
export async function stitchMasterIngredients(imageUrls: string[]): Promise<string> {
    console.log(`[VideoPipeline] Stitching ${imageUrls.length} ingredients via Sharp...`);

    // Note: This matches the worker internal STITCHER_PORT
    const STITCHER_URL = process.env.RAILWAY_WORKER_URL
        ? `${process.env.RAILWAY_WORKER_URL.replace(':8000', ':8081')}/api/stitch-collage`
        : 'http://localhost:8081/api/stitch-collage';

    try {
        const response = await fetch(STITCHER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_urls: imageUrls,
                layout: 'horizontal'
            })
        });

        if (!response.ok) {
            throw new Error(`Stitcher service returned ${response.status}`);
        }

        const result: StitchResult = await response.json();
        console.log(`[VideoPipeline] Success! Saved ${result.compute_savings}. URL: ${result.url}`);

        return result.url;
    } catch (error) {
        console.error('[VideoPipeline] Stitching failed, falling back to original images:', error);
        // Fallback logic: if stitching fails, return the first image as a best-effort ingredient
        return imageUrls[0];
    }
}
