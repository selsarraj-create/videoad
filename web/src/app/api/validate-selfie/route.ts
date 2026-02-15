import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const { selfie_url } = body

        if (!selfie_url) {
            return NextResponse.json({ error: 'Missing selfie_url' }, { status: 400 })
        }

        // Create identity row
        const { data: identity, error: dbError } = await supabase
            .from('identities')
            .insert({
                raw_selfie_url: selfie_url,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (dbError || !identity) {
            console.error('DB error:', dbError)
            return NextResponse.json({ error: 'Failed to create identity' }, { status: 500 })
        }

        // Call worker for validation
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            try {
                await fetch(`${workerUrl}/webhook/validate-selfie`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                    },
                    body: JSON.stringify({
                        identity_id: identity.id,
                        selfie_url
                    })
                })
            } catch (workerError) {
                console.error('Worker call failed:', workerError)
            }
        }

        return NextResponse.json({ success: true, identity })
    } catch (err) {
        console.error('Validate Selfie API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
