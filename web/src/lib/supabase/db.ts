import { createClient } from '@supabase/supabase-js'

/**
 * Service-role admin client for API routes.
 * Uses the Supavisor pooler URL (transaction mode, port 6543)
 * when available to support hundreds of concurrent serverless connections.
 *
 * Pooler URL format:
 *   postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres
 */
export const supabaseAdmin = createClient(
    process.env.SUPABASE_POOLER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        db: { schema: 'public' },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
)
