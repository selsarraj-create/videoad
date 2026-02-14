import { NextResponse } from 'next/server'

/**
 * POST /api/validate-selfie-realtime
 * 
 * Lightweight validation endpoint for real-time camera analysis.
 * Unlike /api/validate-selfie, this does NOT create a DB record.
 * It sends a base64 image frame to the worker and returns the checklist instantly.
 * 
 * Body: { image_data: string (base64 data URL) }
 * Returns: { passed: boolean, checks: [...] }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { image_data } = body

        if (!image_data) {
            return NextResponse.json({ error: 'Missing image_data' }, { status: 400 })
        }

        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (!workerUrl) {
            // Fallback mock response for dev
            return NextResponse.json({
                passed: false,
                checks: [
                    { name: "pose", passed: false, message: "Worker not configured" },
                    { name: "lighting", passed: false, message: "Worker not configured" },
                    { name: "attire", passed: false, message: "Worker not configured" },
                    { name: "resolution", passed: false, message: "Worker not configured" },
                ]
            })
        }

        const res = await fetch(`${workerUrl}/webhook/validate-selfie-realtime`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_data })
        })

        if (!res.ok) {
            const errText = await res.text()
            console.error('Worker validation error:', errText)
            return NextResponse.json({ error: 'Validation failed' }, { status: 502 })
        }

        const result = await res.json()
        return NextResponse.json(result)
    } catch (err) {
        console.error('Realtime Validate API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
