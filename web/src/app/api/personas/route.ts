import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

const MAX_IDENTITIES = 5

// GET — List ready personas for the authenticated user
export async function GET() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { data, error } = await supabase
            .from('identities')
            .select('id, name, master_identity_url, is_default, status, created_at')
            .eq('user_id', user.id)
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

        // Check ownership and default status
        const { data: identity } = await supabase
            .from('identities')
            .select('is_default, user_id')
            .eq('id', id)
            .single()

        if (!identity || identity.user_id !== user.id) {
            return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
        }

        const wasDefault = identity.is_default

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

        // If deleted persona was default, promote the oldest remaining ready one
        if (wasDefault) {
            const { data: remaining } = await supabase
                .from('identities')
                .select('id')
                .eq('user_id', user.id)
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
                name,
                is_default: isDefault,
                status: 'pending',
            })
            .select('id, name, is_default, status')
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
