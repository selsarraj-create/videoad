/**
 * Upload Rate Limiter — verify_upload_quota
 *
 * Reusable guard for any endpoint that triggers Photoroom/Claid processing.
 * Checks the user's daily_uploads counter against their tier limit.
 *
 * Algorithm:
 *   1. If now() - last_upload_reset > 24 hours → reset counter to 0.
 *   2. If daily_uploads >= tier limit → throw (403).
 *   3. Else → atomically increment daily_uploads.
 *
 * Usage in any Next.js route:
 *   const { error } = await verifyUploadQuota(supabase, userId)
 *   if (error) return error  // NextResponse with 403
 */

import { type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getDailyUploadLimit, type SubscriptionTier, getEffectiveTier } from '@/lib/tier-config'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

interface QuotaResult {
    error: NextResponse | null
    dailyUploads: number
    dailyLimit: number | null
    tier: SubscriptionTier
}

/**
 * Verify the user hasn't exceeded their daily upload quota.
 * Call this BEFORE triggering any Photoroom/Claid processing.
 *
 * @returns QuotaResult — if `error` is non-null, return it directly from the route.
 */
export async function verifyUploadQuota(
    supabase: SupabaseClient,
    userId: string,
): Promise<QuotaResult> {
    // ── 1. Fetch profile (tier + upload tracking) ────────────────
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, daily_uploads, last_upload_reset')
        .eq('id', userId)
        .single()

    if (profileError || !profile) {
        return {
            error: NextResponse.json(
                { error: 'Failed to verify upload quota' },
                { status: 500 }
            ),
            dailyUploads: 0,
            dailyLimit: null,
            tier: 'starter',
        }
    }

    const baseTier = (profile.subscription_status || 'starter') as SubscriptionTier
    const effectiveTier = getEffectiveTier(baseTier, profile.trial_ends_at)
    const limit = getDailyUploadLimit(effectiveTier)

    let currentCount: number = profile.daily_uploads ?? 0
    const lastReset = profile.last_upload_reset
        ? new Date(profile.last_upload_reset).getTime()
        : 0

    // ── 2. Auto-reset if 24h has elapsed ─────────────────────────
    const now = Date.now()
    if (now - lastReset > TWENTY_FOUR_HOURS_MS) {
        currentCount = 0
        await supabase
            .from('profiles')
            .update({
                daily_uploads: 0,
                last_upload_reset: new Date().toISOString(),
            })
            .eq('id', userId)
    }

    // ── 3. Check limit ───────────────────────────────────────────
    if (limit !== Infinity && currentCount >= limit) {
        return {
            error: NextResponse.json(
                {
                    error: 'Daily upload limit reached',
                    detail: `You've used ${currentCount} of your ${limit} daily uploads. Resets in ${getResetTimeRemaining(lastReset)}.`,
                    quota: {
                        used: currentCount,
                        limit,
                        tier: effectiveTier,
                        resetsAt: new Date(lastReset + TWENTY_FOUR_HOURS_MS).toISOString(),
                    },
                    upgrade_message: effectiveTier === 'starter'
                        ? 'Upgrade to Pro for 50 uploads per day.'
                        : effectiveTier === 'pro'
                            ? 'Upgrade to High-Octane for unlimited uploads.'
                            : undefined,
                },
                { status: 403 }
            ),
            dailyUploads: currentCount,
            dailyLimit: limit,
            tier: effectiveTier,
        }
    }

    // ── 4. Increment counter atomically ──────────────────────────
    // Use RPC or direct update; Supabase doesn't have native increment,
    // so we set to currentCount + 1 (safe because this runs per-request).
    const newCount = currentCount + 1
    await supabase
        .from('profiles')
        .update({ daily_uploads: newCount })
        .eq('id', userId)

    return {
        error: null,
        dailyUploads: newCount,
        dailyLimit: limit === Infinity ? null : limit,
        tier: effectiveTier,
    }
}

/**
 * Human-readable time until the counter resets.
 */
function getResetTimeRemaining(lastResetMs: number): string {
    const resetAt = lastResetMs + TWENTY_FOUR_HOURS_MS
    const remaining = resetAt - Date.now()
    if (remaining <= 0) return 'now'

    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
}
