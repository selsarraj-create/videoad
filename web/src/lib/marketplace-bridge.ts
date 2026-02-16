/**
 * MarketplaceBridge v2 — Fashion Asset Pipeline
 * 
 * Architecture:
 * 1. Library Lookup: Check asset_library for cached VTO renders
 * 2. Google Merchant API: Ingest product data with real product images
 * 3. Vertex AI VTO: Generate Universal Model try-on renders
 * 4. SynthID + IPTC: Compliance watermarking
 * 5. Skimlinks Link API: Wrap merchant URLs at click time only
 * 6. eBay Browse API: Secondary source (unchanged)
 * 7. Premium Fallbacks: Staff Pick items when APIs are offline
 */

import axios from 'axios';
import { merchantIngestor, MerchantProduct } from './merchant-ingestor';
import { vertexVTO } from './vertex-vto';
import { complianceTagger } from './compliance-tagger';

export interface UnifiedGarment {
    id: string;
    source: 'merchant' | 'ebay' | 'library';
    title: string;
    price: string;
    currency: string;
    imageUrl: string;            // Product image OR VTO render
    originalImageUrl?: string;   // Raw merchant product image
    vtoImageUrl?: string;        // VTO render (if generated)
    affiliateUrl: string;        // Skimlinks-wrapped at serve time
    merchantLink?: string;       // Raw merchant URL (for Skimlinks wrapping)
    brand?: string;
    category?: string;
    merchantOfferId?: string;
    authenticityGuaranteed?: boolean;
    synthidApplied?: boolean;
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

    /**
     * Check asset_library for cached VTO renders matching the query.
     * Returns immediately if found, saving Merchant API + Vertex AI costs.
     */
    private async libraryLookup(query: string, category?: string): Promise<UnifiedGarment[]> {
        if (!this.supabaseUrl || !this.supabaseKey) return [];

        try {
            // Build search tags
            const tags = [query.toLowerCase()];
            if (category && category !== 'All') tags.push(category.toLowerCase());

            // Use full-text search on title + tag matching
            const searchParam = encodeURIComponent(query);
            const resp = await fetch(
                `${this.supabaseUrl}/rest/v1/asset_library?or=(title.ilike.*${searchParam}*,tags.cs.{${tags.join(',')}})&limit=20`,
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
                source: 'library' as const,
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
                merchantOfferId: item.merchant_offer_id,
                synthidApplied: item.synthid_applied,
            }));
        } catch (error: any) {
            console.log('[Marketplace] Library lookup error:', error.message);
            return [];
        }
    }

    // ============================================================
    // 2. GOOGLE MERCHANT API INGESTION
    // ============================================================

    /**
     * Fetch products from Google Merchant API and optionally run VTO.
     * Results are indexed in asset_library for future cache hits.
     */
    async fetchMerchantItems(query: string, userId: string, category?: string): Promise<UnifiedGarment[]> {
        const searchTerm = query || (category && category !== 'All' ? category : 'luxury fashion');

        try {
            const products = await merchantIngestor.searchProducts(searchTerm, 20);
            if (products.length === 0) {
                console.log('[Marketplace] Merchant API returned no results.');
                return [];
            }

            console.log(`[Marketplace] Merchant API: ${products.length} products for "${searchTerm}"`);

            // Map products to garments — use original product images
            // VTO generation happens on-demand via /api/marketplace-vto
            const garments: UnifiedGarment[] = products.map((p: MerchantProduct) => ({
                id: `merchant-${p.offerId}`,
                source: 'merchant' as const,
                title: p.title,
                price: p.price,
                currency: p.currency,
                imageUrl: p.imageLink,               // High-res product image
                originalImageUrl: p.imageLink,
                affiliateUrl: this.wrapSkimlinks(p.link, userId),
                merchantLink: p.link,
                brand: p.brand,
                category: p.category || category,
                merchantOfferId: p.offerId,
            }));

            // Background: index new products in asset_library for future lookups
            this.indexProducts(products).catch(err =>
                console.log('[Marketplace] Background indexing error:', err.message)
            );

            return garments;
        } catch (error: any) {
            console.error('[Marketplace] Merchant API Error:', error.message);
            return [];
        }
    }

    /**
     * Index products in asset_library for future cache hits.
     * Called in background — doesn't block the response.
     */
    private async indexProducts(products: MerchantProduct[]): Promise<void> {
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
                        merchant_offer_id: p.offerId,
                        title: p.title,
                        brand: p.brand,
                        category: p.category,
                        original_image_url: p.imageLink,
                        merchant_link: p.link,
                        price: p.price,
                        currency: p.currency,
                        tags: [
                            p.brand?.toLowerCase(),
                            p.category?.toLowerCase(),
                            ...p.title.toLowerCase().split(/\s+/).slice(0, 5),
                        ].filter(Boolean),
                    }),
                });
            } catch (err) {
                // Silently continue — indexing is best-effort
            }
        }
    }

    // ============================================================
    // 3. SKIMLINKS LINK API (Commission-Only Bridge)
    // ============================================================

    /**
     * Wrap a merchant URL with Skimlinks for affiliate commission tracking.
     * Called at serve time — never at ingestion.
     */
    wrapSkimlinks(merchantUrl: string, userId: string): string {
        if (!this.skimlinksPublisherId || !merchantUrl || merchantUrl === '#') {
            return merchantUrl || '#';
        }
        const encodedUrl = encodeURIComponent(merchantUrl);
        const xcust = userId ? `&xcust=${userId}` : '';
        return `https://go.skimresources.com/?id=${this.skimlinksPublisherId}&url=${encodedUrl}${xcust}`;
    }

    // ============================================================
    // 4. EBAY (Secondary Source — Unchanged)
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
            'Outerwear': '15724',
            'Shirts': '15724',
            'Bags': '169291',
            'Accessories': '4251',
            'Shoes': '3034'
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
                authenticityGuaranteed: item.topRatedListing || false
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
                id: 'fallback-1',
                source: 'merchant',
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
                source: 'merchant',
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

    // ============================================================
    // 6. UNIFIED SEARCH (Entry Point)
    // ============================================================

    /**
     * Primary search entry point with full pipeline:
     * 1. Library cache check
     * 2. Google Merchant API (on miss)
     * 3. eBay secondary source
     * 4. Premium fallbacks (last resort)
     */
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

        // Step 2: Fresh ingestion from Merchant API + eBay
        const [merchant, ebay] = await Promise.all([
            this.fetchMerchantItems(query, userId, category),
            this.fetchEbayItems(query, userId, category)
        ]);

        let combined = [...libraryItems, ...merchant, ...ebay];

        // Deduplicate by merchantOfferId
        const seen = new Set<string>();
        combined = combined.filter(item => {
            const key = item.merchantOfferId || item.id;
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
