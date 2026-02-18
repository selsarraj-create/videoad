import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/bounties — List bounties
 *   - Brands: see their own bounties + stats
 *   - Creators: see active bounties to browse
 *
 * POST /api/bounties — Create a bounty (brand only)
 */

export async function GET() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const role = profile?.role ?? 'creator'

    if (role === 'brand' || role === 'admin') {
        // Brand view: own bounties + stats
        const { data: brand } = await supabase
            .from('brands')
            .select('id')
            .eq('profile_id', user.id)
            .single()

        if (!brand) {
            return NextResponse.json({ data: [], stats: { activeCampaigns: 0, totalSpend: 0, pendingReviews: 0 } })
        }

        const { data: bounties } = await supabase
            .from('bounties')
            .select('*')
            .eq('brand_id', brand.id)
            .order('created_at', { ascending: false })

        // Compute stats
        const activeCampaigns = bounties?.filter(b => b.status === 'active').length ?? 0
        const totalSpend = bounties?.reduce((sum, b) => sum + (b.budget_gbp || 0), 0) ?? 0

        // Count pending submissions across all bounties
        const bountyIds = bounties?.map(b => b.id) || []
        let pendingReviews = 0
        if (bountyIds.length > 0) {
            const { count } = await supabase
                .from('submissions')
                .select('*', { count: 'exact', head: true })
                .in('bounty_id', bountyIds)
                .eq('status', 'pending')
            pendingReviews = count ?? 0
        }

        return NextResponse.json({
            data: bounties || [],
            stats: { activeCampaigns, totalSpend, pendingReviews }
        })
    }

    // Creator view: active bounties with brand name
    const { data: bounties } = await supabase
        .from('bounties')
        .select(`
            id, title, description, budget_gbp, deadline, status, created_at,
            brands ( company_name, logo_url )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50)

    // Also get the creator's existing submissions
    const { data: submissions } = await supabase
        .from('submissions')
        .select('bounty_id, status')
        .eq('creator_id', user.id)

    const submissionMap = new Map(
        submissions?.map(s => [s.bounty_id, s.status]) || []
    )

    const enriched = bounties?.map(b => ({
        ...b,
        my_submission_status: submissionMap.get(b.id) || null
    })) || []

    return NextResponse.json({ data: enriched })
}

export async function POST(request: Request) {
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
        return NextResponse.json({ error: 'Only brands can create bounties' }, { status: 403 })
    }

    // Get brand ID
    const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .eq('profile_id', user.id)
        .single()

    if (!brand) {
        return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 })
    }

    const { title, description, budget_gbp, deadline, status, requirements, payment_per_video, product_image_url } = await request.json()

    if (!title?.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data: bounty, error } = await supabase
        .from('bounties')
        .insert({
            brand_id: brand.id,
            title: title.trim(),
            description: description || null,
            budget_gbp: budget_gbp || 0,
            payment_per_video: payment_per_video || 0,
            product_image_url: product_image_url || null,
            deadline: deadline || null,
            status: status || 'draft',
            requirements: requirements || {},
        })
        .select()
        .single()

    if (error) {
        console.error('Create bounty error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: bounty })
}
