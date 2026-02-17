import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/bounties/[id]/submit — Creator submits work to a bounty
 *
 * Body: { video_url, thumbnail_url?, notes? }
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

    // Verify creator role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (profile?.role !== 'creator' && profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Only creators can submit to bounties' }, { status: 403 })
    }

    const { id: bountyId } = await params
    const { video_url, thumbnail_url, notes } = await request.json()

    if (!video_url) {
        return NextResponse.json({ error: 'video_url is required' }, { status: 400 })
    }

    // Verify bounty exists, is active, and not past deadline
    const { data: bounty, error: bountyErr } = await supabase
        .from('bounties')
        .select('id, status, deadline, escrow_status')
        .eq('id', bountyId)
        .single()

    if (bountyErr || !bounty) {
        return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
    }

    if (bounty.status !== 'active') {
        return NextResponse.json({ error: 'This bounty is no longer accepting submissions' }, { status: 400 })
    }

    // Check escrow — bounty must be funded
    if (bounty.escrow_status !== 'held') {
        return NextResponse.json({ error: 'This bounty has not been funded yet' }, { status: 400 })
    }

    // Deadline check
    if (bounty.deadline) {
        const deadline = new Date(bounty.deadline)
        if (deadline < new Date()) {
            return NextResponse.json({ error: 'Submission deadline has passed' }, { status: 400 })
        }
    }

    // Insert submission (unique constraint on bounty_id + creator_id prevents dups)
    const { data: submission, error } = await supabase
        .from('submissions')
        .insert({
            bounty_id: bountyId,
            creator_id: user.id,
            video_url,
            thumbnail_url: thumbnail_url || null,
            notes: notes || null,
            status: 'pending',
        })
        .select()
        .single()

    if (error) {
        if (error.code === '23505') {
            return NextResponse.json({ error: 'You have already submitted to this bounty' }, { status: 409 })
        }
        console.error('Submit error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Optionally transition bounty to reviewing (keeps it open for others too)
    // await supabase.from('bounties').update({ status: 'reviewing' }).eq('id', bountyId)

    return NextResponse.json({ data: submission })
}
