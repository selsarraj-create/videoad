import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

const WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET!

// Service-role client — webhooks come from Stripe, not user sessions
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe Connect + Escrow webhook events:
 *   - account.updated → sync payouts_enabled
 *   - payment_intent.succeeded → mark bounty escrow as 'held'
 */
export async function POST(request: Request) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    try {
        switch (event.type) {
            // ── Connect: account status updated ─────────────────────────
            case 'account.updated': {
                const account = event.data.object as Stripe.Account
                const payoutsEnabled = account.payouts_enabled ?? false

                // Find user by stripe_account_id and update payouts_enabled
                const { error } = await supabase
                    .from('profiles')
                    .update({ payouts_enabled: payoutsEnabled })
                    .eq('stripe_account_id', account.id)

                if (error) {
                    console.error('Failed to update payouts_enabled:', error)
                }

                console.log(`[webhook] account.updated: ${account.id} → payouts_enabled=${payoutsEnabled}`)
                break
            }

            // ── Escrow: payment captured ────────────────────────────────
            case 'payment_intent.succeeded': {
                const pi = event.data.object as Stripe.PaymentIntent
                const bountyId = pi.metadata?.bounty_id

                if (!bountyId) {
                    console.log('[webhook] payment_intent.succeeded without bounty_id metadata, skipping')
                    break
                }

                // Mark bounty as escrowed
                const { error } = await supabase
                    .from('bounties')
                    .update({
                        escrow_status: 'held',
                        amount_captured: pi.amount_received,
                    })
                    .eq('id', bountyId)
                    .eq('stripe_payment_intent_id', pi.id)

                if (error) {
                    console.error('Failed to update bounty escrow:', error)
                } else {
                    console.log(`[webhook] payment_intent.succeeded: bounty ${bountyId} → escrow_status=held, amount=${pi.amount_received}`)
                }

                // Also activate the bounty if it's still in draft
                await supabase
                    .from('bounties')
                    .update({ status: 'active' })
                    .eq('id', bountyId)
                    .eq('status', 'draft')

                break
            }

            default:
                console.log(`[webhook] Unhandled event type: ${event.type}`)
        }
    } catch (err: any) {
        console.error(`[webhook] Error processing ${event.type}:`, err)
        // Return 200 anyway so Stripe doesn't retry
    }

    return NextResponse.json({ received: true })
}
