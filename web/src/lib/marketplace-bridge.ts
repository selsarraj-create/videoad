import axios from 'axios';

export interface UnifiedGarment {
    id: string;
    source: 'skimlinks' | 'ebay';
    title: string;
    price: string;
    currency: string;
    imageUrl: string;
    affiliateUrl: string;
    brand?: string;
    category?: string;
    authenticityGuaranteed?: boolean;
}

export class MarketplaceBridge {
    private skimlinksClientId: string;
    private skimlinksClientSecret: string;
    private skimlinksPublisherId: string;
    private ebayClientId: string;
    private ebayClientSecret: string;
    private skimlinksToken: string | null = null;
    private ebayToken: string | null = null;

    constructor() {
        this.skimlinksClientId = process.env.SKIMLINKS_CLIENT_ID || '';
        this.skimlinksClientSecret = process.env.SKIMLINKS_CLIENT_SECRET || '';
        this.skimlinksPublisherId = process.env.SKIMLINKS_PUBLISHER_ID || '';
        this.ebayClientId = process.env.EBAY_CLIENT_ID || '';
        this.ebayClientSecret = process.env.EBAY_CLIENT_SECRET || '';
    }

    private async getSkimlinksToken(): Promise<string | null> {
        if (this.skimlinksToken) return this.skimlinksToken;
        try {
            // Updated endpoint to fix 405 error
            const resp = await axios.post('https://authentication.skimapis.com/access_token', {
                client_id: this.skimlinksClientId,
                client_secret: this.skimlinksClientSecret,
                grant_type: 'client_credentials'
            });
            this.skimlinksToken = resp.data.access_token;
            return this.skimlinksToken;
        } catch (error) {
            console.error('[Marketplace] Skimlinks Auth Error:', error);
            return null;
        }
    }

    private async getEbayToken(): Promise<string | null> {
        if (this.ebayToken) return this.ebayToken;
        try {
            const auth = Buffer.from(`${this.ebayClientId}:${this.ebayClientSecret}`).toString('base64');
            const resp = await axios.post('https://api.ebay.com/identity/v1/oauth2/token',
                'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            this.ebayToken = resp.data.access_token;
            return this.ebayToken;
        } catch (error) {
            console.error('[Marketplace] eBay Auth Error:', error);
            return null;
        }
    }

    /**
     * Fetch high-end retail from Skimlinks Product Search API
     */
    async fetchSkimlinksItems(query: string, userId: string, category?: string): Promise<UnifiedGarment[]> {
        const token = await this.getSkimlinksToken();
        if (!token) return [];

        // Fallback: If no query, use category or a generic term to avoid empty results
        const searchTerm = query || (category && category !== 'All' ? category : 'luxury');

        try {
            console.log(`[Marketplace] Fetching Skimlinks: "${searchTerm}" (Original Q: "${query}", Cat: ${category})`);
            const resp = await axios.get('https://api.skimlinks.com/v1/products/search', {
                params: {
                    q: searchTerm,
                    category: category !== 'All' ? category : undefined,
                    limit: 20,
                    publisher_id: this.skimlinksPublisherId
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`[Marketplace] Skimlinks Response: ${resp.data.products?.length || 0} items found`);

            return (resp.data.products || []).map((p: any) => ({
                id: `skim-${p.id}`,
                source: 'skimlinks',
                title: p.title,
                price: p.price,
                currency: p.currency || 'USD',
                imageUrl: p.image_url,
                affiliateUrl: `${p.url}${p.url.includes('?') ? '&' : '?'}xcust=${userId}`,
                brand: p.brand,
                category: p.category
            }));
        } catch (error: any) {
            console.error('[Marketplace] Skimlinks Search Error:', error.response?.status, error.response?.data || error.message);
            return [];
        }
    }

    private getEbayCategoryId(category?: string): string | null {
        const mapping: Record<string, string> = {
            'Outerwear': '15724', // Women's Clothing
            'Shirts': '15724',
            'Bags': '169291',
            'Accessories': '4251',
            'Shoes': '3034'
        };
        return category ? mapping[category] || null : null;
    }

    /**
     * Fetch vintage luxury from eBay Browse API
     */
    async fetchEbayItems(query: string, userId: string, category?: string): Promise<UnifiedGarment[]> {
        const token = await this.getEbayToken();
        if (!token) return [];

        // Fallback for eBay as well
        const searchTerm = query || (category && category !== 'All' ? category : 'vintage luxury');

        try {
            console.log(`[Marketplace] Fetching eBay: "${searchTerm}"`);
            const ebayCatId = this.getEbayCategoryId(category);

            const resp = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
                params: {
                    q: searchTerm,
                    limit: 20,
                    filter: ebayCatId ? `categoryIds:{${ebayCatId}}` : undefined,
                },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log(`[Marketplace] eBay Response: ${resp.data.itemSummaries?.length || 0} items found`);

            return (resp.data.itemSummaries || []).map((item: any) => ({
                id: `ebay-${item.itemId}`,
                source: 'ebay',
                title: item.title,
                price: item.price.value,
                currency: item.price.currency,
                imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl,
                affiliateUrl: `${item.itemAffiliateWebUrl || item.itemWebUrl}${item.itemWebUrl.includes('?') ? '&' : '?'}customid=${userId}`,
                brand: item.brand,
                authenticityGuaranteed: item.topRatedListing || false
            }));
        } catch (error: any) {
            console.error('[Marketplace] eBay Search Error:', error.response?.status, error.response?.data || error.message);
            return [];
        }
    }

    /**
     * searchAll: Primary entry point with user-scoped tracking
     */
    async searchAll(query: string, userId: string, category?: string, brand?: string): Promise<UnifiedGarment[]> {
        const [skimlinks, ebay] = await Promise.all([
            this.fetchSkimlinksItems(query, userId, category),
            this.fetchEbayItems(query, userId, category)
        ]);

        let combined = [...skimlinks, ...ebay];

        if (brand && brand !== 'All') {
            combined = combined.filter(i => i.brand?.toLowerCase() === brand.toLowerCase());
        }

        return combined;
    }
}

export const marketplaceBridge = new MarketplaceBridge();
