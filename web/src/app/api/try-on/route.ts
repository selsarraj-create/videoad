import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getActiveIdentity } from '@/lib/identity-middleware'
import { checkModeration } from '@/lib/moderation'

export async function POST(request: Request) {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // ── Moderation Gate ──────────────────────────────────────
        const moderationGate = await checkModeration(user.id)
        if (!moderationGate.allowed) {
            return NextResponse.json(moderationGate.response, { status: moderationGate.status })
        }

        // ── Rate Limit: max 20 try-ons/minute per user ──────────
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
        const { count: recentJobs } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('tier', 'try_on')
            .gte('created_at', oneMinuteAgo)

        if ((recentJobs ?? 0) >= 20) {
            return NextResponse.json({
                error: 'rate_limited',
                message: 'Too many try-on requests. Please wait a minute.',
            }, { status: 429 })
        }

        const body = await request.json()
        let { person_image_url, garment_image_url, identity_id, marketplace_source } = body

        // Resolve identity via middleware (validates ownership + falls back to default)
        if (!person_image_url) {
            const activeIdentity = await getActiveIdentity(supabase, user.id, identity_id)
            if (activeIdentity?.master_identity_url) {
                person_image_url = activeIdentity.master_identity_url
                identity_id = activeIdentity.id
            }
        }

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
                user_id: user.id,
                status: 'pending',
                input_params: {
                    person_image_url,
                    garment_image_url,
                    pipeline: 'try_on'
                },
                model: 'fashn',
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
                headers: {
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                },
                body: JSON.stringify({
                    job_id: job.id,
                    person_image_url,
                    garment_image_url,
                    marketplace_source
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
