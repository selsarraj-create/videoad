import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { verifyUploadQuota } from '@/lib/upload-quota'

/**
 * POST /api/remix/upload
 *
 * Upload a garment for the remix flow (community/showcase remixes).
 * Rate-limited: Photoroom/Claid processing counts toward daily quota.
 */
export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Rate Limit Guard ─────────────────────────────────────────
    const quota = await verifyUploadQuota(supabase, user.id)
    if (quota.error) return quota.error

    try {
        const body = await request.json()
        const { image_url, showcase_id, original_creator_id } = body

        if (!image_url) {
            return NextResponse.json({ error: 'Missing image_url' }, { status: 400 })
        }

        // TODO: Trigger Claid/Photoroom cleaning and process the remix
        // For now, return the quota-gated success response

        return NextResponse.json({
            success: true,
            image_url,
            showcase_id: showcase_id || null,
            original_creator_id: original_creator_id || null,
            quota: {
                used: quota.dailyUploads,
                limit: quota.dailyLimit,
                tier: quota.tier,
            },
        })
    } catch (err: any) {
        console.error('Remix upload error:', err)
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 })
    }
}
