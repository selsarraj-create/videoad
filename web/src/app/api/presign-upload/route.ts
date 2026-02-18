import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_BUCKETS = ['raw_assets']

/**
 * Generates a Supabase Storage presigned upload URL.
 * The client uploads the file directly to storage — Vercel never sees the bytes.
 */
export async function POST(request: Request) {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { path, bucket = 'raw_assets' } = await request.json()

        if (!path) {
            return NextResponse.json({ error: 'Missing path' }, { status: 400 })
        }

        // Validate bucket
        if (!ALLOWED_BUCKETS.includes(bucket)) {
            return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 })
        }

        // Prevent path traversal and scope to user
        const sanitizedPath = path.replace(/\.\./g, '').replace(/^\/+/, '')
        const scopedPath = `${user.id}/${sanitizedPath}`

        // Create a signed upload URL (valid for 2 minutes)
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(scopedPath)

        if (error) {
            console.error('Presign error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get the public URL for this file path
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(scopedPath)

        return NextResponse.json({
            signedUrl: data.signedUrl,
            token: data.token,
            path: data.path,
            publicUrl: urlData.publicUrl,
        })
    } catch (err) {
        console.error('Presign Upload API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
