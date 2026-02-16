import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getModerationStatus } from '@/lib/moderation'

/**
 * GET /api/moderation
 * Returns the user's current moderation status for dashboard display.
 */
export async function GET() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = await getModerationStatus(user.id)
    return NextResponse.json(status)
}
