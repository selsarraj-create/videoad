import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SKIMLINKS_PUBLISHER_ID = process.env.SKIMLINKS_PUBLISHER_ID;
const SKIMLINKS_CLIENT_ID = process.env.SKIMLINKS_CLIENT_ID;
const SKIMLINKS_CLIENT_SECRET = process.env.SKIMLINKS_CLIENT_SECRET;

export class SkimlinksIngestor {
    private async getAccessToken() {
        const response = await axios.post('https://authentication.skimapis.com/access_token', {
            client_id: SKIMLINKS_CLIENT_ID,
            client_secret: SKIMLINKS_CLIENT_SECRET,
            grant_type: 'client_credentials'
        });
        return response.data.access_token;
    }

    /**
     * Cron entry point: Ingests sales from the last X hours
     */
    async processRecentSales(hours = 24) {
        try {
            console.log(`[Ingestor] Syncing Skimlinks sales for the last ${hours}h...`);
            const token = await this.getAccessToken();
            const now = new Date();
            const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000)).toISOString();

            // Note: API endpoint based on user instruction
            const url = `https://reporting.skimapis.com/publisher/${SKIMLINKS_PUBLISHER_ID}/reports/commission-details`;

            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    start_date: startTime.split('T')[0], // Simplified for Skimlinks API format YYYY-MM-DD
                    end_date: now.toISOString().split('T')[0]
                }
            });

            const commissions = response.data.commissions || [];
            console.log(`[Ingestor] Found ${commissions.length} prospective transactions.`);

            for (const item of commissions) {
                // Skimlinks 'custom_id' (xcust) is where we store our user_id
                const userId = item.custom_id || item.xcust;

                if (!userId) {
                    console.warn(`[Ingestor] Skipping transaction ${item.transaction_id}: No xcust found.`);
                    continue;
                }

                const rawCommission = parseFloat(item.commission_amount);
                const userShare = rawCommission * 0.5;
                const platformFee = rawCommission * 0.5;

                const { error: ledgerError } = await supabase
                    .from('revenue_ledger')
                    .upsert({
                        user_id: userId,
                        skimlinks_transaction_id: item.transaction_id,
                        item_name: item.merchant_name || 'Skimlinks Purchase',
                        total_sale_amount: parseFloat(item.order_amount),
                        raw_commission: rawCommission,
                        user_share: userShare,
                        platform_fee: platformFee,
                        currency: item.currency || 'USD',
                        status: item.commission_status === 'paid' ? 'cleared' : 'pending',
                        metadata: {
                            original_data: item,
                            merchant: item.merchant_name,
                            click_date: item.click_date
                        }
                    }, { onConflict: 'skimlinks_transaction_id' });

                if (ledgerError) {
                    console.error(`[Ingestor] Ledger error for ${item.transaction_id}:`, ledgerError.message);
                } else {
                    console.log(`[Ingestor] Attributed $${userShare.toFixed(2)} to user ${userId}`);
                }
            }

            return { success: true, count: commissions.length };
        } catch (error: any) {
            console.error('[Ingestor] Critical Failure:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const skimlinksIngestor = new SkimlinksIngestor();
