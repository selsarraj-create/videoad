import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getActiveIdentity } from '@/lib/identity-middleware'

export async function POST(request: Request) {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        let { garment_image_url, preset_id, aspect_ratio = '9:16', identity_id } = body

        if (!garment_image_url || !preset_id) {
            return NextResponse.json(
                { error: 'Missing garment_image_url or preset_id' },
                { status: 400 }
            )
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
                model: 'veo-3.1-fast',
                tier: 'fashion',
                provider_metadata: { aspect_ratio, preset_id },
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
                        identity_id: identity_id || ''
                    })
                })
            } catch (workerError) {
                console.error('Worker call failed:', workerError)
            }
        }

        return NextResponse.json({ success: true, job })
    } catch (err) {
        console.error('Fashion Generate API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
