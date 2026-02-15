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

        // Call worker — now synchronous, waits for generation to complete
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (!workerUrl) {
            return NextResponse.json({ error: 'Worker not configured' }, { status: 503 })
        }

        const workerResp = await fetch(`${workerUrl}/webhook/generate-identity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identity_id,
                selfie_url: identity.raw_selfie_url
            }),
            signal: AbortSignal.timeout(200_000), // 200s timeout for Gemini image gen
        })

        if (!workerResp.ok) {
            const errData = await workerResp.json().catch(() => ({}))
            console.error('Worker generation failed:', errData)
            return NextResponse.json({ error: errData.message || 'Generation failed' }, { status: 502 })
        }

        // Check final status in DB
        const { data: finalRow } = await supabase
            .from('identities')
            .select('status, master_identity_url')
            .eq('id', identity_id)
            .single()

        if (finalRow?.status === 'ready' && finalRow.master_identity_url) {
            return NextResponse.json({ success: true, identity_id, master_identity_url: finalRow.master_identity_url })
        }

        // If worker returned OK but status isn't ready, poll briefly
        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000))
            const { data: row } = await supabase
                .from('identities')
                .select('status, master_identity_url')
                .eq('id', identity_id)
                .single()
            if (row?.status === 'ready') {
                return NextResponse.json({ success: true, identity_id, master_identity_url: row.master_identity_url })
            }
            if (row?.status === 'failed') {
                return NextResponse.json({ error: 'Identity generation failed' }, { status: 500 })
            }
        }

        return NextResponse.json({ error: 'Generation timed out' }, { status: 408 })
    } catch (err) {
        console.error('Generate Identity API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
