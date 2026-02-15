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
        const { project_id, job_ids } = body

        if (!project_id || !job_ids || job_ids.length === 0) {
            return NextResponse.json({ error: 'Missing project_id or job_ids' }, { status: 400 })
        }

        // 1. Fetch Job Details to get URLs
        const { data: jobs, error: jobsError } = await supabase
            .from('jobs')
            .select('output_url')
            .in('id', job_ids)
            .eq('status', 'completed')
            .order('created_at', { ascending: true }) // Ensure chronological order

        if (jobsError || !jobs) {
            return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
        }

        const video_urls = jobs.map(j => j.output_url).filter(Boolean)

        if (video_urls.length === 0) {
            return NextResponse.json({ error: 'No completed videos found to stitch' }, { status: 400 })
        }

        // 2. Call Worker Webhook
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (!workerUrl) {
            return NextResponse.json({ error: 'Worker URL not configured' }, { status: 500 })
        }

        const res = await fetch(`${workerUrl}/webhook/stitch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
            },
            body: JSON.stringify({
                project_id,
                video_urls
            })
        })

        if (!res.ok) {
            const err = await res.text()
            console.error('Worker stitch call failed:', err)
            return NextResponse.json({ error: 'Failed to start stitch job' }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Stitching started' })

    } catch (err) {
        console.error("API Route Error", err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
