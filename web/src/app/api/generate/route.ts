import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkModeration } from '@/lib/moderation'
import { deductCredits, getCreditCost } from '@/lib/credit-router'
import { sanitizePrompt } from '@/lib/prompt-safety'

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

        const body = await request.json()
        const { shots, prompt, model, tier, provider_metadata, workspace_id, is4k, anchorStyle } = body

        // ── Rate Limit: max 10 jobs/minute per user ─────────────
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
        const { count: recentJobs } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', oneMinuteAgo)

        if ((recentJobs ?? 0) >= 10) {
            return NextResponse.json({
                error: 'rate_limited',
                message: 'Too many requests. Please wait a minute before generating again.',
            }, { status: 429 })
        }

        // ── Credit Deduction ─────────────────────────────────────
        const selectedEngine = model || 'veo-3.1-fast'
        const creditCost = getCreditCost(selectedEngine)
        if (creditCost > 0) {
            const result = await deductCredits(user.id, selectedEngine)
            if (!result.ok) {
                return NextResponse.json({
                    error: 'insufficient_credits',
                    required: result.required,
                    balance: result.balance,
                    message: `You need ${result.required} credit(s) but only have ${result.balance}`,
                }, { status: 402 })
            }
        }

        // Support both new Storyboard (shots array) and legacy Single Shot (prompt)
        // If 'shots' is present, use it. Otherwise wrap 'prompt' in a single shot.
        const workItems = shots ? shots : [{
            id: Math.random().toString(),
            prompt,
            duration: provider_metadata?.duration || 5
        }]

        const createdJobs = []

        // Iterate through all shots and create jobs
        for (const item of workItems) {
            const { data: job, error: dbError } = await supabase
                .from('jobs')
                .insert({
                    project_id: workspace_id,
                    user_id: user.id,
                    status: 'pending',
                    input_params: {
                        prompt: sanitizePrompt(item.action ? `${item.prompt}. Action: ${item.action}` : item.prompt),
                        style_ref: anchorStyle
                    },
                    model: model, // Main model for all for now
                    tier: tier || 'draft',
                    provider_metadata: {
                        ...provider_metadata,
                        duration: item.duration,
                        resolution: is4k ? '4k' : '720p',
                        camera_move: item.cameraMove
                    },
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (dbError) {
                console.error('Database error:', dbError)
                continue // Skip failed usage
            }

            createdJobs.push(job)

            // Call Railway Worker Webhook for each job
            const workerUrl = process.env.RAILWAY_WORKER_URL
            if (workerUrl) {
                try {
                    await fetch(`${workerUrl}/webhook/generate`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                        },
                        body: JSON.stringify({
                            job_id: job.id,
                            prompt: sanitizePrompt(item.action ? `${item.prompt}. Action: ${item.action}` : item.prompt),
                            model: model,
                            tier: tier || 'draft',
                            provider_metadata: {
                                ...provider_metadata,
                                duration: item.duration,
                                resolution: is4k ? '4k' : '720p',
                                camera_move: item.cameraMove,
                                style_ref: anchorStyle
                            }
                        })
                    })
                } catch (workerError) {
                    console.error('Worker call failed:', workerError)
                }
            }
        }

        return NextResponse.json({ success: true, jobs: createdJobs })
    } catch (err) {
        console.error("API Route Error", err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
