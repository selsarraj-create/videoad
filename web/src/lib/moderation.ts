/**
 * Account Moderation Middleware
 * 
 * 3-tier escalation system for Kie.ai / Fashn API safety violations:
 *   Strike 1-2: Warning only → popup "Safety Filter Triggered"
 *   Strike 3:   24-hour ban → "Cool-Down" mode, generate disabled
 *   2nd ban/mo:  Permanent lock → account suspended, credits refunded
 * 
 * Usage in API routes:
 *   const gate = await checkModeration(userId)
 *   if (!gate.allowed) return NextResponse.json(gate.response, { status: gate.status })
 *   ... after API call ...
 *   if (apiRejected) await recordViolation(userId, 'safety_filter', 'kie', jobId, details)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null
function getSupabase() {
    if (!_supabase) {
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
        _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!)
    }
    return _supabase
}

export type AccountStatus = 'active' | 'cooldown' | 'suspended'

export interface ModerationGate {
    allowed: boolean
    status: number
    response: {
        error: string
        moderation: {
            account_status: AccountStatus
            strike_count: number
            cooldown_until?: string
            message: string
        }
    }
}

// ── Check if user is allowed to generate ─────────────────────────

export async function checkModeration(userId: string): Promise<ModerationGate> {
    const { data: profile } = await getSupabase()
        .from('profiles')
        .select('account_status, cooldown_until')
        .eq('id', userId)
        .single()

    const accountStatus = (profile?.account_status || 'active') as AccountStatus
    const cooldownUntil = profile?.cooldown_until

    // Permanent suspension
    if (accountStatus === 'suspended') {
        return {
            allowed: false,
            status: 403,
            response: {
                error: 'account_suspended',
                moderation: {
                    account_status: 'suspended',
                    strike_count: -1,
                    message: 'Your account has been permanently suspended due to repeated safety violations. Any remaining credits have been refunded.',
                },
            },
        }
    }

    // Cooldown — check if it has expired
    if (accountStatus === 'cooldown') {
        if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
            const remaining = Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / (1000 * 60 * 60))
            return {
                allowed: false,
                status: 429,
                response: {
                    error: 'cooldown_active',
                    moderation: {
                        account_status: 'cooldown',
                        strike_count: 3,
                        cooldown_until: cooldownUntil,
                        message: `Your account is in Cool-Down mode. Generation will be re-enabled in ~${remaining}h.`,
                    },
                },
            }
        }

        // Cooldown expired — reactivate
        await getSupabase()
            .from('profiles')
            .update({ account_status: 'active', cooldown_until: null })
            .eq('id', userId)
    }

    // Active — allowed
    return {
        allowed: true,
        status: 200,
        response: {
            error: '',
            moderation: {
                account_status: 'active',
                strike_count: 0,
                message: '',
            },
        },
    }
}

// ── Record a violation and apply consequences ────────────────────

export async function recordViolation(
    userId: string,
    violationType: 'safety_filter' | 'banned_content' | 'api_rejection',
    sourceApi: 'kie' | 'fashn' | 'internal',
    jobId?: string,
    details?: Record<string, unknown>,
): Promise<{
    consequence: 'warning' | 'cooldown' | 'suspended'
    strike_count: number
    message: string
}> {
    // 1. Log the violation
    await getSupabase().from('content_violations').insert({
        user_id: userId,
        violation_type: violationType,
        source_api: sourceApi,
        job_id: jobId || null,
        details: details || {},
    })

    // 2. Count strikes this month
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { count } = await getSupabase()
        .from('content_violations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())

    const strikeCount = count ?? 0

    // 3. Count cooldowns this month (how many times we've put them in cooldown)
    const { count: cooldownCount } = await getSupabase()
        .from('content_violations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('violation_type', 'cooldown_applied')
        .gte('created_at', monthStart.toISOString())

    const priorCooldowns = cooldownCount ?? 0

    // ── Strike 1-2: Warning ──
    if (strikeCount <= 2) {
        return {
            consequence: 'warning',
            strike_count: strikeCount,
            message: 'Safety Filter Triggered. Please review guidelines.',
        }
    }

    // ── Strike 3: 24-hour cooldown ──
    if (strikeCount === 3 && priorCooldowns === 0) {
        const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

        await getSupabase()
            .from('profiles')
            .update({ account_status: 'cooldown', cooldown_until: cooldownUntil })
            .eq('id', userId)

        // Log the cooldown event itself
        await getSupabase().from('content_violations').insert({
            user_id: userId,
            violation_type: 'cooldown_applied',
            source_api: 'internal',
            details: { cooldown_until: cooldownUntil, trigger_strike: strikeCount },
        })

        return {
            consequence: 'cooldown',
            strike_count: strikeCount,
            message: 'Your account has entered Cool-Down mode. Generation is disabled for 24 hours.',
        }
    }

    // ── 2nd ban (already had a cooldown this month): Permanent suspension ──
    if (priorCooldowns >= 1) {
        // Suspend account
        await getSupabase()
            .from('profiles')
            .update({
                account_status: 'suspended',
                suspension_reason: `Repeated safety violations (${strikeCount} strikes, ${priorCooldowns + 1} cooldowns in month)`,
            })
            .eq('id', userId)

        // Refund remaining credits
        const { data: profile } = await getSupabase()
            .from('profiles')
            .select('credit_balance')
            .eq('id', userId)
            .single()

        if (profile?.credit_balance && profile.credit_balance > 0) {
            // Log refund as a credit transaction
            await getSupabase().from('credit_transactions').insert({
                user_id: userId,
                amount: profile.credit_balance,
                type: 'refund',
                description: `Credit refund on account suspension (${profile.credit_balance} credits)`,
            })

            await getSupabase()
                .from('profiles')
                .update({ credit_balance: 0 })
                .eq('id', userId)
        }

        return {
            consequence: 'suspended',
            strike_count: strikeCount,
            message: 'Your account has been permanently suspended due to repeated safety violations. Any remaining credits have been refunded.',
        }
    }

    // Fallback: apply cooldown for further strikes
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await getSupabase()
        .from('profiles')
        .update({ account_status: 'cooldown', cooldown_until: cooldownUntil })
        .eq('id', userId)

    await getSupabase().from('content_violations').insert({
        user_id: userId,
        violation_type: 'cooldown_applied',
        source_api: 'internal',
        details: { cooldown_until: cooldownUntil, trigger_strike: strikeCount },
    })

    return {
        consequence: 'cooldown',
        strike_count: strikeCount,
        message: 'Your account has entered Cool-Down mode. Generation is disabled for 24 hours.',
    }
}

// ── Get user's moderation status for dashboard display ───────────

export async function getModerationStatus(userId: string): Promise<{
    account_status: AccountStatus
    strike_count: number
    cooldown_until: string | null
    recent_violations: Array<{
        id: string
        violation_type: string
        source_api: string
        created_at: string
    }>
}> {
    const { data: profile } = await getSupabase()
        .from('profiles')
        .select('account_status, cooldown_until')
        .eq('id', userId)
        .single()

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { count } = await getSupabase()
        .from('content_violations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())
        .neq('violation_type', 'cooldown_applied')

    const { data: violations } = await getSupabase()
        .from('content_violations')
        .select('id, violation_type, source_api, created_at')
        .eq('user_id', userId)
        .neq('violation_type', 'cooldown_applied')
        .order('created_at', { ascending: false })
        .limit(10)

    return {
        account_status: (profile?.account_status || 'active') as AccountStatus,
        strike_count: count ?? 0,
        cooldown_until: profile?.cooldown_until || null,
        recent_violations: violations || [],
    }
}
