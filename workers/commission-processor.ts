import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16' as any
});

/**
 * Task: Every 60 minutes
 * Matches sales to users and performs 50/50 split
 */
export async function processCommissions() {
    console.log('--- Commission Processor Started ---');

    try {
        // 1. Fetch Sales from Skimlinks Reporting API
        // 2. Fetch Sales from eBay Commissions API

        // Mocked Sales Data for Step 1
        const mockSales = [
            {
                transactionId: 't-123',
                source: 'skimlinks',
                userId: 'user_2k9A...', // Extracted from xcust
                netCommission: 50.00,
                currency: 'USD'
            },
            {
                transactionId: 't-456',
                source: 'ebay',
                userId: 'user_9X2B...', // Extracted from customid
                netCommission: 120.00,
                currency: 'USD'
            }
        ];

        for (const sale of mockSales) {
            // Check if sale already processed
            const { data: existing } = await supabase
                .from('commissions')
                .select('id')
                .eq('transaction_id', sale.transactionId)
                .single();

            if (existing) continue;

            const userShare = sale.netCommission * 0.5;
            console.log(`Processing split for user ${sale.userId}: $${userShare}`);

            // 3. Update Supabase
            const { data: userData } = await supabase
                .from('profiles')
                .select('stripe_account_id')
                .eq('id', sale.userId)
                .single();

            if (userData?.stripe_account_id) {
                // 4. Deposit into Stripe Express Wallet
                try {
                    await stripe.transfers.create({
                        amount: Math.round(userShare * 100), // cents
                        currency: 'usd',
                        destination: userData.stripe_account_id,
                        description: `Commission Split (50/50) - ${sale.source} Transaction ${sale.transactionId}`
                    });

                    await supabase.from('commissions').insert({
                        user_id: sale.userId,
                        transaction_id: sale.transactionId,
                        source: sale.source,
                        total_amount: sale.netCommission,
                        user_amount: userShare,
                        status: 'paid'
                    });
                } catch (stripeError) {
                    console.error(`Stripe Transfer Failed for ${sale.userId}:`, stripeError);
                }
            }
        }

    } catch (error) {
        console.error('Commission Processing Error:', error);
    }

    console.log('--- Commission Processor Finished ---');
}

// In a real environment, this would be triggered by a Cron schedule
// e.g. every 60 mins via Railway Cron or a timer
