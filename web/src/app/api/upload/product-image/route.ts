import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/upload/product-image
 *
 * Upload a product image to Supabase Storage.
 * Accepts multipart form data with a 'file' field.
 * Returns the public URL of the uploaded image.
 */
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

        // Generate unique filename
        const ext = file.name.split('.').pop() || 'jpg'
        const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

        // Convert File to ArrayBuffer then to Buffer for upload
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('product-images')
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: false,
            })

        if (error) {
            console.error('Upload error:', error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(data.path)

        return NextResponse.json({
            url: urlData.publicUrl,
            path: data.path,
        })
    } catch (err: any) {
        console.error('Upload exception:', err)
        return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 })
    }
}
