/**
 * Marketplace VTO API — 4-Layer Asset Pipeline
 *
 * Layer 1: DEDUP GUARDRAIL — SHA-256(image_url) → asset_library lookup
 * Layer 2: TRANSIENT SOURCING — image URL passed directly (never stored raw)
 * Layer 3: TRANSFORMATION — Fashn VTO → CDN-hosted output → asset_library upsert
 * Layer 4: COMPLIANCE — IPTC tagging
 *
 * POST /api/marketplace-vto
 * Body: { image_url, product_url?, title?, brand?, price?, currency?,
 *         category?, trend_keyword?, is_trending? }
 * Returns: { vto_urls, primary_url, source: 'cache' | 'generated', product_url_hash }
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { fashnVTO } from '@/lib/fashn-vto';
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
        // If yes → serve immediately. Zero Fashn cost.
        // =============================================================

        const { data: cached } = await (supabase as any)
            .from('asset_library')
            .select('universal_vto_url, universal_vto_urls, product_url_hash')
            .eq('product_url_hash', productUrlHash)
            .maybeSingle();

        if (cached?.universal_vto_url) {
            console.log(`[MarketplaceVTO] DEDUP HIT: ${productUrlHash.slice(0, 12)}… → serving cached render`);

            // Fashn/fal.ai URLs are already public CDN URLs — no conversion needed
            const publicUrls = cached.universal_vto_urls || [cached.universal_vto_url];

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
        // LAYER 3: TRANSFORMATION
        // Fashn VTO generates high-quality try-on renders.
        // Output is hosted on fal.ai CDN — no GCS upload needed.
        // =============================================================

        const vtoResult = await fashnVTO.generateVTO(image_url);

        if (!vtoResult || vtoResult.imageUrls.length === 0) {
            return NextResponse.json(
                { error: 'VTO generation failed', fallback_image: image_url },
                { status: 422 }
            );
        }

        // =============================================================
        // LAYER 4: COMPLIANCE
        // IPTC metadata tagging for AI transparency.
        // =============================================================

        const compliance = complianceTagger.generateComplianceTags(productUrlHash);

        // fal.ai CDN URLs are already public — no URL conversion needed
        const publicUrls = vtoResult.imageUrls;
        const primaryPublicUrl = vtoResult.primaryUrl;

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
            universal_vto_urls: publicUrls,
            universal_vto_url: primaryPublicUrl,
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

        const { error: upsertError } = await (supabase as any)
            .from('asset_library')
            .upsert(assetPayload, { onConflict: 'product_url_hash' });

        if (upsertError) {
            console.error('[MarketplaceVTO] Upsert error:', upsertError.message);
            // Non-fatal — the VTO still succeeded, just couldn't cache it
        } else {
            console.log(`[MarketplaceVTO] Indexed: ${productUrlHash.slice(0, 12)}… (${publicUrls.length} renders)`);
        }

        return NextResponse.json({
            vto_urls: publicUrls,
            primary_url: primaryPublicUrl,
            source: 'generated',
            product_url_hash: productUrlHash,
            iptc: compliance.iptcMetadata,
        });
    } catch (err: any) {
        console.error('[MarketplaceVTO] Error:', err.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
