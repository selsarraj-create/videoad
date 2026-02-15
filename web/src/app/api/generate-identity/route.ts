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

        // Fire worker call — DO NOT await the response.
        // The worker runs synchronously (keeps Railway container alive),
        // but Vercel would timeout if we waited. Frontend polls the DB instead.
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (!workerUrl) {
            return NextResponse.json({ error: 'Worker not configured' }, { status: 503 })
        }

        fetch(`${workerUrl}/webhook/generate-identity`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
            },
            body: JSON.stringify({
                identity_id,
                selfie_url: identity.raw_selfie_url
            }),
        }).catch(err => console.error('Worker fire-and-forget error:', err))

        // Return immediately — frontend will poll DB for ready/failed
        return NextResponse.json({ success: true, identity_id })
    } catch (err) {
        console.error('Generate Identity API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
