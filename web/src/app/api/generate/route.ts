import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { prompt, workspace_id, image_refs, model } = body

        // Create job in Supabase
        const { data: job, error: dbError } = await supabase
            .from('jobs')
            .insert({
                project_id: workspace_id, // Simplified: using workspace_id as project_id for prototype
                status: 'pending',
                input_params: { prompt, image_refs },
                model,
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (dbError) {
            console.error('Database error:', dbError)
            return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
        }

        // Call Railway Worker Webhook
        const workerUrl = process.env.RAILWAY_WORKER_URL
        let workerDebug = "skipped (no URL)"

        if (workerUrl) {
            try {
                const res = await fetch(`${workerUrl}/webhook/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job_id: job.id,
                        prompt,
                        model,
                        image_refs,
                        duration: 5
                    })
                })
                workerDebug = res.ok ? "success" : `failed (${res.status})`
            } catch (workerError) {
                console.error('Worker call failed:', workerError)
                workerDebug = `error: ${workerError}`
            }
        } else {
            console.error("RAILWAY_WORKER_URL is not set")
        }

        return NextResponse.json({ job, workerDebug })
    } catch (err) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
