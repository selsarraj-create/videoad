import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { addPurchasedCredits } from '@/lib/credit-router'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * POST /api/credits/webhook
 *
 * Stripe webhook handler for checkout.session.completed events.
 * Verifies signature, then credits the user's balance.
 *
 * IMPORTANT: This endpoint must NOT use the Supabase auth cookie client —
 * webhooks come from Stripe, not the browser.
 */
export async function POST(request: Request) {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET)
    } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        const userId = session.metadata?.user_id
        const packId = session.metadata?.pack_id
        const credits = parseInt(session.metadata?.credits || '0', 10)

        if (!userId || !packId || credits <= 0) {
            console.error('Webhook: missing metadata', session.metadata)
            return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
        }

        // Ensure payment was actually received
        if (session.payment_status !== 'paid') {
            console.log(`Webhook: session ${session.id} not paid (${session.payment_status}), skipping`)
            return NextResponse.json({ received: true })
        }

        try {
            const newBalance = await addPurchasedCredits(userId, credits, packId)
            console.log(`✅ Credited ${credits} to user ${userId} (pack: ${packId}). New balance: ${newBalance}`)
        } catch (err) {
            console.error('Failed to credit user:', err)
            return NextResponse.json({ error: 'Credit failed' }, { status: 500 })
        }
    }

    return NextResponse.json({ received: true })
}
