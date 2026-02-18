import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkModeration } from '@/lib/moderation'

export async function POST(request: Request) {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Moderation gate
    const moderationGate = await checkModeration(user.id)
    if (!moderationGate.allowed) {
        return NextResponse.json(moderationGate.response, { status: moderationGate.status })
    }

    try {
        const body = await request.json()
        const { look_id } = body

        if (!look_id) {
            return NextResponse.json({ error: 'Missing look_id' }, { status: 400 })
        }

        // Get the look with identity + garments
        const { data: look, error: lookErr } = await supabase
            .from('current_looks')
            .select('*, identities(master_identity_url)')
            .eq('id', look_id)
            .single()

        if (lookErr || !look) {
            return NextResponse.json({ error: 'Look not found' }, { status: 404 })
        }

        const identityUrl = (look as Record<string, unknown>).identities &&
            ((look as Record<string, unknown>).identities as Record<string, string>)?.master_identity_url

        if (!identityUrl) {
            return NextResponse.json({ error: 'No master identity found' }, { status: 400 })
        }

        const garments = (look.garments || []) as Array<{ image_url: string }>
        const garmentUrls = garments.map((g) => g.image_url).filter(Boolean)

        if (garmentUrls.length === 0) {
            return NextResponse.json({ error: 'No garments in look' }, { status: 400 })
        }

        // Update status
        await supabase.from('current_looks').update({ status: 'rendering' }).eq('id', look_id)

        // Call worker
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            try {
                await fetch(`${workerUrl}/webhook/outfit-tryon`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                    },
                    body: JSON.stringify({
                        look_id,
                        identity_url: identityUrl,
                        garment_urls: garmentUrls
                    })
                })
            } catch (workerError) {
                console.error('Worker call failed:', workerError)
            }
        }

        return NextResponse.json({ success: true, look_id })
    } catch (err) {
        console.error('Outfit Try-On API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
