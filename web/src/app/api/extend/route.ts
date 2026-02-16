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

    try {
        // Moderation gate
        const moderationGate = await checkModeration(user.id)
        if (!moderationGate.allowed) {
            return NextResponse.json(moderationGate.response, { status: moderationGate.status })
        }

        const body = await request.json()
        const { job_id, prompt } = body

        if (!job_id || !prompt) {
            return NextResponse.json({ error: 'Missing job_id or prompt' }, { status: 400 })
        }

        // 1. Fetch original job
        const { data: originalJob, error: fetchError } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', job_id)
            .single()

        if (fetchError || !originalJob) {
            return NextResponse.json({ error: 'Original job not found' }, { status: 404 })
        }

        if (originalJob.status !== 'completed' || !originalJob.output_url) {
            return NextResponse.json({ error: 'Can only extend completed videos' }, { status: 400 })
        }

        // Get the task ID from provider_metadata (set by polling) or use empty
        const originalTaskId = originalJob.provider_metadata?.extend_task_id ||
            originalJob.provider_metadata?.task_id || ''
        const aspectRatio = originalJob.provider_metadata?.aspect_ratio || '16:9'

        // 2. Create new job row for the extended video
        const { data: newJob, error: dbError } = await supabase
            .from('jobs')
            .insert({
                project_id: originalJob.project_id,
                user_id: user.id,
                status: 'pending',
                input_params: {
                    prompt: `[Extended] ${prompt}`,
                    original_job_id: job_id
                },
                model: originalJob.model,
                tier: 'extend',
                provider_metadata: {
                    aspect_ratio: aspectRatio,
                    original_job_id: job_id,
                    original_task_id: originalTaskId
                },
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (dbError || !newJob) {
            console.error('DB error creating extend job:', dbError)
            return NextResponse.json({ error: 'Failed to create extend job' }, { status: 500 })
        }

        // 3. Call worker
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            try {
                await fetch(`${workerUrl}/webhook/extend`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                    },
                    body: JSON.stringify({
                        job_id: newJob.id,
                        original_task_id: originalTaskId,
                        prompt,
                        video_url: originalJob.output_url,
                        aspect_ratio: aspectRatio
                    })
                })
            } catch (workerError) {
                console.error('Worker extend call failed:', workerError)
            }
        }

        return NextResponse.json({ success: true, job: newJob })
    } catch (err) {
        console.error("Extend API Error", err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
