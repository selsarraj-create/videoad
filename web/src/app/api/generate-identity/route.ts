import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const { identity_id } = body

        if (!identity_id) {
            return NextResponse.json({ error: 'Missing identity_id' }, { status: 400 })
        }

        // Get identity
        const { data: identity, error: fetchErr } = await supabase
            .from('identities')
            .select('*')
            .eq('id', identity_id)
            .single()

        if (fetchErr || !identity) {
            return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
        }

        if (identity.status !== 'validated') {
            return NextResponse.json({ error: 'Identity not validated yet' }, { status: 400 })
        }

        // Update status
        await supabase.from('identities').update({ status: 'generating' }).eq('id', identity_id)

        // Call worker for master identity generation
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            try {
                await fetch(`${workerUrl}/webhook/generate-identity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identity_id,
                        selfie_url: identity.raw_selfie_url
                    })
                })
            } catch (workerError) {
                console.error('Worker call failed:', workerError)
            }
        }

        return NextResponse.json({ success: true, identity_id })
    } catch (err) {
        console.error('Generate Identity API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
