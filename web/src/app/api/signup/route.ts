import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        // Check for both variable names to be safe
        const serviceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

        // Check env vars are present
        if (!supabaseUrl || !serviceRoleKey) {
            console.error('Missing env vars:', {
                hasUrl: !!supabaseUrl,
                hasKey: !!serviceRoleKey,
            })
            return NextResponse.json(
                { error: 'Server configuration error — missing environment variables' },
                { status: 500 }
            )
        }

        const { email, password } = await request.json()

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            )
        }

        // Use service-role client to bypass email confirmation
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        })

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (error) {
            console.error('Supabase createUser error:', error.message)
            // Handle duplicate email
            if (error.message.includes('already been registered') || error.message.includes('already exists')) {
                return NextResponse.json(
                    { error: 'An account with this email already exists' },
                    { status: 409 }
                )
            }
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, userId: data.user.id })
    } catch (err) {
        console.error('Signup route exception:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
