import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    // Auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { image_data } = body

        if (!image_data) {
            return NextResponse.json({ error: 'Missing image_data' }, { status: 400 })
        }

        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (!workerUrl) {
            return NextResponse.json({ error: 'Worker not configured' }, { status: 503 })
        }

        const resp = await fetch(`${workerUrl}/webhook/validate-upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
            },
            body: JSON.stringify({ image_data }),
        })

        if (!resp.ok) {
            return NextResponse.json({ error: 'Worker validation failed' }, { status: 502 })
        }

        const result = await resp.json()
        return NextResponse.json(result)
    } catch (err) {
        console.error('Validate Upload API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
