import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ── R2 Client ────────────────────────────────────────────────────────────────

const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'assets'
const SIGNED_URL_TTL = 3600 // 1 hour

function isStoragePath(url: string): boolean {
    return !!url && !url.startsWith('http://') && !url.startsWith('https://')
}

async function signIfNeeded(url: string | null | undefined): Promise<string | null> {
    if (!url) return null
    if (!isStoragePath(url)) return url
    try {
        return await getSignedUrl(
            r2,
            new GetObjectCommand({ Bucket: BUCKET, Key: url }),
            { expiresIn: SIGNED_URL_TTL }
        )
    } catch (err) {
        console.error(`Failed to sign ${url}:`, err)
        return null
    }
}

/**
 * GET /api/brand/bounties/[id]/submissions
 *
 * Brand fetches all submissions for their bounty.
 * Returns signed R2 URLs for secure video/thumbnail viewing.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: bountyId } = await params

    // Verify brand owns this bounty
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
        .select('id, title, status, escrow_status')
        .eq('id', bountyId)
        .eq('brand_id', brand.id)
        .single()

    if (!bounty) {
        return NextResponse.json({ error: 'Bounty not found or not owned by you' }, { status: 404 })
    }

    // Fetch all submissions with creator profile info
    const { data: submissions, error } = await supabase
        .from('submissions')
        .select('id, creator_id, video_url, thumbnail_url, notes, status, feedback, created_at, updated_at')
        .eq('bounty_id', bountyId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Fetch submissions error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sign R2 URLs for secure viewing (parallel)
    const signedSubmissions = await Promise.all(
        (submissions || []).map(async (sub) => ({
            ...sub,
            signed_video_url: await signIfNeeded(sub.video_url),
            signed_thumbnail_url: await signIfNeeded(sub.thumbnail_url),
            // Strip raw storage paths
            video_url: undefined,
            thumbnail_url: undefined,
        }))
    )

    return NextResponse.json({
        bounty: {
            id: bounty.id,
            title: bounty.title,
            status: bounty.status,
            escrow_status: bounty.escrow_status,
        },
        submissions: signedSubmissions,
        total: signedSubmissions.length,
    })
}
