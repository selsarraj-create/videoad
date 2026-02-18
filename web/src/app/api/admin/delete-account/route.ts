import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/delete-account
 *
 * Deletes the currently authenticated user's account.
 * Uses the service role key to delete the auth user.
 */
export async function POST(request: Request) {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { confirm } = await request.json()
    if (!confirm) {
        return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    try {
        // Use service role client to delete the user
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
        if (!serviceKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
        }

        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey
        )

        // Delete user data first (cascade should handle most, but be explicit)
        await adminClient.from('brands').delete().eq('profile_id', user.id)
        await adminClient.from('profiles').delete().eq('id', user.id)

        // Delete the auth user
        const { error } = await adminClient.auth.admin.deleteUser(user.id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error('Delete account error:', err)
        return NextResponse.json({ error: err.message || 'Deletion failed' }, { status: 500 })
    }
}
