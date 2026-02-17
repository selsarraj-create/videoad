import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

type Decision = 'approved' | 'rejected' | 'revision'

/**
 * POST /api/submissions/[id]/decide
 *
 * Brand makes a decision on a submission:
 *   - approved  → release escrow to creator, close bounty
 *   - rejected  → update status, store feedback
 *   - revision  → set changes_requested, store feedback
 *
 * Body: { status: Decision, feedback?: string }
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: submissionId } = await params
    const { status, feedback } = await request.json() as { status: Decision; feedback?: string }

    if (!['approved', 'rejected', 'revision'].includes(status)) {
        return NextResponse.json({ error: 'status must be approved, rejected, or revision' }, { status: 400 })
    }

    // Get submission + parent bounty
    const { data: submission } = await supabase
        .from('submissions')
        .select('id, bounty_id, creator_id, status')
        .eq('id', submissionId)
        .single()

    if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Verify brand owns the parent bounty
    const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .eq('profile_id', user.id)
        .single()

    if (!brand) {
        return NextResponse.json({ error: 'Brand profile not found' }, { status: 403 })
    }

    const { data: bounty } = await supabase
        .from('bounties')
        .select('id, brand_id, escrow_status, amount_captured')
        .eq('id', submission.bounty_id)
        .eq('brand_id', brand.id)
        .single()

    if (!bounty) {
        return NextResponse.json({ error: 'Bounty not found or not owned by you' }, { status: 404 })
    }

    // ── APPROVED: release escrow → transfer to creator ──────────────────
    if (status === 'approved') {
        if (bounty.escrow_status !== 'held') {
            return NextResponse.json({
                error: `Cannot approve: escrow is "${bounty.escrow_status}", expected "held"`
            }, { status: 400 })
        }

        // Get creator's Stripe account
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

        // Calculate transfer: 85% to creator (15% platform fee)
        const transferAmount = Math.round((bounty.amount_captured || 0) * 0.85)

        if (transferAmount <= 0) {
            return NextResponse.json({ error: 'No funds to transfer' }, { status: 400 })
        }

        // Execute Stripe transfer
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
            .update({ status: 'closed', escrow_status: 'released' })
            .eq('id', bounty.id)

        // Accept the submission
        await supabase
            .from('submissions')
            .update({
                status: 'accepted',
                feedback: feedback || 'Approved! Payment is being processed.',
            })
            .eq('id', submission.id)

        // Reject all other pending submissions for this bounty
        await supabase
            .from('submissions')
            .update({
                status: 'rejected',
                feedback: 'Another submission was selected for this bounty.',
            })
            .eq('bounty_id', bounty.id)
            .eq('status', 'pending')
            .neq('id', submission.id)

        return NextResponse.json({
            success: true,
            decision: 'approved',
            transfer_id: transfer.id,
            amount_transferred: transferAmount,
        })
    }

    // ── REJECTED ────────────────────────────────────────────────────────
    if (status === 'rejected') {
        await supabase
            .from('submissions')
            .update({
                status: 'rejected',
                feedback: feedback || null,
            })
            .eq('id', submission.id)

        return NextResponse.json({
            success: true,
            decision: 'rejected',
        })
    }

    // ── REVISION (changes_requested) ────────────────────────────────────
    if (status === 'revision') {
        if (!feedback) {
            return NextResponse.json({
                error: 'feedback is required when requesting changes'
            }, { status: 400 })
        }

        await supabase
            .from('submissions')
            .update({
                status: 'changes_requested',
                feedback,
            })
            .eq('id', submission.id)

        return NextResponse.json({
            success: true,
            decision: 'changes_requested',
        })
    }

    return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
}
