/**
 * Google Trends Engine
 * 
 * Identifies high-growth fashion keywords in real-time using google-trends-api.
 * Powers the "Browse Trends" feature with auto-refreshing trend data.
 * 
 * Category 185 = Apparel in Google Trends taxonomy.
 */

// @ts-ignore — google-trends-api has no types
const googleTrends = require('google-trends-api');

export interface TrendingKeyword {
    keyword: string;
    trafficVolume: string;     // e.g. "50K+", "200K+"
    relatedQueries: string[];
    isRising: boolean;
}

export interface TrendFeedItem {
    keyword: string;
    trafficVolume: string;
    products: any[];            // Populated by Oxylabs search
}

// Fashion seed keywords to monitor interest spikes
const FASHION_SEEDS = [
    'streetwear', 'quiet luxury', 'athleisure', 'vintage designer',
    'sustainable fashion', 'capsule wardrobe', 'dopamine dressing',
    'old money aesthetic', 'gorpcore', 'coastal grandmother',
    'mob wife aesthetic', 'ballet core', 'dark academia',
    'minimalist fashion', 'Y2K fashion',
];

export class TrendsEngine {
    private cachedTrends: TrendingKeyword[] = [];
    private lastRefresh: Date | null = null;
    private refreshIntervalMs = 6 * 60 * 60 * 1000; // 6 hours

    /**
     * Get trending fashion keywords. Returns cached data if fresh (< 6 hours old).
     */
    async getTrendingKeywords(forceRefresh = false): Promise<TrendingKeyword[]> {
        if (!forceRefresh && this.cachedTrends.length > 0 && this.lastRefresh) {
            const age = Date.now() - this.lastRefresh.getTime();
            if (age < this.refreshIntervalMs) {
                console.log(`[Trends] Serving cached trends (${Math.round(age / 60000)}min old)`);
                return this.cachedTrends;
            }
        }

        try {
            console.log('[Trends] Refreshing trending fashion keywords...');
            const keywords: TrendingKeyword[] = [];

            // 1. Get daily trends filtered to fashion
            try {
                const dailyRaw = await googleTrends.dailyTrends({
                    geo: 'US',
                    category: 'fashion',
                });
                const dailyData = JSON.parse(dailyRaw);
                const trendDays = dailyData?.default?.trendingSearchesDays || [];

                for (const day of trendDays.slice(0, 2)) {
                    for (const trend of (day.trendingSearches || []).slice(0, 5)) {
                        const title = trend.title?.query || '';
                        if (this.isFashionRelated(title)) {
                            keywords.push({
                                keyword: title,
                                trafficVolume: trend.formattedTraffic || '10K+',
                                relatedQueries: (trend.relatedQueries || [])
                                    .map((q: any) => q.query)
                                    .slice(0, 3),
                                isRising: true,
                            });
                        }
                    }
                }
            } catch (e: any) {
                console.log('[Trends] Daily trends fetch failed:', e.message);
            }

            // 2. Check seed keywords for rising interest
            try {
                const interestRaw = await googleTrends.interestOverTime({
                    keyword: FASHION_SEEDS.slice(0, 5), // API allows max 5 at a time
                    geo: 'US',
                    category: 185, // Apparel
                });
                const interestData = JSON.parse(interestRaw);
                const timeline = interestData?.default?.timelineData || [];

                if (timeline.length > 0) {
                    const latest = timeline[timeline.length - 1];
                    const previous = timeline[Math.max(0, timeline.length - 5)];

                    FASHION_SEEDS.slice(0, 5).forEach((kw, idx) => {
                        const current = latest?.value?.[idx] || 0;
                        const prev = previous?.value?.[idx] || 1;
                        const growth = prev > 0 ? (current - prev) / prev : 0;

                        if (growth > 0.1 || current > 50) { // Rising or popular
                            keywords.push({
                                keyword: kw,
                                trafficVolume: current > 75 ? '100K+' : current > 50 ? '50K+' : '10K+',
                                relatedQueries: [],
                                isRising: growth > 0.2,
                            });
                        }
                    });
                }
            } catch (e: any) {
                console.log('[Trends] Interest over time fetch failed:', e.message);
            }

            // 3. Deduplicate and sort by traffic volume
            const seen = new Set<string>();
            const unique = keywords.filter(k => {
                const key = k.keyword.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            // Sort: rising first, then by traffic estimate
            unique.sort((a, b) => {
                if (a.isRising !== b.isRising) return a.isRising ? -1 : 1;
                return this.parseTraffic(b.trafficVolume) - this.parseTraffic(a.trafficVolume);
            });

            this.cachedTrends = unique.slice(0, 10);
            this.lastRefresh = new Date();

            console.log(`[Trends] ${this.cachedTrends.length} trending keywords identified`);

            // If no trends found from API, use curated fallbacks
            if (this.cachedTrends.length === 0) {
                this.cachedTrends = this.getFallbackTrends();
            }

            return this.cachedTrends;
        } catch (error: any) {
            console.error('[Trends] Error:', error.message);
            return this.cachedTrends.length > 0 ? this.cachedTrends : this.getFallbackTrends();
        }
    }

    /** Check if last refresh was within the interval */
    isCacheFresh(): boolean {
        if (!this.lastRefresh) return false;
        return (Date.now() - this.lastRefresh.getTime()) < this.refreshIntervalMs;
    }

    /** Rough fashion keyword filter */
    private isFashionRelated(query: string): boolean {
        const fashionTerms = [
            'fashion', 'style', 'wear', 'dress', 'shoe', 'bag', 'coat', 'jacket',
            'luxury', 'designer', 'brand', 'collection', 'outfit', 'trend', 'aesthetic',
            'gucci', 'prada', 'chanel', 'nike', 'adidas', 'zara', 'h&m', 'shein',
            'balenciaga', 'loewe', 'dior', 'versace', 'fendi', 'valentino',
            'core', 'fit', 'look', 'drip', 'clothing', 'apparel',
        ];
        const lower = query.toLowerCase();
        return fashionTerms.some(t => lower.includes(t));
    }

    /** Parse traffic volume string to numeric for sorting */
    private parseTraffic(vol: string): number {
        const match = vol.match(/(\d+)/);
        if (!match) return 0;
        const num = parseInt(match[1]);
        if (vol.includes('M')) return num * 1_000_000;
        if (vol.includes('K')) return num * 1_000;
        return num;
    }

    /** Fallback trends if the API is unreachable */
    private getFallbackTrends(): TrendingKeyword[] {
        return [
            { keyword: 'quiet luxury', trafficVolume: '200K+', relatedQueries: ['old money style', 'stealth wealth'], isRising: true },
            { keyword: 'mob wife aesthetic', trafficVolume: '100K+', relatedQueries: ['leopard print', 'fur coat'], isRising: true },
            { keyword: 'gorpcore', trafficVolume: '50K+', relatedQueries: ['arc teryx', 'salomon'], isRising: true },
            { keyword: 'ballet core', trafficVolume: '50K+', relatedQueries: ['ballet flats', 'ribbon'], isRising: true },
            { keyword: 'capsule wardrobe', trafficVolume: '100K+', relatedQueries: ['minimalist', 'essentials'], isRising: false },
            { keyword: 'Y2K fashion', trafficVolume: '200K+', relatedQueries: ['low rise jeans', 'butterfly clips'], isRising: false },
            { keyword: 'dark academia', trafficVolume: '50K+', relatedQueries: ['tweed blazer', 'plaid skirt'], isRising: false },
            { keyword: 'sustainable fashion', trafficVolume: '100K+', relatedQueries: ['thrift', 'vintage'], isRising: false },
        ];
    }
}

export const trendsEngine = new TrendsEngine();
