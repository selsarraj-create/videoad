import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('job_id')

    if (!jobId) {
        return NextResponse.json({ error: 'Missing job_id' }, { status: 400 })
    }

    const workerUrl = process.env.RAILWAY_WORKER_URL
    if (!workerUrl) {
        return NextResponse.json({
            position: 0,
            estimated_wait_seconds: 0,
            queue_length: 0,
            status: 'processing',
        })
    }

    try {
        const res = await fetch(`${workerUrl}/queue/status?job_id=${jobId}`, {
            headers: {
                'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
            },
        })
        const data = await res.json()
        return NextResponse.json(data)
    } catch (err) {
        console.error('Queue status error:', err)
        return NextResponse.json({
            position: 0,
            estimated_wait_seconds: 0,
            queue_length: 0,
            status: 'unknown',
        })
    }
}
