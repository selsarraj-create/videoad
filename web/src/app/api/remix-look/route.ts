import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const showcaseId = searchParams.get('id')

    if (!showcaseId) {
        return NextResponse.json({ error: 'Showcase ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    try {
        const { data: showcase, error } = await supabase
            .from('public_showcase')
            .select('garment_metadata, person_image_url, persona_id')
            .eq('id', showcaseId)
            .single()

        if (error || !showcase) {
            console.error('Showcase lookup error:', error)
            return NextResponse.json({ error: 'Showcase item not found' }, { status: 404 })
        }

        // Return the metadata ready for the Claid engine
        return NextResponse.json({
            success: true,
            remixData: {
                garment_metadata: showcase.garment_metadata,
                persona_id: showcase.persona_id
            }
        })
    } catch (err) {
        console.error('Remix API Error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
