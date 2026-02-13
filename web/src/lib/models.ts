export type ModelCategory = 'Cinema' | 'Social' | 'Production' | 'Product'
export type CreditTier = 'Eco' | 'Standard' | 'Premium'
export type Provider = 'Kie.ai' | 'WaveSpeedAI'

export interface ModelSpec {
    id: string
    name: string
    provider: Provider
    category: ModelCategory
    tier: CreditTier
    description: string
    baseCredits: number // credits per generation (standard duration/resolution)
    maxDuration?: number
    maxResolution?: '720p' | '1080p' | '4k'
}

// Actual Kie.ai credit costs (as of Feb 2026)
// $0.005 per credit ($50 / 10,000 credits)
export const MODELS: ModelSpec[] = [
    // Social (Fast) - Default
    {
        id: 'veo-3.1-fast',
        name: 'Veo 3.1 Fast',
        provider: 'Kie.ai',
        category: 'Social',
        tier: 'Eco',
        description: 'High-speed generation perfect for social media trends.',
        baseCredits: 60, // 60 credits per video (~$0.30)
        maxDuration: 8,
        maxResolution: '1080p'
    },
    // Cinema (Hero)
    {
        id: 'sora-2',
        name: 'Sora 2',
        provider: 'Kie.ai',
        category: 'Cinema',
        tier: 'Premium',
        description: 'Best-in-class cinematic realism and complex scene understanding.',
        baseCredits: 30, // 30 credits for 10s (~$0.15), 35 for 15s
        maxDuration: 15,
        maxResolution: '1080p'
    },
    {
        id: 'wan-2.6',
        name: 'WAN 2.6',
        provider: 'WaveSpeedAI',
        category: 'Cinema',
        tier: 'Premium',
        description: 'Exclusive 4K upscaling and detailed texture rendering.',
        baseCredits: 60, // Estimated (WaveSpeedAI pricing)
        maxDuration: 10,
        maxResolution: '4k'
    },
    {
        id: 'hailuo-2.3',
        name: 'Hailuo 2.3',
        provider: 'Kie.ai',
        category: 'Social',
        tier: 'Standard',
        description: 'Balanced performance for social content with moderate complexity.',
        baseCredits: 30, // 30 credits for 6s 768p (~$0.15), 50 for 10s
        maxDuration: 10,
        maxResolution: '1080p'
    },
    // Production (Consistency)
    {
        id: 'kling-2.6-pro',
        name: 'Kling 2.6 Pro',
        provider: 'WaveSpeedAI',
        category: 'Production',
        tier: 'Standard',
        description: 'Professional grade visual consistency for long-form content.',
        baseCredits: 55, // 55 credits for 5s HD (~$0.28), 110 for 10s
        maxDuration: 10,
        maxResolution: '1080p'
    },
    {
        id: 'seedance-2.0-pro',
        name: 'Seedance 2.0 Pro',
        provider: 'WaveSpeedAI',
        category: 'Production',
        tier: 'Premium',
        description: 'Advanced character consistency and motion control.',
        baseCredits: 80, // Estimated (WaveSpeedAI pricing)
        maxDuration: 10,
        maxResolution: '1080p'
    },
    // Product (E-comm)
    {
        id: 'product-showcase-1',
        name: 'Product Showcase V1',
        provider: 'Kie.ai',
        category: 'Product',
        tier: 'Standard',
        description: 'Optimized for product photography and clean backgrounds.',
        baseCredits: 60, // Uses Veo 3.1 Fast under the hood
        maxDuration: 8,
        maxResolution: '1080p'
    }
]

export const CATEGORIES: ModelCategory[] = ['Cinema', 'Social', 'Production', 'Product']

// Credits are flat per generation for most Kie.ai models
// 1080p doubles the cost, 4K quadruples
export function calculateCredits(base: number, duration: number, is4k: boolean): number {
    let cost = base

    // Duration scaling (base price covers standard duration, longer costs more)
    if (duration > 8) cost = Math.round(cost * 1.5)

    // Resolution multiplier
    if (is4k) cost = cost * 4

    return cost
}
