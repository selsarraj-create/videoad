import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

/**
 * POST /api/stripe/release-bounty
 *
 * Brand approves a submission → transfer funds to creator's Connect account.
 * 15% platform fee is retained, 85% goes to the creator.
 *
 * Body: { bounty_id: string, submission_id: string }
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { bounty_id, submission_id } = await request.json()

        if (!bounty_id || !submission_id) {
            return NextResponse.json({ error: 'bounty_id and submission_id are required' }, { status: 400 })
        }

        // Verify brand ownership
        const { data: brand } = await supabase
            .from('brands')
            .select('id')
            .eq('profile_id', user.id)
            .single()

        if (!brand) {
            return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
        }

        // Get bounty and validate escrow status
        const { data: bounty } = await supabase
            .from('bounties')
            .select('id, brand_id, escrow_status, amount_captured, stripe_payment_intent_id')
            .eq('id', bounty_id)
            .eq('brand_id', brand.id)
            .single()

        if (!bounty) {
            return NextResponse.json({ error: 'Bounty not found or not owned by you' }, { status: 404 })
        }

        if (bounty.escrow_status !== 'held') {
            return NextResponse.json({
                error: `Cannot release: bounty escrow is "${bounty.escrow_status}", expected "held"`
            }, { status: 400 })
        }

        // Get the submission and creator's Stripe account
        const { data: submission } = await supabase
            .from('submissions')
            .select('id, creator_id, status')
            .eq('id', submission_id)
            .eq('bounty_id', bounty_id)
            .single()

        if (!submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
        }

        const { data: creatorProfile } = await supabase
            .from('profiles')
            .select('stripe_account_id, payouts_enabled')
            .eq('id', submission.creator_id)
            .single()

        if (!creatorProfile?.stripe_account_id) {
            return NextResponse.json({
                error: 'Creator has not completed Stripe onboarding'
            }, { status: 400 })
        }

        // Calculate transfer amount (85% of captured amount)
        const transferAmount = Math.round((bounty.amount_captured || 0) * 0.85)

        if (transferAmount <= 0) {
            return NextResponse.json({ error: 'No funds to transfer' }, { status: 400 })
        }

        // Execute transfer to creator
        const transfer = await stripe.transfers.create({
            amount: transferAmount,
            currency: 'gbp',
            destination: creatorProfile.stripe_account_id,
            transfer_group: `bounty_${bounty.id}`,
            metadata: {
                bounty_id: bounty.id,
                submission_id: submission.id,
                creator_id: submission.creator_id,
            },
        })

        // Update bounty: close + release escrow
        await supabase
            .from('bounties')
            .update({
                status: 'closed',
                escrow_status: 'released',
            })
            .eq('id', bounty.id)

        // Accept the submission
        await supabase
            .from('submissions')
            .update({ status: 'accepted' })
            .eq('id', submission.id)

        return NextResponse.json({
            success: true,
            transfer_id: transfer.id,
            amount_transferred: transferAmount,
        })
    } catch (error: any) {
        console.error('Release bounty error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
