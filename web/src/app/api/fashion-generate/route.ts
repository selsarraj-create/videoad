import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const { garment_image_url, preset_id, aspect_ratio = '9:16', identity_master_id } = body

        if (!garment_image_url || !preset_id) {
            return NextResponse.json(
                { error: 'Missing garment_image_url or preset_id' },
                { status: 400 }
            )
        }

        // Resolve identity_image_url from persona slot if provided
        let identity_image_url: string | null = null
        if (identity_master_id) {
            const { data: persona } = await supabase
                .from('identity_masters')
                .select('identity_image_url')
                .eq('id', identity_master_id)
                .single()
            if (persona?.identity_image_url) {
                identity_image_url = persona.identity_image_url
            }
        }

        // Get first available workspace/project (auth disabled)
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
                status: 'pending',
                input_params: {
                    garment_image_url,
                    preset_id,
                    pipeline: 'fashion'
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job_id: job.id,
                        garment_image_url,
                        preset_id,
                        aspect_ratio,
                        identity_master_id: identity_master_id || '',
                        identity_image_url: identity_image_url || ''
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
