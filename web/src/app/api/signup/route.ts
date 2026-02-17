import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const VALID_TIERS = ['starter', 'pro', 'high_octane'] as const
const VALID_ROLES = ['creator', 'brand'] as const

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

        const { email, password, selected_tier, role, company_name } = await request.json()

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

        // Validate tier (default to 'starter' if invalid or missing)
        const tier = VALID_TIERS.includes(selected_tier) ? selected_tier : 'starter'

        // Validate role (default to 'creator' if invalid or missing)
        const userRole = VALID_ROLES.includes(role) ? role : 'creator'

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

        // Set the user's subscription tier in their profile
        const userId = data.user.id
        const now = new Date()

        // For Pro tier, grant a 7-day trial
        const trialEndsAt = tier === 'pro'
            ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : null

        // High-Octane gets 20 monthly credits
        const monthlyGrant = tier === 'high_octane' ? 20 : 0
        const initialCredits = tier === 'high_octane' ? 20 : 0

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                subscription_status: tier,
                trial_ends_at: trialEndsAt,
                credit_balance: initialCredits,
                monthly_credit_grant: monthlyGrant,
                render_priority: tier === 'high_octane' ? 1 : tier === 'pro' ? 2 : 3,
                role: userRole,
            })
            .eq('id', userId)

        if (profileError) {
            console.error('Profile tier update failed:', profileError)
            // Don't fail the signup, just log — the user was created
        }

        // If brand role, create a brands record
        if (userRole === 'brand' && company_name?.trim()) {
            const { error: brandError } = await supabaseAdmin
                .from('brands')
                .insert({
                    profile_id: userId,
                    company_name: company_name.trim(),
                })

            if (brandError) {
                console.error('Brand record creation failed:', brandError)
            }
        }

        return NextResponse.json({ success: true, userId, tier, role: userRole })
    } catch (err) {
        console.error('Signup route exception:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
