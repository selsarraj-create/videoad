import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/projects
 * Returns all projects for the authed user with VTO pipeline state.
 * Supports ?filter=drafts|completed query param.
 */
export async function GET(request: Request) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'drafts' | 'completed' | null (all)

    let query = supabase
        .from('projects')
        .select('id, user_id, identity_id, pipeline_status, credits_paid, reroll_count, scene_history, active_scene_index, prompt, fashn_render_url, veo_video_url, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (filter === 'drafts') {
        query = query.in('pipeline_status', ['DRAFT', 'SCENE_GENERATED', 'OUTFIT_SELECTED'])
    } else if (filter === 'completed') {
        query = query.eq('pipeline_status', 'COMPLETED')
    }

    const { data: projects, error } = await query

    if (error) {
        console.error('Failed to fetch projects:', error)
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    // Compute unfinished count for rescue notification
    const unfinishedCount = (projects || []).filter(
        (p: any) => p.pipeline_status && p.pipeline_status !== 'COMPLETED'
    ).length

    return NextResponse.json({
        projects: projects || [],
        unfinishedCount,
    })
}
