import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

const MAX_IDENTITIES = 5

// GET — List personas for the authenticated user
// ?all=true returns all statuses (for identity management); default returns only 'ready'
export async function GET(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const showAll = searchParams.get('all') === 'true'

        let query = supabase
            .from('identities')
            .select('id, name, master_identity_url, status, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })

        if (!showAll) {
            query = query.eq('status', 'ready')
        }

        const { data, error } = await query

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

// DELETE — Delete a persona identity (must belong to authenticated user)
export async function DELETE(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
        }

        // Check ownership
        const { data: identity } = await supabase
            .from('identities')
            .select('user_id')
            .eq('id', id)
            .single()

        if (!identity || identity.user_id !== user.id) {
            return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
        }

        // Delete the identity (cascades to identity_views)
        const { error: deleteError } = await supabase
            .from('identities')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (deleteError) {
            console.error('Delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete persona' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Personas DELETE error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// PATCH — Rename or set-default on a persona
export async function PATCH(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { id, name } = body

        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 })
        }

        // Verify ownership
        const { data: identity } = await supabase
            .from('identities')
            .select('user_id')
            .eq('id', id)
            .single()

        if (!identity || identity.user_id !== user.id) {
            return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
        }

        const updates: Record<string, unknown> = {}
        if (name !== undefined) updates.name = name

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
        }

        const { error: updateError } = await supabase
            .from('identities')
            .update(updates)
            .eq('id', id)

        if (updateError) {
            console.error('Patch error:', updateError)
            return NextResponse.json({ error: 'Failed to update persona' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Personas PATCH error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// POST — Check identity count before creating (server-side limit enforcement)
export async function POST(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Count existing identities for this user
        const { count, error: countError } = await supabase
            .from('identities')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)

        if (countError) {
            return NextResponse.json({ error: 'Failed to check identity count' }, { status: 500 })
        }

        if ((count ?? 0) >= MAX_IDENTITIES) {
            return NextResponse.json(
                { error: `Identity limit reached. Maximum ${MAX_IDENTITIES} personas allowed.` },
                { status: 409 }
            )
        }

        const body = await request.json()
        const name = body.name || 'Default'

        // Determine if this should be the default (first identity)
        const isDefault = (count ?? 0) === 0

        const { data: newIdentity, error: insertError } = await supabase
            .from('identities')
            .insert({
                user_id: user.id,
                raw_selfie_url: '',
                status: 'pending',
            })
            .select('id, name, status')
            .single()

        if (insertError) {
            console.error('Create identity error:', insertError)
            return NextResponse.json({ error: 'Failed to create identity' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            identity: newIdentity,
            remaining_slots: MAX_IDENTITIES - ((count ?? 0) + 1),
        })
    } catch (err) {
        console.error('Personas POST error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
