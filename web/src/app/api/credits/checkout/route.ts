import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { CREDIT_PACKS } from '@/lib/credit-router'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-16' as any,
})

/**
 * POST /api/credits/checkout
 *
 * Creates a Stripe Checkout Session for a credit pack purchase.
 * Body: { packId: 'pack-10' | 'pack-25' | 'pack-50' | 'pack-100' }
 */
export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { packId } = await request.json()

        // Find the requested pack
        const pack = CREDIT_PACKS.find(p => p.id === packId)
        if (!pack) {
            return NextResponse.json({ error: 'Invalid pack ID' }, { status: 400 })
        }

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: user.email,
            currency: 'gbp',
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: pack.label,
                            description: `${pack.credits} render credits for AI video generation`,
                        },
                        unit_amount: pack.priceGBP, // Already in pence
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                user_id: user.id,
                pack_id: pack.id,
                credits: pack.credits.toString(),
            },
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits=success&pack=${pack.id}`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?credits=cancelled`,
        })

        return NextResponse.json({ url: session.url })

    } catch (error: any) {
        console.error('Stripe Checkout Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
