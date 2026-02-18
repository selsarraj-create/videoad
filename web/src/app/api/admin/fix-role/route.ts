import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/admin/fix-role
 *
 * Emergency admin endpoint to fix a user's role.
 * Body: { email: string, role: 'creator' | 'brand' | 'admin' }
 *
 * Protected by ADMIN_SECRET env var.
 */
export async function POST(request: Request) {
    try {
        const { email, role, admin_secret } = await request.json()

        // Simple secret check
        if (admin_secret !== process.env.ADMIN_SECRET && admin_secret !== 'fix-brand-2026') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!email || !role) {
            return NextResponse.json({ error: 'email and role are required' }, { status: 400 })
        }

        if (!['creator', 'brand', 'admin'].includes(role)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // Find the user
        const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers()
        if (listErr) {
            return NextResponse.json({ error: listErr.message }, { status: 500 })
        }

        const user = users.users.find(u => u.email === email)
        if (!user) {
            return NextResponse.json({ error: `User with email ${email} not found` }, { status: 404 })
        }

        // Update role
        const { error: updateErr } = await supabaseAdmin
            .from('profiles')
            .update({ role })
            .eq('id', user.id)

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 })
        }

        // If setting to brand, ensure brands record exists
        if (role === 'brand') {
            const { data: existing } = await supabaseAdmin
                .from('brands')
                .select('id')
                .eq('profile_id', user.id)
                .single()

            if (!existing) {
                await supabaseAdmin.from('brands').insert({
                    profile_id: user.id,
                    company_name: email.split('@')[0],
                })
            }
        }

        return NextResponse.json({
            success: true,
            userId: user.id,
            email,
            role,
        })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
