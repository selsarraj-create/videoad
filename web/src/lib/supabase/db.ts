import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Lazily-initialized service-role admin client for API routes.
 *
 * The Supabase JS SDK communicates over HTTP (PostgREST), NOT direct
 * Postgres connections. Supavisor connection pooling happens at the
 * infrastructure level — the SDK is already pool-friendly by design.
 */
let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
    if (!_client) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!url || !key) {
            throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
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
