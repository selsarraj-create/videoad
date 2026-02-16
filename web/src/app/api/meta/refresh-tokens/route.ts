import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshLongLivedToken } from '@/lib/meta-client'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/meta/refresh-tokens
 * 
 * Cron-safe endpoint that refreshes Meta long-lived tokens
 * expiring within the next 10 days. Designed to be called daily.
 * 
 * Protected by CRON_SECRET header.
 */
export async function POST(request: Request) {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Find tokens expiring within 10 days
        const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)

        const { data: expiring, error: fetchError } = await supabase
            .from('instagram_connections')
            .select('id, user_id, access_token, ig_username, token_expires_at')
            .eq('is_active', true)
            .lt('token_expires_at', tenDaysFromNow.toISOString())

        if (fetchError) {
            console.error('[Token Refresh] Query error:', fetchError)
            return NextResponse.json({ error: 'Query failed' }, { status: 500 })
        }

        if (!expiring || expiring.length === 0) {
            return NextResponse.json({ message: 'No tokens need refresh', refreshed: 0 })
        }

        let refreshed = 0
        let failed = 0
        const results: Array<{ username: string; status: string }> = []

        for (const conn of expiring) {
            try {
                const newToken = await refreshLongLivedToken(conn.access_token)
                const newExpiry = new Date(Date.now() + newToken.expires_in * 1000)

                await supabase
                    .from('instagram_connections')
                    .update({
                        access_token: newToken.access_token,
                        token_expires_at: newExpiry.toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', conn.id)

                refreshed++
                results.push({ username: conn.ig_username || conn.user_id, status: 'refreshed' })
                console.log(`[Token Refresh] Refreshed @${conn.ig_username} — new expiry: ${newExpiry.toISOString()}`)

            } catch (refreshErr: any) {
                failed++
                results.push({ username: conn.ig_username || conn.user_id, status: `failed: ${refreshErr.message}` })
                console.error(`[Token Refresh] Failed for @${conn.ig_username}:`, refreshErr.message)

                // Mark as inactive if token is truly expired
                if (refreshErr.message.includes('expired') || refreshErr.message.includes('invalid')) {
                    await supabase
                        .from('instagram_connections')
                        .update({ is_active: false, updated_at: new Date().toISOString() })
                        .eq('id', conn.id)
                }
            }
        }

        return NextResponse.json({
            message: `Refresh complete: ${refreshed} refreshed, ${failed} failed`,
            refreshed,
            failed,
            results,
        })

    } catch (err: any) {
        console.error('[Token Refresh] Fatal error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
