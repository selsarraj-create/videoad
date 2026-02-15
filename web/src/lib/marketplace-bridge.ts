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
        if (!this.ebayClientId || !this.ebayClientSecret) {
            console.log('[Marketplace] eBay credentials missing, skipping auth.');
            return null;
        }
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
            console.log(`[Marketplace] Fetching Skimlinks Offers V4: "${searchTerm}" (Original Q: "${query}", Cat: ${category})`);

            // CORRECT V4 SPEC: 
            // - access_token must be a query parameter
            // - keyword parameter is 'search' (not 'q')
            const resp = await axios.get(`https://merchants.skimapis.com/v4/publisher/${this.skimlinksPublisherId}/offers`, {
                params: {
                    search: searchTerm,
                    limit: 20,
                    access_token: token
                }
            });

            console.log(`[Marketplace] Skimlinks V4 Response: ${resp.data.offers?.length || 0} items found`);
            if (resp.data.offers?.length > 0) {
                console.log('[Marketplace] Sample Skimlinks Offer Schema:', JSON.stringify(resp.data.offers[0]).substring(0, 500));
            }

            return (resp.data.offers || []).map((o: any) => ({
                id: `skim-${o.id}`,
                source: 'skimlinks',
                title: o.offer_name || o.title || 'Designer Piece',
                price: o.price || '0.00',
                currency: o.currency || 'USD',
                // Check multiple possible image fields
                imageUrl: o.image_url || o.image || o.merchant_details?.logo || '',
                affiliateUrl: `${o.offer_url}${o.offer_url?.includes('?') ? '&' : '?'}xcust=${userId}`,
                brand: o.merchant_details?.name || 'Retailer',
                category: category // Pass through filter category
            }));
        } catch (error: any) {
            console.error('[Marketplace] Skimlinks V4 Search Error:', error.response?.status, error.response?.data || error.message);
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
     * getFallbackItems: Premium mock data for empty/failed states
     */
    private getFallbackItems(): UnifiedGarment[] {
        return [
            {
                id: 'fallback-1',
                source: 'skimlinks',
                title: 'Loro Piana - Open Walk Suede Boots',
                price: '950.00',
                currency: 'USD',
                imageUrl: '/placeholders/loropiana-boots.png',
                affiliateUrl: '#',
                brand: 'Loro Piana',
                category: 'Shoes'
            },
            {
                id: 'fallback-2',
                source: 'ebay',
                title: 'Vintage Hermès Birkin 35 - Gold Hardware',
                price: '12500.00',
                currency: 'USD',
                imageUrl: '/placeholders/hermes-birkin.png',
                affiliateUrl: '#',
                brand: 'Hermès',
                category: 'Bags',
                authenticityGuaranteed: true
            },
            {
                id: 'fallback-3',
                source: 'skimlinks',
                title: 'Brunello Cucinelli - Double-Breasted Cashmere Coat',
                price: '4800.00',
                currency: 'USD',
                imageUrl: '/placeholders/cucinelli-coat.png',
                affiliateUrl: '#',
                brand: 'Brunello Cucinelli',
                category: 'Outerwear'
            }
        ];
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

        // If both fail, provide premium fallbacks
        if (combined.length === 0) {
            console.log('[Marketplace] APIs offline/empty. Loading premium fallbacks.');
            combined = this.getFallbackItems();
        }

        if (brand && brand !== 'All') {
            combined = combined.filter(i => i.brand?.toLowerCase() === brand.toLowerCase());
        }

        return combined;
    }
}

export const marketplaceBridge = new MarketplaceBridge();
