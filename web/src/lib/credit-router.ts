/**
 * Credit Router — Deduction middleware for AI engine usage.
 *
 * Standard Path (Veo 3.1):     1 user credit
 * High-Octane Path (Kling 3.0): 3 user credits
 *
 * Credits are separate from internal Kie.ai credits.
 * User credits are the billing unit; Kie.ai credits are the cost unit.
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Credit Cost Map ────────────────────────────────────────────

export const CREDIT_COSTS: Record<string, number> = {
    'veo-3.1-fast': 1,      // Standard Path: 3x Fashn → 1x Veo 3.1
    'kling-3.0-omni': 3,    // High-Octane Path: 3x Fashn → 1x Kling 3.0
}

/**
 * Get the user-facing credit cost for an engine.
 * Returns 0 for engines not in the credit system (free-tier VTO etc.)
 */
export function getCreditCost(engineId: string): number {
    return CREDIT_COSTS[engineId] ?? 0
}

// ── Balance Queries ────────────────────────────────────────────

export async function getUserBalance(userId: string): Promise<number> {
    const { data } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single()

    return data?.credit_balance ?? 0
}

export interface CreditCheckResult {
    ok: boolean
    balance: number
    required: number
    error?: string
}

// ── Deduction ──────────────────────────────────────────────────

/**
 * Atomically deduct credits for an engine generation.
 * Returns the new balance and success status.
 *
 * If balance < required, returns 402-style error without deducting.
 */
export async function deductCredits(
    userId: string,
    engineId: string,
    jobId?: string
): Promise<CreditCheckResult> {
    const required = getCreditCost(engineId)

    // Free engines (e.g., VTO-only) don't cost credits
    if (required === 0) {
        const balance = await getUserBalance(userId)
        return { ok: true, balance, required: 0 }
    }

    // Fetch current balance
    const { data: profile, error: fetchErr } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single()

    if (fetchErr || !profile) {
        return { ok: false, balance: 0, required, error: 'profile_not_found' }
    }

    const currentBalance = profile.credit_balance ?? 0

    if (currentBalance < required) {
        return {
            ok: false,
            balance: currentBalance,
            required,
            error: 'insufficient_credits',
        }
    }

    // Deduct atomically
    const newBalance = currentBalance - required
    const { error: updateErr } = await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', userId)
        .eq('credit_balance', currentBalance) // Optimistic concurrency

    if (updateErr) {
        return { ok: false, balance: currentBalance, required, error: 'deduction_failed' }
    }

    // Log the transaction
    await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: -required,
        balance_after: newBalance,
        reason: 'generation',
        engine_id: engineId,
        job_id: jobId || null,
    })

    return { ok: true, balance: newBalance, required }
}

// ── Monthly Grant ──────────────────────────────────────────────

/**
 * Grant monthly credits to a user (called by cron on 1st of month).
 */
export async function grantMonthlyCredits(
    userId: string,
    amount: number
): Promise<void> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single()

    if (!profile) return

    const newBalance = (profile.credit_balance ?? 0) + amount

    await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', userId)

    await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount,
        balance_after: newBalance,
        reason: 'monthly_grant',
    })
}

// ── Credit Pack Purchase ───────────────────────────────────────

export const CREDIT_PACKS = [
    { id: 'pack-5', credits: 5, price: 5, label: '5 Credits' },
    { id: 'pack-15', credits: 15, price: 12, label: '15 Credits' },
    { id: 'pack-50', credits: 50, price: 35, label: '50 Credits' },
] as const

/**
 * Add purchased credits to user balance (called after Stripe payment).
 */
export async function addPurchasedCredits(
    userId: string,
    credits: number,
    packId: string
): Promise<number> {
    const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single()

    if (!profile) throw new Error('Profile not found')

    const newBalance = (profile.credit_balance ?? 0) + credits

    await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', userId)

    await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: credits,
        balance_after: newBalance,
        reason: 'purchase',
        metadata: { pack_id: packId },
    })

    return newBalance
}
