/**
 * Google Merchant API v1 — Product Ingestor
 * 
 * Uses the Reports service with ProductView for keyword-based product search.
 * Extracts high-res image_link (1024px+), title, brand, price, and offer_id.
 * Raw merchant links are stored unwrapped — Skimlinks wrapping happens at click time.
 */

export interface MerchantProduct {
    offerId: string;
    title: string;
    brand: string;
    category: string;
    imageLink: string;
    link: string;
    price: string;
    currency: string;
}

export class MerchantIngestor {
    private merchantId: string;
    private _auth: any = null;

    constructor() {
        this.merchantId = process.env.GOOGLE_MERCHANT_ID || '';
    }

    /** Lazy auth — only runs at request time, never at build time. */
    private async getAuth() {
        if (this._auth) return this._auth;
        try {
            const { GoogleAuth } = await import('google-auth-library');
            const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
            if (keyJson) {
                const credentials = JSON.parse(Buffer.from(keyJson, 'base64').toString());
                this._auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/content'] });
            } else {
                this._auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/content'] });
            }
            return this._auth;
        } catch (error: any) {
            console.error('[MerchantIngestor] Auth init error:', error.message);
            return null;
        }
    }

    async searchProducts(keyword: string, limit: number = 20): Promise<MerchantProduct[]> {
        if (!this.merchantId) {
            console.log('[MerchantIngestor] GOOGLE_MERCHANT_ID not set, skipping.');
            return [];
        }
        try {
            const auth = await this.getAuth();
            if (!auth) return [];
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            const query = `
                SELECT product_view.id, product_view.offer_id, product_view.title,
                       product_view.brand, product_view.category_l1, product_view.image_link,
                       product_view.link, product_view.price_micros, product_view.currency_code
                FROM ProductView
                WHERE product_view.title LIKE '%${this.sanitizeQuery(keyword)}%'
                LIMIT ${limit}
            `;

            console.log(`[MerchantIngestor] Searching: "${keyword}" via ProductView`);
            const resp = await fetch(
                `https://merchantapi.googleapis.com/reports/v1beta/accounts/${this.merchantId}/reports:search`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken.token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query }),
                }
            );

            if (!resp.ok) {
                const errText = await resp.text();
                console.error('[MerchantIngestor] Reports API Error:', resp.status, errText);
                return [];
            }

            const data = await resp.json();
            console.log(`[MerchantIngestor] Found ${data.results?.length || 0} products`);

            return (data.results || []).map((row: any) => {
                const pv = row.productView || {};
                return {
                    offerId: pv.offerId || pv.id || '',
                    title: pv.title || 'Fashion Item',
                    brand: pv.brand || '',
                    category: pv.categoryL1 || '',
                    imageLink: pv.imageLink || '',
                    link: pv.link || '',
                    price: pv.priceMicros ? (Number(pv.priceMicros) / 1_000_000).toFixed(2) : '0.00',
                    currency: pv.currencyCode || 'USD',
                };
            }).filter((p: MerchantProduct) => p.imageLink && p.link);
        } catch (error: any) {
            console.error('[MerchantIngestor] Error:', error.message);
            return [];
        }
    }

    async getProduct(offerId: string): Promise<MerchantProduct | null> {
        if (!this.merchantId) return null;
        try {
            const auth = await this.getAuth();
            if (!auth) return null;
            const client = await auth.getClient();
            const accessToken = await client.getAccessToken();

            const resp = await fetch(
                `https://merchantapi.googleapis.com/products/v1beta/accounts/${this.merchantId}/products/${encodeURIComponent(offerId)}`,
                { headers: { 'Authorization': `Bearer ${accessToken.token}` } }
            );
            if (!resp.ok) return null;

            const product = await resp.json();
            const attrs = product.attributes || {};
            return {
                offerId: product.offerId || offerId,
                title: attrs.title || 'Fashion Item',
                brand: attrs.brand || '',
                category: attrs.productTypes?.[0] || '',
                imageLink: attrs.imageLink || '',
                link: attrs.link || '',
                price: attrs.price?.amountMicros ? (Number(attrs.price.amountMicros) / 1_000_000).toFixed(2) : '0.00',
                currency: attrs.price?.currencyCode || 'USD',
            };
        } catch (error: any) {
            console.error('[MerchantIngestor] getProduct Error:', error.message);
            return null;
        }
    }

    private sanitizeQuery(query: string): string {
        return query.replace(/['"\\%;]/g, '').trim().substring(0, 100);
    }
}

export const merchantIngestor = new MerchantIngestor();
