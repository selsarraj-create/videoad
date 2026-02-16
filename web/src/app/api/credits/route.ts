import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { type SubscriptionTier, getEffectiveTier } from '@/lib/tier-config'

/**
 * GET /api/credits
 * Returns user's credit balance, tier info, and trial status.
 */
export async function GET() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_status, credit_balance, trial_ends_at, monthly_credit_grant, render_priority')
        .eq('id', user.id)
        .single()

    if (!profile) {
        return NextResponse.json({
            tier: 'starter' as SubscriptionTier,
            effectiveTier: 'starter' as SubscriptionTier,
            balance: 0,
            trialActive: false,
            monthlyGrant: 0,
            renderPriority: 3,
        })
    }

    const baseTier = (profile.subscription_status || 'starter') as SubscriptionTier
    const effectiveTier = getEffectiveTier(baseTier, profile.trial_ends_at)
    const trialActive = baseTier === 'starter' && effectiveTier === 'pro'

    return NextResponse.json({
        tier: baseTier,
        effectiveTier,
        balance: profile.credit_balance ?? 0,
        trialActive,
        trialEndsAt: profile.trial_ends_at || null,
        monthlyGrant: profile.monthly_credit_grant ?? 0,
        renderPriority: profile.render_priority ?? 3,
    })
}
