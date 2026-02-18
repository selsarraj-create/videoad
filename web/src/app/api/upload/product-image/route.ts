import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

/**
 * POST /api/upload/product-image
 *
 * Upload a product image to Cloudflare R2.
 * Accepts multipart form data with a 'file' field.
 * Returns the public URL of the uploaded image.
 *
 * Env vars required:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME (default: 'assets')
 *   R2_PUBLIC_URL   (your custom domain or R2 public URL)
 */

function getR2Client() {
    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('R2 credentials not configured')
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    })
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
        return NextResponse.json({ error: 'Only brands can upload product images' }, { status: 403 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, { status: 400 })
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large. Max 5MB' }, { status: 400 })
        }

        // Generate unique key under product-images/
        const ext = file.name.split('.').pop() || 'jpg'
        const key = `product-images/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        const arrayBuffer = await file.arrayBuffer()
        const bucket = process.env.R2_BUCKET_NAME || 'assets'

        const r2 = getR2Client()

        await r2.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: Buffer.from(arrayBuffer),
            ContentType: file.type,
        }))

        // Build the public URL
        const publicBase = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`
        const publicUrl = `${publicBase.replace(/\/$/, '')}/${key}`

        return NextResponse.json({
            url: publicUrl,
            key,
        })
    } catch (err: any) {
        console.error('R2 upload error:', err)
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
    }
}
