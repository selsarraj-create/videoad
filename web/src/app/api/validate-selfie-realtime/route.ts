import { NextResponse } from 'next/server'

/**
 * POST /api/validate-selfie-realtime
 * 
 * Lightweight validation endpoint for real-time camera analysis.
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
            // Fallback for when worker isn't configured
            return NextResponse.json({
                passed: false,
                checks: [
                    { name: "pose", passed: false, message: "System config error" },
                    { name: "lighting", passed: false, message: "Worker URL missing" },
                    { name: "attire", passed: false, message: "Check server logs" },
                    { name: "resolution", passed: false, message: "Contact admin" },
                ]
            })
        }

        try {
            const res = await fetch(`${workerUrl}/webhook/validate-selfie-realtime`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': process.env.WORKER_SHARED_SECRET || '',
                },
                body: JSON.stringify({ image_data }),
            })

            if (!res.ok) {
                const errText = await res.text()
                console.error('Worker validation error:', res.status, errText)
                return NextResponse.json({
                    error: `Worker error: ${res.status}`,
                    checks: [
                        { name: "pose", passed: false, message: "Analysis failed" },
                        { name: "lighting", passed: false, message: "Server error" },
                        { name: "attire", passed: false, message: "Try again" },
                        { name: "resolution", passed: false, message: `Code ${res.status}` },
                    ]
                }, { status: 502 })
            }

            const result = await res.json()
            return NextResponse.json(result)

        } catch (fetchErr: any) {
            console.error('Worker fetch failed:', fetchErr)
            const msg = fetchErr.name === 'AbortError' ? 'Timeout' : 'Connection failed'

            return NextResponse.json({
                error: msg,
                checks: [
                    { name: "pose", passed: false, message: msg },
                    { name: "lighting", passed: false, message: "Worker unreachable" },
                    { name: "attire", passed: false, message: "Check connection" },
                    { name: "resolution", passed: false, message: "Retry soon" },
                ]
            }, { status: 503 })
        }
    } catch (err) {
        console.error('Realtime Validate API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
