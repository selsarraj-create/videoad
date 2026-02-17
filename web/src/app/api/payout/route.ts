import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
});

const PAYOUT_THRESHOLD = 20;

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action } = await request.json();

        // 1. Fetch Profile and Ledger
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (action === 'onboard') {
            let stripeId = profile?.stripe_account_id;

            if (!stripeId) {
                // Create Express Account
                const account = await stripe.accounts.create({
                    type: 'express',
                    capabilities: {
                        transfers: { requested: true },
                        card_payments: { requested: true },
                    },
                    business_type: 'individual',
                });
                stripeId = account.id;

                // Update Profile
                await supabase.from('profiles').update({ stripe_account_id: stripeId }).eq('id', user.id);
            }

            // Create Account Link
            const accountLink = await stripe.accountLinks.create({
                account: stripeId,
                refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/revenue?refresh=true`,
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/revenue?success=true`,
                type: 'account_onboarding',
            });

            return NextResponse.json({ url: accountLink.url });
        }

        if (action === 'payout') {
            if (!profile?.stripe_account_id) {
                return NextResponse.json({ error: 'Stripe onboarding incomplete' }, { status: 400 });
            }

            // Verify Stripe onboarding is complete via Stripe API
            const account = await stripe.accounts.retrieve(profile.stripe_account_id);
            if (!account.charges_enabled) {
                return NextResponse.json({ error: 'Stripe onboarding incomplete' }, { status: 400 });
            }

            // Calculate Cleared Balance
            const { data: ledger } = await supabase
                .from('revenue_ledger')
                .select('user_share')
                .eq('user_id', user.id)
                .eq('status', 'cleared');

            const totalCleared = ledger?.reduce((sum, item) => sum + Number(item.user_share), 0) || 0;

            if (totalCleared < PAYOUT_THRESHOLD) {
                return NextResponse.json({
                    error: `Insufficient balance. Minimum payout is $${PAYOUT_THRESHOLD}. Currently: $${totalCleared.toFixed(2)}`
                }, { status: 400 });
            }

            // Trigger Stripe Transfer
            const transfer = await stripe.transfers.create({
                amount: Math.round(totalCleared * 100), // convert to cents
                currency: 'usd',
                destination: profile.stripe_account_id,
                description: 'Fashion Studio Creator Payout',
            });

            // Mark Ledger as Paid
            await supabase
                .from('revenue_ledger')
                .update({
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    metadata: { stripe_transfer_id: transfer.id }
                })
                .eq('user_id', user.id)
                .eq('status', 'cleared');

            return NextResponse.json({ success: true, transfer_id: transfer.id });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Stripe API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
