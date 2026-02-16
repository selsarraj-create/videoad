/**
 * MarketplaceBridge v3 — Oxylabs + Google Trends Pipeline
 * 
 * Architecture:
 * 1. Library Lookup: Check asset_library for cached VTO renders
 * 2. Oxylabs Google Shopping: Universal product search across all merchants
 * 3. Vertex AI VTO: Generate Universal Model try-on renders (on-demand)
 * 4. SynthID + IPTC: Compliance watermarking
 * 5. Skimlinks Link API: Wrap merchant URLs at click time only
 * 6. eBay Browse API: Secondary source
 * 7. Premium Fallbacks: Staff Pick items when all APIs are offline
 */

import axios from 'axios';
import { oxylabsIngestor, OxylabsProduct } from './oxylabs-ingestor';
import { vertexVTO } from './vertex-vto';
import { complianceTagger } from './compliance-tagger';

export interface UnifiedGarment {
    id: string;
    source: 'oxylabs' | 'ebay' | 'library' | 'trending';
    title: string;
    price: string;
    currency: string;
    imageUrl: string;            // Product image OR VTO render
    originalImageUrl?: string;   // Raw product image
    vtoImageUrl?: string;        // VTO render (if generated)
    affiliateUrl: string;        // Skimlinks-wrapped at serve time
    merchantLink?: string;       // Raw merchant URL
    brand?: string;
    category?: string;
    merchant?: string;
    merchantOfferId?: string;
    authenticityGuaranteed?: boolean;
    synthidApplied?: boolean;
    isTrending?: boolean;
    trendKeyword?: string;
}

export class MarketplaceBridge {
    private skimlinksPublisherId: string;
    private ebayClientId: string;
    private ebayClientSecret: string;
    private ebayToken: string | null = null;
    private supabaseUrl: string;
    private supabaseKey: string;

    constructor() {
        this.skimlinksPublisherId = process.env.SKIMLINKS_PUBLISHER_ID || '';
        this.ebayClientId = process.env.EBAY_CLIENT_ID || '';
        this.ebayClientSecret = process.env.EBAY_CLIENT_SECRET || '';
        this.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        this.supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    }

    // ============================================================
    // 1. LIBRARY LOOKUP (The Cost-Saver)
    // ============================================================

    private async libraryLookup(query: string, category?: string): Promise<UnifiedGarment[]> {
        if (!this.supabaseUrl || !this.supabaseKey) return [];

        try {
            const tags = [query.toLowerCase()];
            if (category && category !== 'All') tags.push(category.toLowerCase());

            const searchParam = encodeURIComponent(query);
            const resp = await fetch(
                `${this.supabaseUrl}/rest/v1/asset_library?or=(title.ilike.*${searchParam}*,tags.cs.{${tags.join(',')}})\&limit=20`,
                {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`,
                    },
                }
            );

            if (!resp.ok) {
                console.log('[Marketplace] Library lookup failed, proceeding to API.');
                return [];
            }

            const items = await resp.json();
            if (!items || items.length === 0) return [];

            console.log(`[Marketplace] Library HIT: ${items.length} cached items for "${query}"`);

            return items.map((item: any) => ({
                id: `lib-${item.id}`,
                source: (item.is_trending ? 'trending' : 'library') as any,
                title: item.title,
                price: item.price || '0.00',
                currency: item.currency || 'USD',
                imageUrl: item.universal_vto_url || item.original_image_url,
                originalImageUrl: item.original_image_url,
                vtoImageUrl: item.universal_vto_url,
                affiliateUrl: this.wrapSkimlinks(item.merchant_link, ''),
                merchantLink: item.merchant_link,
                brand: item.brand,
                category: item.category,
                merchant: item.merchant_name,
                merchantOfferId: item.merchant_offer_id,
                synthidApplied: item.synthid_applied,
                isTrending: item.is_trending,
                trendKeyword: item.trend_keyword,
            }));
        } catch (error: any) {
            console.log('[Marketplace] Library lookup error:', error.message);
            return [];
        }
    }

    // ============================================================
    // 2. OXYLABS GOOGLE SHOPPING (Primary Source)
    // ============================================================

    async fetchOxylabsItems(query: string, userId: string, category?: string): Promise<UnifiedGarment[]> {
        try {
            let products: OxylabsProduct[];

            if (category && category !== 'All' && !query) {
                products = await oxylabsIngestor.searchByCategory(category, 20);
            } else {
                const searchTerm = query || (category && category !== 'All' ? category : 'luxury fashion');
                products = await oxylabsIngestor.searchProducts(searchTerm, 20);
            }

            if (products.length === 0) {
                console.log('[Marketplace] Oxylabs returned no results.');
                return [];
            }

            console.log(`[Marketplace] Oxylabs: ${products.length} products`);

            const garments: UnifiedGarment[] = products.map((p, idx) => ({
                id: `oxy-${idx}-${Date.now()}`,
                source: 'oxylabs' as const,
                title: p.title,
                price: p.price,
                currency: p.currency,
                imageUrl: p.imageUrl,
                originalImageUrl: p.imageUrl,
                affiliateUrl: this.wrapSkimlinks(p.productUrl, userId),
                merchantLink: p.productUrl,
                brand: p.brand,
                category: category || undefined,
                merchant: p.merchant,
                merchantOfferId: `oxy-${p.position}`,
            }));

            // Background: index in asset_library
            this.indexOxylabsProducts(products, category).catch(err =>
                console.log('[Marketplace] Background indexing error:', err.message)
            );

            return garments;
        } catch (error: any) {
            console.error('[Marketplace] Oxylabs Error:', error.message);
            return [];
        }
    }

    /** Index Oxylabs products in asset_library for future cache hits. */
    private async indexOxylabsProducts(products: OxylabsProduct[], category?: string): Promise<void> {
        if (!this.supabaseUrl || !this.supabaseKey) return;

        for (const p of products) {
            try {
                await fetch(`${this.supabaseUrl}/rest/v1/asset_library`, {
                    method: 'POST',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=ignore-duplicates',
                    },
                    body: JSON.stringify({
                        merchant_offer_id: `oxy-${p.position}-${p.title.slice(0, 20)}`,
                        title: p.title,
                        brand: p.brand,
                        category: category,
                        category_id: category?.toLowerCase(),
                        original_image_url: p.imageUrl,
                        merchant_link: p.productUrl,
                        merchant_name: p.merchant,
                        price: p.price,
                        currency: p.currency,
                        tags: [
                            p.brand?.toLowerCase(),
                            category?.toLowerCase(),
                            p.merchant?.toLowerCase(),
                            ...p.title.toLowerCase().split(/\s+/).slice(0, 5),
                        ].filter(Boolean),
                    }),
                });
            } catch {
                // Silently continue
            }
        }
    }

    // ============================================================
    // 3. SKIMLINKS LINK API (Commission-Only Bridge)
    // ============================================================

    wrapSkimlinks(merchantUrl: string, userId: string): string {
        if (!this.skimlinksPublisherId || !merchantUrl || merchantUrl === '#') {
            return merchantUrl || '#';
        }
        const encodedUrl = encodeURIComponent(merchantUrl);
        const xcust = userId ? `&xcust=${userId}` : '';
        return `https://go.skimresources.com/?id=${this.skimlinksPublisherId}&url=${encodedUrl}${xcust}`;
    }

    // ============================================================
    // 4. EBAY (Secondary Source)
    // ============================================================

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

    private getEbayCategoryId(category?: string): string | null {
        const mapping: Record<string, string> = {
            'Outerwear': '15724', 'Shirts': '15724', 'Bags': '169291',
            'Accessories': '4251', 'Shoes': '3034', 'Dresses': '63861',
        };
        return category ? mapping[category] || null : null;
    }

    async fetchEbayItems(query: string, userId: string, category?: string): Promise<UnifiedGarment[]> {
        const token = await this.getEbayToken();
        if (!token) return [];

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
                source: 'ebay' as const,
                title: item.title,
                price: item.price.value,
                currency: item.price.currency,
                imageUrl: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl,
                affiliateUrl: `${item.itemAffiliateWebUrl || item.itemWebUrl}${item.itemWebUrl.includes('?') ? '&' : '?'}customid=${userId}`,
                brand: item.brand,
                authenticityGuaranteed: item.topRatedListing || false,
            }));
        } catch (error: any) {
            console.error('[Marketplace] eBay Search Error:', error.response?.status, error.response?.data || error.message);
            return [];
        }
    }

    // ============================================================
    // 5. FALLBACKS (Premium Staff Picks)
    // ============================================================

    private getFallbackItems(): UnifiedGarment[] {
        return [
            {
                id: 'fallback-1', source: 'oxylabs',
                title: 'Loro Piana - Open Walk Suede Boots',
                price: '950.00', currency: 'USD',
                imageUrl: '/placeholders/loropiana-boots.png',
                affiliateUrl: '#', brand: 'Loro Piana', category: 'Shoes'
            },
            {
                id: 'fallback-2', source: 'ebay',
                title: 'Vintage Hermès Birkin 35 - Gold Hardware',
                price: '12500.00', currency: 'USD',
                imageUrl: '/placeholders/hermes-birkin.png',
                affiliateUrl: '#', brand: 'Hermès', category: 'Bags',
                authenticityGuaranteed: true
            },
            {
                id: 'fallback-3', source: 'oxylabs',
                title: 'Brunello Cucinelli - Double-Breasted Cashmere Coat',
                price: '4800.00', currency: 'USD',
                imageUrl: '/placeholders/cucinelli-coat.png',
                affiliateUrl: '#', brand: 'Brunello Cucinelli', category: 'Outerwear'
            }
        ];
    }

    // ============================================================
    // 6. UNIFIED SEARCH (Entry Point)
    // ============================================================

    async searchAll(query: string, userId: string, category?: string, brand?: string): Promise<UnifiedGarment[]> {
        // Step 1: Library Lookup (cost-saver)
        let libraryItems = await this.libraryLookup(query || category || 'luxury', category);
        if (libraryItems.length >= 5) {
            console.log(`[Marketplace] Full library cache hit (${libraryItems.length} items).`);
            if (brand && brand !== 'All') {
                libraryItems = libraryItems.filter(i => i.brand?.toLowerCase() === brand.toLowerCase());
            }
            return libraryItems;
        }

        // Step 2: Fresh ingestion from Oxylabs + eBay
        const [oxylabs, ebay] = await Promise.all([
            this.fetchOxylabsItems(query, userId, category),
            this.fetchEbayItems(query, userId, category)
        ]);

        let combined = [...libraryItems, ...oxylabs, ...ebay];

        // Deduplicate by title similarity
        const seen = new Set<string>();
        combined = combined.filter(item => {
            const key = item.merchantOfferId || item.title.toLowerCase().slice(0, 40);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Step 3: Fallbacks if everything is empty
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
