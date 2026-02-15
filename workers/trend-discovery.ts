import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Gemini API Config
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash"; // Using Flash for speed/cost

interface TrendingItem {
    title: string;
    image_url: string;
    price: string;
    affiliate_url: string;
    brand?: string;
    growth_pct?: number;
}

export class TrendDiscoveryAgent {

    /**
     * Sourcing Phase: Fetch from Skimlinks & eBay
     */
    async fetchAisles() {
        console.log('[Trend-Spotter] Sourcing retail and vintage feeds...');

        // Mocking API results based on publisher specs
        // In prod, these would be real axios.get calls to Skimlinks/eBay
        const retailTrends: TrendingItem[] = [
            {
                title: "Oversized Cashmere Blazer",
                image_url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=1000",
                price: "850.00",
                affiliate_url: "https://go.skimlinks.com/...",
                brand: "The Row",
                growth_pct: 85
            }
        ];

        const vintageTrends: TrendingItem[] = [
            {
                title: "Archival Kelly Bag 35",
                image_url: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?q=80&w=1000",
                price: "12500.00",
                affiliate_url: "https://www.ebay.com/itm/...",
                growth_pct: 72
            }
        ];

        return { retailTrends, vintageTrends };
    }

    /**
     * Logic Phase: Aesthetic Scoring via Gemini
     */
    async scoreAesthetic(retail: TrendingItem, vintage: TrendingItem) {
        if (!GEMINI_API_KEY) throw new Error("Missing Gemini API Key");

        const prompt = `
        Analyze these two fashion items and categorize their combined "Look of the Day" vibe.
        Item 1 (Retail): ${retail.title}
        Item 2 (Vintage): ${vintage.title}

        Categorize into one of these 2026 aesthetics: "Quiet Luxury", "Loud Layers", "High Shine", "Cozy Minimalism".
        
        Return ONLY a JSON object:
        {
          "vibe": "Category Name",
          "justification": "Short reason why",
          "headline": "Punchy trend headline"
        }`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            }
        );

        const result = JSON.parse(response.data.candidates[0].content.parts[0].text);
        return result;
    }

    /**
     * Delivery Phase: Create the LOTD
     */
    async generateLookOfTheDay() {
        try {
            const { retailTrends, vintageTrends } = await this.fetchAisles();

            // Filter by growth > 70%
            const topRetail = retailTrends.find(i => (i.growth_pct || 0) > 70);
            const topVintage = vintageTrends.find(i => (i.growth_pct || 0) > 70);

            if (!topRetail || !topVintage) {
                console.log('[Trend-Spotter] No high-velocity trends found (>70%). Skiping LOTD.');
                return;
            }

            const scoring = await this.scoreAesthetic(topRetail, topVintage);

            const { error } = await supabase.from('trends').upsert({
                look_of_the_day_date: new Date().toISOString().split('T')[0],
                retail_item: topRetail,
                vintage_accessory: topVintage,
                vibe_category: scoring.vibe,
                growth_score: Math.max(topRetail.growth_pct || 0, topVintage.growth_pct || 0),
                discovery_log: {
                    justification: scoring.justification,
                    headline: scoring.headline,
                    scraped_at: new Date().toISOString()
                }
            }, { onConflict: 'look_of_the_day_date' });

            if (error) console.error('[Trend-Spotter] DB Error:', error.message);
            else console.log(`[Trend-Spotter] LOTD Generated: ${scoring.headline}`);

        } catch (error: any) {
            console.error('[Trend-Spotter] Critical Error:', error.message);
        }
    }
}

export const trendDiscovery = new TrendDiscoveryAgent();
