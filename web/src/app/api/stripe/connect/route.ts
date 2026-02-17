import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

/**
 * POST /api/stripe/connect
 *
 * Creator onboarding — creates a Stripe Express account (if needed)
 * and returns the onboarding URL for the frontend to redirect to.
 */
export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Verify creator role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role, stripe_account_id')
            .eq('id', user.id)
            .single()

        if (!profile) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
        }

        if (profile.role !== 'creator' && profile.role !== 'admin') {
            return NextResponse.json({ error: 'Only creators can onboard to Stripe Connect' }, { status: 403 })
        }

        let stripeAccountId = profile.stripe_account_id

        // Create Express account if it doesn't exist
        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                capabilities: {
                    transfers: { requested: true },
                },
                business_type: 'individual',
                metadata: {
                    user_id: user.id,
                    platform: 'videoad',
                },
            })

            stripeAccountId = account.id

            // Store the Stripe account ID
            await supabase
                .from('profiles')
                .update({ stripe_account_id: stripeAccountId })
                .eq('id', user.id)
        }

        // Generate onboarding link
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?stripe_refresh=true`,
            return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?stripe_connected=true`,
            type: 'account_onboarding',
        })

        return NextResponse.json({ url: accountLink.url })
    } catch (error: any) {
        console.error('Stripe Connect error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
