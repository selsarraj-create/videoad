import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

// GET — List all ready persona identities
export async function GET() {
    const supabase = await createClient()
    try {
        const { data, error } = await supabase
            .from('identities')
            .select('id, name, master_identity_url, is_default, status, created_at')
            .eq('status', 'ready')
            .order('created_at', { ascending: true })

        if (error) {
            console.error('List personas error:', error)
            return NextResponse.json({ error: 'Failed to list personas' }, { status: 500 })
        }
        return NextResponse.json({ personas: data || [] })
    } catch (err) {
        console.error('Personas GET error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE — Delete a persona identity by id query param
export async function DELETE(request: NextRequest) {
    const supabase = await createClient()
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
        }

        // Check if the identity being deleted is the default
        const { data: identity } = await supabase
            .from('identities')
            .select('is_default')
            .eq('id', id)
            .single()

        const wasDefault = identity?.is_default

        // Delete the identity (cascades to identity_views)
        const { error: deleteError } = await supabase
            .from('identities')
            .delete()
            .eq('id', id)

        if (deleteError) {
            console.error('Delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 })
        }

        // If deleted persona was default, promote the oldest remaining ready one
        if (wasDefault) {
            const { data: remaining } = await supabase
                .from('identities')
                .select('id')
                .eq('status', 'ready')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()

            if (remaining) {
                await supabase
                    .from('identities')
                    .update({ is_default: true })
                    .eq('id', remaining.id)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Personas DELETE error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
