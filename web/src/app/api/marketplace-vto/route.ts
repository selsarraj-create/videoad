/**
 * Marketplace VTO API
 * 
 * On-demand Virtual Try-On for marketplace products.
 * Checks asset_library first, generates VTO on cache miss.
 * 
 * POST /api/marketplace-vto
 * Body: { merchant_offer_id, image_url }
 * Returns: { vto_urls: string[] }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { vertexVTO } from '@/lib/vertex-vto';
import { complianceTagger } from '@/lib/compliance-tagger';

export async function POST(request: Request) {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { merchant_offer_id, image_url } = body;

        if (!merchant_offer_id || !image_url) {
            return NextResponse.json(
                { error: 'Missing merchant_offer_id or image_url' },
                { status: 400 }
            );
        }

        // Step 1: Library Lookup (Skip VTO if already rendered)
        const { data: cached } = await supabase
            .from('asset_library')
            .select('universal_vto_url, universal_vto_urls')
            .eq('merchant_offer_id', merchant_offer_id)
            .maybeSingle();

        if (cached?.universal_vto_url) {
            console.log(`[MarketplaceVTO] Cache HIT for ${merchant_offer_id}`);
            return NextResponse.json({
                vto_urls: cached.universal_vto_urls || [cached.universal_vto_url],
                primary_url: cached.universal_vto_url,
                source: 'cache',
            });
        }

        // Step 2: Generate VTO via Vertex AI
        console.log(`[MarketplaceVTO] Cache MISS — generating VTO for ${merchant_offer_id}`);
        const vtoResult = await vertexVTO.generateVTO(image_url);

        if (!vtoResult || vtoResult.gcsUris.length === 0) {
            return NextResponse.json(
                { error: 'VTO generation failed', fallback_image: image_url },
                { status: 422 }
            );
        }

        // Step 3: Compliance tagging
        const compliance = complianceTagger.generateComplianceTags(merchant_offer_id);

        // Step 4: Generate public URLs
        const publicUrls = await Promise.all(
            vtoResult.gcsUris.map(uri => vertexVTO.getPublicUrl(uri))
        );
        const primaryPublicUrl = publicUrls[0];

        // Step 5: Update asset_library with VTO renders
        await supabase
            .from('asset_library')
            .update({
                universal_vto_urls: vtoResult.gcsUris,
                universal_vto_url: vtoResult.primaryUri,
                synthid_applied: compliance.synthidApplied,
                iptc_tagged: compliance.iptcTagged,
            })
            .eq('merchant_offer_id', merchant_offer_id);

        console.log(`[MarketplaceVTO] VTO complete: ${vtoResult.gcsUris.length} renders indexed.`);

        return NextResponse.json({
            vto_urls: publicUrls,
            primary_url: primaryPublicUrl,
            source: 'generated',
            synthid: true,
            iptc: compliance.iptcMetadata,
        });
    } catch (err: any) {
        console.error('[MarketplaceVTO] Error:', err.message);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
