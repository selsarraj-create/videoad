import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { trendsEngine } from '@/lib/trends-engine';
import { oxylabsIngestor } from '@/lib/oxylabs-ingestor';

/**
 * GET /api/trends
 * 
 * Returns top 10 trending fashion keywords + associated product results.
 * Caches results — serves cached data if last refresh was < 6 hours ago.
 */
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get trending keywords (cached if < 6 hours old)
        const keywords = await trendsEngine.getTrendingKeywords();

        // For each keyword, fetch 4 products from Oxylabs
        const trendFeed = await Promise.all(
            keywords.slice(0, 6).map(async (trend) => {
                try {
                    const products = await oxylabsIngestor.searchTrending(trend.keyword, 4);
                    return {
                        keyword: trend.keyword,
                        trafficVolume: trend.trafficVolume,
                        isRising: trend.isRising,
                        relatedQueries: trend.relatedQueries,
                        products: products.map(p => ({
                            title: p.title,
                            price: p.price,
                            currency: p.currency,
                            imageUrl: p.imageUrl,
                            productUrl: p.productUrl,
                            brand: p.brand,
                            merchant: p.merchant,
                        })),
                    };
                } catch {
                    return {
                        keyword: trend.keyword,
                        trafficVolume: trend.trafficVolume,
                        isRising: trend.isRising,
                        relatedQueries: trend.relatedQueries,
                        products: [],
                    };
                }
            })
        );

        return NextResponse.json({
            trends: trendFeed,
            keywords: keywords.map(k => ({
                keyword: k.keyword,
                trafficVolume: k.trafficVolume,
                isRising: k.isRising,
            })),
            cached: trendsEngine.isCacheFresh(),
        });
    } catch (error: any) {
        console.error('Trends API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
