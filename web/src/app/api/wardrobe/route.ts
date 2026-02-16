import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { getWardrobeLimit, type SubscriptionTier } from '@/lib/tier-config'
import crypto from 'crypto'

// ── GET — List wardrobe items for current user ──────────────────
export async function GET() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { data, error } = await supabase
            .from('wardrobe')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Wardrobe list error:', error)
            return NextResponse.json({ error: 'Failed to list wardrobe' }, { status: 500 })
        }

        // Also return quota info
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status')
            .eq('id', user.id)
            .single()

        const tier = (profile?.subscription_status || 'starter') as SubscriptionTier
        const limit = getWardrobeLimit(tier)

        return NextResponse.json({
            items: data || [],
            quota: {
                used: data?.length || 0,
                limit: limit === Infinity ? null : limit,
                tier,
            },
        })
    } catch (err) {
        console.error('Wardrobe GET error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// ── POST — Add item to wardrobe (quota check + async Claid cleaning) ──
export async function POST(request: NextRequest) {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const {
            image_url,
            title = 'Untitled',
            source = 'upload',
            affiliate_url = null,
        } = body

        if (!image_url) {
            return NextResponse.json({ error: 'Missing image_url' }, { status: 400 })
        }

        // ── Quota Check ("Bouncer") ──────────────────────────────
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status')
            .eq('id', user.id)
            .single()

        const tier = (profile?.subscription_status || 'starter') as SubscriptionTier
        const limit = getWardrobeLimit(tier)

        const { count, error: countError } = await supabase
            .from('wardrobe')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)

        if (countError) {
            return NextResponse.json({ error: 'Failed to check quota' }, { status: 500 })
        }

        if ((count ?? 0) >= limit) {
            return NextResponse.json({
                error: 'Wardrobe quota exceeded',
                quota: {
                    used: count ?? 0,
                    limit: limit === Infinity ? null : limit,
                    tier,
                },
                upgrade_message: tier === 'starter'
                    ? 'Upgrade to Pro for up to 100 wardrobe items.'
                    : tier === 'pro'
                        ? 'Upgrade to High-Octane for unlimited wardrobe items.'
                        : undefined,
            }, { status: 409 })
        }

        // ── Insert wardrobe item (pending) ──────────────────────
        const { data: item, error: insertError } = await supabase
            .from('wardrobe')
            .insert({
                user_id: user.id,
                original_image_url: image_url,
                title,
                source,
                affiliate_url,
                status: 'pending',
            })
            .select()
            .single()

        if (insertError || !item) {
            console.error('Wardrobe insert error:', insertError)
            return NextResponse.json({ error: 'Failed to add to wardrobe' }, { status: 500 })
        }

        // ── Trigger async Claid cleaning via worker ─────────────
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            const sourceUrlHash = crypto
                .createHash('sha256')
                .update(image_url)
                .digest('hex')

            // Fire and forget — don't await
            fetch(`${workerUrl}/webhooks/clean-garment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                },
                body: JSON.stringify({
                    wardrobe_id: item.id,
                    image_url,
                    source_url_hash: sourceUrlHash,
                }),
            }).catch(err => {
                console.error('Failed to trigger Claid worker:', err)
            })
        } else {
            console.warn('RAILWAY_WORKER_URL not set — skipping Claid cleaning')
            // Mark as ready without cleaning (dev fallback)
            await supabase
                .from('wardrobe')
                .update({ status: 'ready', clean_image_url: image_url })
                .eq('id', item.id)
        }

        return NextResponse.json({
            success: true,
            item,
            quota: {
                used: (count ?? 0) + 1,
                limit: limit === Infinity ? null : limit,
                tier,
            },
        })
    } catch (err) {
        console.error('Wardrobe POST error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// ── DELETE — Remove item from wardrobe ──────────────────────────
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

        const { error: deleteError } = await supabase
            .from('wardrobe')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (deleteError) {
            console.error('Wardrobe delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Wardrobe DELETE error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
