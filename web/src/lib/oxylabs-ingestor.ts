/**
 * Oxylabs Product Ingestor
 * 
 * Uses Oxylabs Web Scraper API with `google_shopping_search` source
 * for universal product discovery across all merchants.
 * Returns parsed product data with full-size images for VTO pipeline.
 */

export interface OxylabsProduct {
    title: string;
    price: string;
    currency: string;
    imageUrl: string;        // Full-size product image
    thumbnailUrl: string;    // Thumbnail for fast loading
    productUrl: string;      // Raw merchant URL
    brand: string;
    merchant: string;
    position: number;
}

// Internal category → Google Shopping keyword mapping
const CATEGORY_KEYWORDS: Record<string, string> = {
    'Shirts': 'luxury shirts men women designer',
    'Outerwear': 'luxury coats jackets designer outerwear',
    'Dresses': 'designer dresses women luxury',
    'Activewear': 'luxury activewear athleisure designer',
    'Bags': 'luxury handbags designer bags',
    'Shoes': 'luxury shoes designer footwear',
    'Accessories': 'luxury accessories designer jewelry watches',
    'Swimwear': 'luxury swimwear designer',
    'Suits': 'luxury suits designer tailored',
    'Knitwear': 'luxury knitwear cashmere designer',
};

export class OxylabsIngestor {
    private username: string;
    private password: string;
    private endpoint = 'https://realtime.oxylabs.io/v1/queries';

    constructor() {
        this.username = process.env.OXYLABS_USERNAME || '';
        this.password = process.env.OXYLABS_PASSWORD || '';
    }

    /**
     * Search Google Shopping via Oxylabs for products matching a keyword.
     */
    async searchProducts(query: string, limit: number = 20): Promise<OxylabsProduct[]> {
        if (!this.username || !this.password) {
            console.log('[Oxylabs] Credentials not set, skipping.');
            return [];
        }

        try {
            console.log(`[Oxylabs] Searching Google Shopping: "${query}"`);

            const resp = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64'),
                },
                body: JSON.stringify({
                    source: 'google_shopping_search',
                    query,
                    parse: true,
                    geo_location: 'United States',
                    locale: 'en-us',
                    results_language: 'en',
                    pages: 1,
                    context: [
                        { key: 'sort_by', value: 'r' },         // Sort by relevance
                        { key: 'min_price', value: 50 },         // Filter out cheap items
                    ],
                }),
            });

            if (!resp.ok) {
                const errText = await resp.text();
                console.error('[Oxylabs] API Error:', resp.status, errText);
                return [];
            }

            const data = await resp.json();
            const results = data.results?.[0]?.content?.results?.organic || [];

            console.log(`[Oxylabs] Found ${results.length} products for "${query}"`);

            return results.slice(0, limit).map((item: any, idx: number) => ({
                title: item.title || 'Fashion Item',
                price: this.extractPrice(item.price_str || item.price || '0'),
                currency: item.currency || 'USD',
                imageUrl: item.url_image || item.thumbnail || '',
                thumbnailUrl: item.thumbnail || item.url_image || '',
                productUrl: item.url || '',
                brand: this.extractBrand(item.title || '', item.merchant?.name),
                merchant: item.merchant?.name || item.seller || '',
                position: idx + 1,
            })).filter((p: OxylabsProduct) => p.imageUrl && p.productUrl);
        } catch (error: any) {
            console.error('[Oxylabs] Error:', error.message);
            return [];
        }
    }

    /**
     * Search by internal category slug — maps to optimized shopping keywords.
     */
    async searchByCategory(categorySlug: string, limit: number = 20): Promise<OxylabsProduct[]> {
        const keyword = CATEGORY_KEYWORDS[categorySlug] || `luxury ${categorySlug.toLowerCase()}`;
        return this.searchProducts(keyword, limit);
    }

    /**
     * Search for trending keyword — used by the Trends Engine.
     */
    async searchTrending(trendKeyword: string, limit: number = 10): Promise<OxylabsProduct[]> {
        return this.searchProducts(`${trendKeyword} fashion`, limit);
    }

    /**
     * Get all available categories for the Wardrobe Categories menu.
     */
    getCategories(): { slug: string; label: string; icon: string }[] {
        return [
            { slug: 'Shirts', label: 'Shirts', icon: '👔' },
            { slug: 'Outerwear', label: 'Outerwear', icon: '🧥' },
            { slug: 'Dresses', label: 'Dresses', icon: '👗' },
            { slug: 'Activewear', label: 'Activewear', icon: '🏃' },
            { slug: 'Bags', label: 'Bags', icon: '👜' },
            { slug: 'Shoes', label: 'Shoes', icon: '👟' },
            { slug: 'Accessories', label: 'Accessories', icon: '⌚' },
            { slug: 'Swimwear', label: 'Swimwear', icon: '🩱' },
            { slug: 'Suits', label: 'Suits', icon: '🤵' },
            { slug: 'Knitwear', label: 'Knitwear', icon: '🧶' },
        ];
    }

    /** Extract a clean price string from various formats. */
    private extractPrice(raw: string | number): string {
        if (typeof raw === 'number') return raw.toFixed(2);
        const match = String(raw).match(/[\d,]+\.?\d*/);
        return match ? match[0].replace(/,/g, '') : '0.00';
    }

    /** Extract brand from title or merchant name. */
    private extractBrand(title: string, merchant?: string): string {
        // Try to extract brand from title (usually first word or before " - ")
        const dashSplit = title.split(' - ');
        if (dashSplit.length > 1 && dashSplit[0].length < 30) return dashSplit[0].trim();
        const pipeSplit = title.split(' | ');
        if (pipeSplit.length > 1 && pipeSplit[0].length < 30) return pipeSplit[0].trim();
        return merchant || title.split(' ').slice(0, 2).join(' ');
    }
}

export const oxylabsIngestor = new OxylabsIngestor();
