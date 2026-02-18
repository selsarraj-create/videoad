import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { verifyUploadQuota } from '@/lib/upload-quota'

/**
 * POST /api/projects/{id}/add_item
 *
 * Upload a garment item to a specific project (video creation flow).
 * Rate-limited: items that trigger Photoroom/Claid cleaning count toward daily quota.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    // ── Rate Limit Guard ─────────────────────────────────────────
    const quota = await verifyUploadQuota(supabase, user.id)
    if (quota.error) return quota.error

    try {
        const body = await request.json()
        const { image_url, title = 'Untitled', category = 'tops' } = body

        if (!image_url) {
            return NextResponse.json({ error: 'Missing image_url' }, { status: 400 })
        }

        // Verify project ownership
        // Note: user_id column is added by migration 20240226_projects.sql
        // Supabase types may not reflect it until `supabase gen types` is re-run
        const { data: project, error: projError } = await supabase
            .from('projects')
            .select('id')
            .eq('id', projectId)
            .eq('user_id' as any, user.id)
            .single()

        if (projError || !project) {
            return NextResponse.json({ error: 'Project not found or not yours' }, { status: 404 })
        }

        // TODO: Trigger Claid/Photoroom cleaning for the garment image
        // For now, return the quota-gated success response

        return NextResponse.json({
            success: true,
            projectId,
            image_url,
            title,
            category,
            quota: {
                used: quota.dailyUploads,
                limit: quota.dailyLimit,
                tier: quota.tier,
            },
        })
    } catch (err: any) {
        console.error('Project add_item error:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
