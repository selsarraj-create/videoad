import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

const MAX_PERSONAS = 5

// GET — List all persona slots
export async function GET() {
    const supabase = await createClient()
    try {
        const { data, error } = await supabase
            .from('identity_masters')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('List identity masters error:', error)
            return NextResponse.json({ error: 'Failed to list personas' }, { status: 500 })
        }
        return NextResponse.json({ personas: data || [] })
    } catch (err) {
        console.error('Identity Masters GET error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// POST — Create a new persona slot
export async function POST(request: Request) {
    const supabase = await createClient()
    try {
        const body = await request.json()
        const { name, image_data } = body

        if (!name || !image_data) {
            return NextResponse.json({ error: 'Missing name or image_data' }, { status: 400 })
        }

        // Enforce max 5 limit
        const { count, error: countError } = await supabase
            .from('identity_masters')
            .select('*', { count: 'exact', head: true })

        if (countError) {
            return NextResponse.json({ error: 'Failed to check persona count' }, { status: 500 })
        }

        if ((count ?? 0) >= MAX_PERSONAS) {
            return NextResponse.json(
                { error: `Maximum ${MAX_PERSONAS} personas allowed` },
                { status: 400 }
            )
        }

        // Upload image to Supabase storage
        const base64Data = image_data.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')
        const ext = image_data.includes('png') ? 'png' : 'jpg'
        const fileName = `persona_masters/${Date.now()}_${name.replace(/\s+/g, '_').toLowerCase()}.${ext}`

        const { error: uploadError } = await supabase.storage
            .from('raw_assets')
            .upload(fileName, buffer, {
                contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
                upsert: false
            })

        if (uploadError) {
            console.error('Upload error:', uploadError)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
        const identity_image_url = urlData.publicUrl

        // Auto-set is_default if this is the first persona
        const isDefault = (count ?? 0) === 0

        const { data: persona, error: dbError } = await supabase
            .from('identity_masters')
            .insert({
                name,
                identity_image_url,
                is_default: isDefault,
            })
            .select()
            .single()

        if (dbError || !persona) {
            console.error('DB error:', dbError)
            return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 })
        }

        return NextResponse.json({ success: true, persona })
    } catch (err) {
        console.error('Identity Masters POST error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE — Delete a persona slot by id query param
export async function DELETE(request: NextRequest) {
    const supabase = await createClient()
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
        }

        // Check if the persona being deleted is the default
        const { data: persona } = await supabase
            .from('identity_masters')
            .select('is_default')
            .eq('id', id)
            .single()

        const wasDefault = persona?.is_default

        // Delete the persona
        const { error: deleteError } = await supabase
            .from('identity_masters')
            .delete()
            .eq('id', id)

        if (deleteError) {
            console.error('Delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 })
        }

        // If deleted persona was default, promote the oldest remaining one
        if (wasDefault) {
            const { data: remaining } = await supabase
                .from('identity_masters')
                .select('id')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()

            if (remaining) {
                await supabase
                    .from('identity_masters')
                    .update({ is_default: true })
                    .eq('id', remaining.id)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Identity Masters DELETE error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
