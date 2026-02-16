/**
 * Marketplace VTO API — 4-Layer Asset Pipeline
 *
 * Layer 1: DEDUP GUARDRAIL — SHA-256(image_url) → asset_library lookup
 * Layer 2: TRANSIENT SOURCING — image URL passed directly (never stored raw)
 * Layer 3: TRANSFORMATION — Vertex VTO → GCS upload → asset_library upsert
 * Layer 4: COMPLIANCE — SynthID + IPTC tagging
 *
 * POST /api/marketplace-vto
 * Body: { image_url, product_url?, title?, brand?, price?, currency?,
 *         category?, trend_keyword?, is_trending? }
 * Returns: { vto_urls, primary_url, source: 'cache' | 'generated', product_url_hash }
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { vertexVTO } from '@/lib/vertex-vto';
import { complianceTagger } from '@/lib/compliance-tagger';

/** Compute SHA-256 hash for deterministic dedup. */
function computeUrlHash(url: string): string {
    return createHash('sha256').update(url).digest('hex');
}

export async function POST(request: Request) {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const {
            image_url,
            product_url,
            title,
            brand,
            price,
            currency,
            category,
            trend_keyword,
            is_trending,
        } = body;

        if (!image_url) {
            return NextResponse.json(
                { error: 'Missing image_url' },
                { status: 400 }
            );
        }

        const productUrlHash = computeUrlHash(image_url);

        // =============================================================
        // LAYER 1: DEDUP GUARDRAIL
        // Check if we already have a VTO render for this exact image.
        // If yes → serve immediately. Zero Vertex AI cost.
        // =============================================================

        const { data: cached } = await supabase
            .from('asset_library')
            .select('universal_vto_url, universal_vto_urls, product_url_hash')
            .eq('product_url_hash', productUrlHash)
            .maybeSingle();

        if (cached?.universal_vto_url) {
            console.log(`[MarketplaceVTO] DEDUP HIT: ${productUrlHash.slice(0, 12)}… → serving cached render`);

            const publicUrls = await Promise.all(
                (cached.universal_vto_urls || [cached.universal_vto_url]).map(
                    (uri: string) => vertexVTO.getPublicUrl(uri)
                )
            );

            return NextResponse.json({
                vto_urls: publicUrls,
                primary_url: publicUrls[0],
                source: 'cache',
                product_url_hash: productUrlHash,
            });
        }

        // =============================================================
        // LAYER 2: TRANSIENT SOURCING
        // The raw image URL is passed directly to VTO.
        // It is NEVER stored in asset_library or any persistent storage.
        // =============================================================

        console.log(`[MarketplaceVTO] DEDUP MISS: ${productUrlHash.slice(0, 12)}… — generating VTO`);

        // =============================================================
        // LAYER 3: TRANSFORMATION (Asset Laundering)
        // Vertex VTO generates identity-locked 4K renders.
        // Output is saved to GCS (videoad-vto-renders) — permanent storage.
        // =============================================================

        const vtoResult = await vertexVTO.generateVTO(image_url);

        if (!vtoResult || vtoResult.gcsUris.length === 0) {
            return NextResponse.json(
                { error: 'VTO generation failed', fallback_image: image_url },
                { status: 422 }
            );
        }

        // =============================================================
        // LAYER 4: COMPLIANCE
        // SynthID watermark (applied during generation) + IPTC metadata.
        // =============================================================

        const compliance = complianceTagger.generateComplianceTags(productUrlHash);

        // Generate public URLs for frontend
        const publicUrls = await Promise.all(
            vtoResult.gcsUris.map(uri => vertexVTO.getPublicUrl(uri))
        );
        const primaryPublicUrl = publicUrls[0];

        // =============================================================
        // INDEX: Upsert into asset_library for future dedup hits.
        // This is the ONLY point where data enters asset_library.
        // Raw Oxylabs images are never persisted — only AI-generated outputs.
        // =============================================================

        const assetPayload = {
            product_url_hash: productUrlHash,
            merchant_offer_id: productUrlHash.slice(0, 32),
            title: title || 'Marketplace Product',
            brand: brand || null,
            price: price || null,
            currency: currency || 'USD',
            category: category || null,
            category_id: category?.toLowerCase() || null,
            original_image_url: image_url,   // kept for reference only
            merchant_link: product_url || null,
            universal_vto_urls: vtoResult.gcsUris,
            universal_vto_url: vtoResult.primaryUri,
            synthid_applied: compliance.synthidApplied,
            iptc_tagged: compliance.iptcTagged,
            is_trending: is_trending || false,
            trend_keyword: trend_keyword || null,
            last_trend_refresh: is_trending ? new Date().toISOString() : null,
            tags: [
                brand?.toLowerCase(),
                category?.toLowerCase(),
                trend_keyword?.toLowerCase(),
                ...((title || '').toLowerCase().split(/\s+/).slice(0, 5)),
            ].filter(Boolean),
        };

        const { error: upsertError } = await supabase
            .from('asset_library')
            .upsert(assetPayload, { onConflict: 'product_url_hash' });

        if (upsertError) {
            console.error('[MarketplaceVTO] Upsert error:', upsertError.message);
            // Non-fatal — the VTO still succeeded, just couldn't cache it
        } else {
            console.log(`[MarketplaceVTO] Indexed: ${productUrlHash.slice(0, 12)}… (${vtoResult.gcsUris.length} renders)`);
        }

        return NextResponse.json({
            vto_urls: publicUrls,
            primary_url: primaryPublicUrl,
            source: 'generated',
            product_url_hash: productUrlHash,
            synthid: true,
            iptc: compliance.iptcMetadata,
        });
    } catch (err: any) {
        console.error('[MarketplaceVTO] Error:', err.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
