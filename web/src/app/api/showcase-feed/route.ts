import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// ── R2 Client (shared config with workers/storage.js) ────────────────────────

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

/**
 * Check if a URL is an R2 storage path (not already a public URL).
 * R2 paths are relative keys like "showcase/abc.mp4", not full URLs.
 */
function isStoragePath(url: string): boolean {
    return !!url && !url.startsWith('http://') && !url.startsWith('https://')
}

/**
 * Sign an R2 storage path, or return the URL as-is if already public.
 */
async function signIfNeeded(url: string | null | undefined): Promise<string | null> {
    if (!url) return null
    if (!isStoragePath(url)) return url // Already a public URL
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

// ── GET /api/showcase-feed ───────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse pagination params
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(
        parseInt(searchParams.get('limit') || '10', 10),
        50
    )

    // 3. Query public_showcase with cursor-based pagination
    let query = supabase
        .from('public_showcase')
        .select('id, user_id, video_url, garment_metadata, persona_id, hearts, ai_labeled, created_at, allow_remix, original_creator_id')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (cursor) {
        const { data: cursorRow } = await supabase
            .from('public_showcase')
            .select('created_at')
            .eq('id', cursor)
            .single()

        if (cursorRow) {
            query = query.lt('created_at', cursorRow.created_at)
        }
    }

    const { data: items, error: dbErr } = await query

    if (dbErr) {
        console.error('Showcase feed DB error:', dbErr)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!items || items.length === 0) {
        return NextResponse.json({ data: [], nextCursor: null })
    }

    // 4. Sign R2 URLs for each video (parallel for performance)
    const signedItems = await Promise.all(
        items.map(async (item) => ({
            ...item,
            signed_video_url: await signIfNeeded(item.video_url),
            // Strip raw storage path
            video_url: undefined,
        }))
    )

    // 5. Build next cursor
    const lastItem = items[items.length - 1]
    const nextCursor = items.length === limit ? lastItem.id : null

    return NextResponse.json({
        data: signedItems,
        nextCursor,
    })
}
