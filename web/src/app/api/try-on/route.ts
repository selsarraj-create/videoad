import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const { person_image_url, garment_image_url } = body

        if (!person_image_url || !garment_image_url) {
            return NextResponse.json(
                { error: 'Missing person_image_url or garment_image_url' },
                { status: 400 }
            )
        }

        // Get first workspace/project (auth disabled)
        const { data: workspace } = await supabase
            .from('workspaces')
            .select('id')
            .limit(1)
            .single()

        if (!workspace) {
            return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
        }

        const { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('workspace_id', workspace.id)
            .limit(1)
            .single()

        if (!project) {
            return NextResponse.json({ error: 'No project found' }, { status: 400 })
        }

        // Create try-on job
        const { data: job, error: dbError } = await supabase
            .from('jobs')
            .insert({
                project_id: project.id,
                status: 'pending',
                input_params: {
                    person_image_url,
                    garment_image_url,
                    pipeline: 'try_on'
                },
                model: 'claid',
                tier: 'try_on',
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (dbError || !job) {
            console.error('DB error:', dbError)
            return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
        }

        // Call worker — FAIL LOUDLY if not configured
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (!workerUrl) {
            console.error('RAILWAY_WORKER_URL not set — cannot process try-on')
            // Mark job as failed so the UI can pick it up
            await supabase.from('jobs').update({
                status: 'failed',
                error_message: 'Worker not configured (RAILWAY_WORKER_URL not set)'
            }).eq('id', job.id)
            return NextResponse.json({
                error: 'Worker not configured. Set RAILWAY_WORKER_URL in environment.',
                job: { ...job, status: 'failed' }
            }, { status: 503 })
        }

        try {
            const workerRes = await fetch(`${workerUrl}/webhook/try-on`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: job.id,
                    person_image_url,
                    garment_image_url
                })
            })
            if (!workerRes.ok) {
                const errText = await workerRes.text()
                console.error('Worker returned error:', workerRes.status, errText)
                await supabase.from('jobs').update({
                    status: 'failed',
                    error_message: `Worker error: ${workerRes.status}`
                }).eq('id', job.id)
                return NextResponse.json({
                    error: `Worker returned ${workerRes.status}`,
                    job: { ...job, status: 'failed' }
                }, { status: 502 })
            }
        } catch (workerError) {
            console.error('Worker call failed:', workerError)
            await supabase.from('jobs').update({
                status: 'failed',
                error_message: 'Worker unreachable'
            }).eq('id', job.id)
            return NextResponse.json({
                error: 'Worker unreachable',
                job: { ...job, status: 'failed' }
            }, { status: 502 })
        }

        return NextResponse.json({ success: true, job })
    } catch (err) {
        console.error('Try-On API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
