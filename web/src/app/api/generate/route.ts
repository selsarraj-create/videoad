import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkModeration } from '@/lib/moderation'
import { deductCredits, getCreditCost } from '@/lib/credit-router'
import { sanitizePrompt } from '@/lib/prompt-safety'
import { checkGenerationCache } from '@/lib/generation-cache'

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

        // Support both Storyboard (shots array) and single Shot (prompt)
        const workItems = shots ? shots : [{
            id: Math.random().toString(),
            prompt,
            duration: provider_metadata?.duration || 5
        }]

        const selectedEngine = model || 'veo-3.1-fast'
        const resolution = is4k ? '4k' : '720p'
        const createdJobs = []
        let cacheHits = 0

        for (const item of workItems) {
            const sanitizedPrompt = sanitizePrompt(
                item.action ? `${item.prompt}. Action: ${item.action}` : item.prompt
            )

            // ── Cache Check: skip Veo call if identical output exists ──
            const cacheResult = await checkGenerationCache(supabase, user.id, {
                prompt: sanitizedPrompt,
                model: selectedEngine,
                resolution,
                duration: item.duration || 5,
                camera_move: item.cameraMove || '',
                style_ref: anchorStyle || '',
            })

            if (cacheResult.found) {
                // Cache hit — return existing result without spending money
                createdJobs.push({
                    id: cacheResult.job_id,
                    status: 'completed',
                    output_url: cacheResult.output_url,
                    model: cacheResult.model,
                    cached: true,
                })
                cacheHits++
                continue
            }

            // ── Credit Deduction (only for cache misses) ─────────
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

            // ── Create Job (tagged with hash for future cache hits) ──
            const { data: job, error: dbError } = await supabase
                .from('jobs')
                .insert({
                    project_id: workspace_id,
                    user_id: user.id,
                    status: 'pending',
                    input_params: {
                        prompt: sanitizedPrompt,
                        style_ref: anchorStyle
                    },
                    input_hash: cacheResult.hash,
                    model: model,
                    tier: tier || 'draft',
                    provider_metadata: {
                        ...provider_metadata,
                        duration: item.duration,
                        resolution,
                        camera_move: item.cameraMove
                    },
                    created_at: new Date().toISOString()
                })
                .select()
                .single()

            if (dbError) {
                console.error('Database error:', dbError)
                continue
            }

            createdJobs.push(job)

            // Call Railway Worker Webhook
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
                            prompt: sanitizedPrompt,
                            model: model,
                            tier: tier || 'draft',
                            provider_metadata: {
                                ...provider_metadata,
                                duration: item.duration,
                                resolution,
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

        return NextResponse.json({
            success: true,
            jobs: createdJobs,
            cache_hits: cacheHits,
            cache_misses: createdJobs.length - cacheHits,
        })
    } catch (err) {
        console.error("API Route Error", err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
