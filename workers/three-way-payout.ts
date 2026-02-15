import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { parseCompositeId } from '../web/src/lib/viral-link-generator';

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16' as any
});

/**
 * 3-Way Payout Logic:
 * 50% -> Platform
 * 40% -> Remixer (The poster)
 * 10% -> Original Creator (The trendsetter)
 * 
 * IF NO ORIGINAL:
 * 50% -> Remixer
 */
export async function processThreeWayCommission(sale: {
    transactionId: string;
    source: string;
    trackingId: string; // The composite ID string
    netCommission: number;
    currency: string;
}) {
    console.log(`[Payout] Processing Sale ${sale.transactionId} with ID: ${sale.trackingId}`);

    const { remixerId, originalCreatorId } = parseCompositeId(sale.trackingId);

    // 1. Calculate Shares
    const platformShare = sale.netCommission * 0.50;
    let remixerShare = 0;
    let trendsetterShare = 0;

    if (originalCreatorId) {
        remixerShare = sale.netCommission * 0.40;
        trendsetterShare = sale.netCommission * 0.10;
        console.log(`[Payout] 3-Way Split: Remixer($${remixerShare.toFixed(2)}), Trendsetter($${trendsetterShare.toFixed(2)})`);
    } else {
        remixerShare = sale.netCommission * 0.50;
        console.log(`[Payout] Direct Split: Remixer($${remixerShare.toFixed(2)})`);
    }

    // 2. Perform Payouts
    const payouts = [
        { userId: remixerId, amount: remixerShare, role: 'remixer' },
        ...(originalCreatorId ? [{ userId: originalCreatorId, amount: trendsetterShare, role: 'original_creator' }] : [])
    ];

    for (const payout of payouts) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id', payout.userId)
            .single();

        if (profile?.stripe_account_id) {
            try {
                // Execute Stripe Transfer
                await stripe.transfers.create({
                    amount: Math.round(payout.amount * 100),
                    currency: sale.currency.toLowerCase(),
                    destination: profile.stripe_account_id,
                    description: `Viral Split (${payout.role}) - ${sale.source} #${sale.transactionId}`
                });

                // Record in Ledger
                await supabase.from('revenue_ledger').insert({
                    user_id: payout.userId,
                    transaction_id: sale.transactionId,
                    source: sale.source,
                    total_amount: sale.netCommission,
                    user_share: payout.amount,
                    status: 'cleared', // In real prod, this might be 'pending' first
                    metadata: {
                        role: payout.role,
                        composite_id: sale.trackingId,
                        is_remix: !!originalCreatorId
                    }
                });

                console.log(`[Payout] Success for ${payout.userId} as ${payout.role}`);
            } catch (err) {
                console.error(`[Payout] Failed for ${payout.userId}:`, err);
            }
        } else {
            console.warn(`[Payout] No Stripe account for user ${payout.userId}`);
        }
    }
}
