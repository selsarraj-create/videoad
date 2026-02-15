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

        // Poll until identity is validated (worker may still be processing)
        let identity = null
        for (let attempt = 0; attempt < 15; attempt++) {
            const { data: row, error: fetchErr } = await supabase
                .from('identities')
                .select('*')
                .eq('id', identity_id)
                .single()

            if (fetchErr || !row) {
                return NextResponse.json({ error: 'Identity not found' }, { status: 404 })
            }

            if (row.status === 'validated') {
                identity = row
                break
            }

            if (row.status === 'failed') {
                return NextResponse.json({ error: 'Identity validation failed' }, { status: 400 })
            }

            // Wait 2s before retrying (up to 30s total)
            await new Promise(resolve => setTimeout(resolve, 2000))
        }

        if (!identity) {
            return NextResponse.json({ error: 'Identity validation timed out' }, { status: 408 })
        }

        // Update status to generating
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
        } else {
            console.error('RAILWAY_WORKER_URL is not set')
        }

        return NextResponse.json({ success: true, identity_id })
    } catch (err) {
        console.error('Generate Identity API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
