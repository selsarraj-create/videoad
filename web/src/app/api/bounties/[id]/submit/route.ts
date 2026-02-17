import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/bounties/[id]/submit — Creator submits to a bounty
 *
 * Body: { video_url?: string, message?: string }
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
    const { video_url, message } = await request.json()

    // Verify bounty exists and is active
    const { data: bounty, error: bountyErr } = await supabase
        .from('bounties')
        .select('id, status')
        .eq('id', bountyId)
        .single()

    if (bountyErr || !bounty) {
        return NextResponse.json({ error: 'Bounty not found' }, { status: 404 })
    }

    if (bounty.status !== 'active') {
        return NextResponse.json({ error: 'This bounty is no longer accepting submissions' }, { status: 400 })
    }

    // Insert submission (unique constraint on bounty_id + creator_id prevents dups)
    const { data: submission, error } = await supabase
        .from('submissions')
        .insert({
            bounty_id: bountyId,
            creator_id: user.id,
            video_url: video_url || null,
            message: message || null,
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

    return NextResponse.json({ data: submission })
}
