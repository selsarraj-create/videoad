import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role key to auto-confirm users (bypasses email rate limits)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json()

        if (!email || !password || password.length < 6) {
            return NextResponse.json(
                { error: 'Email and password (min 6 chars) required' },
                { status: 400 }
            )
        }

        // Create user with auto-confirm via admin API
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true  // Auto-confirm, no email sent
        })

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        return NextResponse.json({ success: true, user: { id: data.user.id, email: data.user.email } })
    } catch (err) {
        console.error('Signup error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
