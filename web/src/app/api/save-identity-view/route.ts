import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = await createClient()

    try {
        const body = await request.json()
        const { identity_id, angle, image_data, source = 'upload' } = body

        if (!identity_id || !angle || !image_data) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Upload image to Supabase storage
        const blob = Buffer.from(
            image_data.includes(',') ? image_data.split(',')[1] : image_data,
            'base64'
        )
        const fileName = `identity_views/${identity_id}/${angle}_${Date.now()}.jpg`
        const { error: uploadErr } = await supabase.storage
            .from('raw_assets')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })

        if (uploadErr) {
            console.error('Upload error:', uploadErr)
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
        }

        const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
        const imageUrl = urlData.publicUrl

        // Save the view via worker
        const workerUrl = process.env.RAILWAY_WORKER_URL
        if (workerUrl) {
            try {
                const resp = await fetch(`${workerUrl}/webhook/save-identity-view`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        identity_id,
                        angle,
                        image_url: imageUrl,
                        validation_result: body.validation_result || {},
                        source,
                    }),
                })
                const result = await resp.json()
                return NextResponse.json({ ...result, image_url: imageUrl })
            } catch (workerError) {
                console.error('Worker save failed:', workerError)
            }
        }

        // Fallback: save directly via Supabase if worker unavailable
        await supabase.from('identity_views').upsert({
            identity_id,
            angle,
            image_url: imageUrl,
            validation_result: body.validation_result || {},
            status: 'validated',
            source,
        }, { onConflict: 'identity_id,angle' })

        return NextResponse.json({ success: true, image_url: imageUrl })
    } catch (err) {
        console.error('Save Identity View API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
