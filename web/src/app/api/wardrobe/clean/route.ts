import { NextResponse, NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Internal webhook called by the Claid worker after cleaning completes.
// Updates wardrobe item with clean URL and sets status to 'ready'.

let _supabase: ReturnType<typeof createServiceClient> | null = null
function getSupabase() {
    if (!_supabase) {
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
        _supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!)
    }
    return _supabase
}

export async function POST(request: NextRequest) {
    // Verify worker secret
    const secret = request.headers.get('x-worker-secret')
    if (secret !== process.env.WORKER_SHARED_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { wardrobe_id, clean_url, status = 'ready', error_message } = body

        if (!wardrobe_id) {
            return NextResponse.json({ error: 'Missing wardrobe_id' }, { status: 400 })
        }

        const supabase = getSupabase()

        const updateData: { status: string; clean_image_url?: string } = {
            status: error_message ? 'failed' : status,
        }
        if (clean_url) updateData.clean_image_url = clean_url

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wardrobe table pending type generation
        const { error: updateError } = await (supabase as any)
            .from('wardrobe')
            .update(updateData)
            .eq('id', wardrobe_id)

        if (updateError) {
            console.error('Wardrobe clean callback error:', updateError)
            return NextResponse.json({ error: 'Failed to update wardrobe' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Wardrobe clean webhook error:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
