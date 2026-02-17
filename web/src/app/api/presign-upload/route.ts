import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Generates a Supabase Storage presigned upload URL.
 * The client uploads the file directly to storage — Vercel never sees the bytes.
 */
export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const { path, bucket = 'raw_assets' } = await request.json()

        if (!path) {
            return NextResponse.json({ error: 'Missing path' }, { status: 400 })
        }

        // Create a signed upload URL (valid for 2 minutes)
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUploadUrl(path)

        if (error) {
            console.error('Presign error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get the public URL for this file path
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)

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
