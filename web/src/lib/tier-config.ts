/**
 * Tier Configuration — Single source of truth for subscription tiers.
 *
 * Starter ($0)  → VTO access, 0% commission, no automation
 * Pro ($10/mo)  → + Instagram automation, sizing bot, trial-eligible
 * High-Octane ($49/mo) → + 20 credits/mo, priority render, premium engines
 */

export type SubscriptionTier = 'starter' | 'pro' | 'high_octane'

export type Feature =
    | 'vto'
    | 'automation'
    | 'sizing_bot'
    | 'premium_engines'
    | 'priority_render'

export interface TierConfig {
    id: SubscriptionTier
    name: string
    price: number
    features: Record<Feature, boolean>
    commission_take: number          // Always 0 — the USP
    monthly_credit_grant: number
    render_priority: number          // 1 = highest
    engine_access: string[]          // Model IDs unlocked at this tier
    wardrobe_limit: number           // Max items in wardrobe (Infinity = unlimited)
    daily_upload_limit: number       // Max Photoroom-processed uploads per 24h
}

// ── Tier Definitions ──────────────────────────────────────────

const TIER_CONFIGS: Record<SubscriptionTier, TierConfig> = {
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 0,
        features: {
            vto: true,
            automation: false,
            sizing_bot: false,
            premium_engines: false,
            priority_render: false,
        },
        commission_take: 0,
        monthly_credit_grant: 0,
        render_priority: 3,
        engine_access: ['veo-3.1-fast'],
        wardrobe_limit: 5,
        daily_upload_limit: 5,
    },
    pro: {
        id: 'pro',
        name: 'Pro Creator',
        price: 10,
        features: {
            vto: true,
            automation: true,
            sizing_bot: true,
            premium_engines: false,
            priority_render: false,
        },
        commission_take: 0,
        monthly_credit_grant: 0,
        render_priority: 2,
        engine_access: ['veo-3.1-fast'],
        wardrobe_limit: 100,
        daily_upload_limit: 50,
    },
    high_octane: {
        id: 'high_octane',
        name: 'High-Octane',
        price: 49,
        features: {
            vto: true,
            automation: true,
            sizing_bot: true,
            premium_engines: true,
            priority_render: true,
        },
        commission_take: 0,
        monthly_credit_grant: 20,
        render_priority: 1,
        engine_access: ['veo-3.1-fast', 'kling-3.0-omni'],
        wardrobe_limit: Infinity,
        daily_upload_limit: Infinity,
    },
}

// ── Public API ─────────────────────────────────────────────────

export function getTierConfig(tier: SubscriptionTier): TierConfig {
    return TIER_CONFIGS[tier] || TIER_CONFIGS.starter
}

export function canAccess(tier: SubscriptionTier, feature: Feature): boolean {
    return getTierConfig(tier).features[feature] ?? false
}

/**
 * Check if the user's Pro trial is still active.
 * Trial grants Pro-level access for 7 days.
 */
export function isTrialActive(trialEndsAt: string | null | undefined): boolean {
    if (!trialEndsAt) return false
    return new Date(trialEndsAt).getTime() > Date.now()
}

/**
 * Resolve the effective tier — if trial is active, treat as 'pro'.
 */
export function getEffectiveTier(
    baseTier: SubscriptionTier,
    trialEndsAt: string | null | undefined
): SubscriptionTier {
    if (baseTier === 'starter' && isTrialActive(trialEndsAt)) {
        return 'pro'
    }
    return baseTier
}

/**
 * Check if a specific engine is accessible for a given tier.
 */
export function canAccessEngine(tier: SubscriptionTier, engineId: string): boolean {
    return getTierConfig(tier).engine_access.includes(engineId)
}

/**
 * Get the required tier for a given engine.
 */
export function getRequiredTierForEngine(engineId: string): SubscriptionTier {
    if (TIER_CONFIGS.high_octane.engine_access.includes(engineId) &&
        !TIER_CONFIGS.pro.engine_access.includes(engineId)) {
        return 'high_octane'
    }
    return 'starter'
}

export const ALL_TIERS: TierConfig[] = Object.values(TIER_CONFIGS)

/**
 * Get the wardrobe item limit for a given tier.
 */
export function getWardrobeLimit(tier: SubscriptionTier): number {
    return getTierConfig(tier).wardrobe_limit
}

/**
 * Get the daily upload limit for a given tier.
 * Uploads that trigger Photoroom/Claid processing count toward this limit.
 */
export function getDailyUploadLimit(tier: SubscriptionTier): number {
    return getTierConfig(tier).daily_upload_limit
}
