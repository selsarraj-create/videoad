import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

const PLATFORM_FEE_PERCENT = 15 // 15% platform fee

/**
 * POST /api/stripe/fund-bounty
 *
 * Brand funds a bounty by creating a PaymentIntent.
 * Returns clientSecret for Stripe Elements on the frontend.
 *
 * Body: { bounty_id: string }
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify brand role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'brand' && profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Only brands can fund bounties' }, { status: 403 })
        }

        const { bounty_id } = await request.json()

        if (!bounty_id) {
            return NextResponse.json({ error: 'bounty_id is required' }, { status: 400 })
        }

        // Get the bounty + verify brand ownership
        const { data: brand } = await supabase
            .from('brands')
            .select('id')
            .eq('profile_id', user.id)
            .single()

        if (!brand) {
            return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
        }

        const { data: bounty } = await supabase
            .from('bounties')
            .select('id, budget_gbp, escrow_status, brand_id, stripe_payment_intent_id')
            .eq('id', bounty_id)
            .eq('brand_id', brand.id)
            .single()

        if (!bounty) {
            return NextResponse.json({ error: 'Bounty not found or not owned by you' }, { status: 404 })
        }

        if (bounty.escrow_status && bounty.escrow_status !== 'unpaid') {
            return NextResponse.json({ error: `Bounty is already ${bounty.escrow_status}` }, { status: 400 })
        }

        // If a PI already exists (user abandoned checkout), reuse it
        if (bounty.stripe_payment_intent_id) {
            const existingPI = await stripe.paymentIntents.retrieve(bounty.stripe_payment_intent_id)
            if (existingPI.status === 'requires_payment_method' || existingPI.status === 'requires_confirmation') {
                return NextResponse.json({ clientSecret: existingPI.client_secret })
            }
        }

        // Calculate amounts
        const bountyAmountPence = bounty.budget_gbp * 100 // budget_gbp is in £, convert to pence
        const platformFeePence = Math.round(bountyAmountPence * (PLATFORM_FEE_PERCENT / 100))
        const totalChargePence = bountyAmountPence + platformFeePence

        // Create PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalChargePence,
            currency: 'gbp',
            capture_method: 'automatic',
            metadata: {
                bounty_id: bounty.id,
                brand_id: brand.id,
                user_id: user.id,
                bounty_amount_pence: bountyAmountPence.toString(),
                platform_fee_pence: platformFeePence.toString(),
            },
            description: `Bounty funding: ${bounty.id}`,
        })

        // Store the PI ID on the bounty
        await supabase
            .from('bounties')
            .update({ stripe_payment_intent_id: paymentIntent.id })
            .eq('id', bounty.id)

        return NextResponse.json({ clientSecret: paymentIntent.client_secret })
    } catch (error: any) {
        console.error('Fund bounty error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
