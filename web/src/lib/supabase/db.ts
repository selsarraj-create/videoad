import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazily-initialized service-role admin client for API routes.
 * Uses the Supavisor pooler URL (transaction mode, port 6543)
 * when available. Lazy init avoids build-time crashes when
 * env vars aren't set during `next build`.
 */
let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
    if (!_client) {
        const url = process.env.SUPABASE_POOLER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) {
            throw new Error('SUPABASE_POOLER_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
        }
        _client = createClient(url, key, {
            db: { schema: 'public' },
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        })
    }
    return _client
}
