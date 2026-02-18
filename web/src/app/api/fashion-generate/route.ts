import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getActiveIdentity } from '@/lib/identity-middleware'
import { deductCredits, getCreditCost } from '@/lib/credit-router'
import { getEffectiveTier, canAccessEngine, type SubscriptionTier } from '@/lib/tier-config'
import { MODELS } from '@/lib/models'
import { checkModeration } from '@/lib/moderation'
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
        let { garment_image_url, preset_id, aspect_ratio = '9:16', identity_id, engine_id } = body

        if (!garment_image_url || !preset_id) {
            return NextResponse.json(
                { error: 'Missing garment_image_url or preset_id' },
                { status: 400 }
            )
        }

        // Default engine
        const selectedEngine = engine_id || 'veo-3.1-fast'

        // Validate engine exists
        const modelSpec = MODELS.find(m => m.id === selectedEngine)
        if (!modelSpec) {
            return NextResponse.json({ error: 'Invalid engine_id' }, { status: 400 })
        }

        // ── Tier Gating ──────────────────────────────────────────
        const { data: profile } = await supabase
            .from('profiles')
            .select('subscription_status, trial_ends_at, credit_balance, render_priority')
            .eq('id', user.id)
            .single()

        const baseTier = (profile?.subscription_status || 'starter') as SubscriptionTier
        const effectiveTier = getEffectiveTier(baseTier, profile?.trial_ends_at)

        // Check if user's tier allows this engine
        if (!canAccessEngine(effectiveTier, selectedEngine)) {
            return NextResponse.json({
                error: 'engine_locked',
                message: `${modelSpec.name} requires ${modelSpec.requiresTier === 'high_octane' ? 'High-Octane' : 'Pro'} tier`,
                required_tier: modelSpec.requiresTier,
            }, { status: 403 })
        }

        // ── Cache Check: skip API call if identical output exists ─
        const cacheResult = await checkGenerationCache(supabase, user.id, {
            prompt: preset_id,
            model: selectedEngine,
            aspect_ratio,
            preset_id,
        })

        if (cacheResult.found) {
            return NextResponse.json({
                success: true,
                job: {
                    id: cacheResult.job_id,
                    status: 'completed',
                    output_url: cacheResult.output_url,
                    model: cacheResult.model,
                    cached: true,
                },
                credits_deducted: 0,
                cache_hit: true,
            })
        }

        // ── Credit Deduction (only on cache miss) ────────────────
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

        // Resolve identity via middleware (validates ownership)
        const activeIdentity = await getActiveIdentity(supabase, user.id, identity_id)
        if (activeIdentity) {
            identity_id = activeIdentity.id
        }

        // Get first available workspace/project
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

        // Create job
        const { data: job, error: dbError } = await supabase
            .from('jobs')
            .insert({
                project_id: project.id,
                user_id: user.id,
                status: 'pending',
                input_params: {
                    garment_image_url,
                    preset_id,
                    pipeline: 'fashion',
                    identity_id: identity_id || ''
                },
                input_hash: cacheResult.hash,
                model: selectedEngine,
                tier: 'fashion',
                provider_metadata: {
                    aspect_ratio,
                    preset_id,
                    engine_id: selectedEngine,
                    user_credits_deducted: creditCost,
                    render_priority: profile?.render_priority || 3,
                },
                created_at: new Date().toISOString()
            })
            .select()
            .single()

        if (dbError || !job) {
            console.error('DB error:', dbError)
            return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
        }

        // Call worker
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            try {
                await fetch(`${workerUrl}/webhook/fashion-generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                    },
                    body: JSON.stringify({
                        job_id: job.id,
                        garment_image_url,
                        preset_id,
                        aspect_ratio,
                        identity_id: identity_id || '',
                        engine_id: selectedEngine,
                        render_priority: profile?.render_priority || 3,
                    })
                })
            } catch (workerError) {
                console.error('Worker call failed:', workerError)
            }
        }

        return NextResponse.json({ success: true, job, credits_deducted: creditCost })
    } catch (err) {
        console.error('Fashion Generate API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
