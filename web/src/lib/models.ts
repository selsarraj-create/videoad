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
    baseCredits: number // per 720p/8s
    maxDuration?: number
    maxResolution?: '720p' | '1080p' | '4k'
}

export const MODELS: ModelSpec[] = [
    // Cinema (Hero)
    {
        id: 'sora-2',
        name: 'Sora 2',
        provider: 'Kie.ai',
        category: 'Cinema',
        tier: 'Premium',
        description: 'Best-in-class cinematic realism and complex scene understanding.',
        baseCredits: 50
    },
    {
        id: 'wan-2.6',
        name: 'WAN 2.6',
        provider: 'WaveSpeedAI',
        category: 'Cinema',
        tier: 'Premium',
        description: 'Exclusive 4K upscaling and detailed texture rendering.',
        baseCredits: 60
    },
    // Social (Fast)
    {
        id: 'veo-3.1-fast',
        name: 'Veo 3.1 Fast',
        provider: 'Kie.ai',
        category: 'Social',
        tier: 'Eco',
        description: 'High-speed generation perfect for social media trends.',
        baseCredits: 5
    },
    {
        id: 'hailuo-2.3',
        name: 'Hailuo 2.3',
        provider: 'Kie.ai',
        category: 'Social',
        tier: 'Standard',
        description: 'Balanced performance for social content with moderate complexity.',
        baseCredits: 15
    },
    // Production (Consistency)
    {
        id: 'kling-2.6-pro',
        name: 'Kling 2.6 Pro',
        provider: 'WaveSpeedAI',
        category: 'Production',
        tier: 'Standard',
        description: 'Professional grade visual consistency for long-form content.',
        baseCredits: 20
    },
    {
        id: 'seedance-2.0-pro',
        name: 'Seedance 2.0 Pro',
        provider: 'WaveSpeedAI',
        category: 'Production',
        tier: 'Premium',
        description: 'Advanced character consistency and motion control.',
        baseCredits: 40
    },
    // Product (E-comm)
    {
        id: 'product-showcase-1',
        name: 'Product Showcase V1',
        provider: 'Kie.ai',
        category: 'Product',
        tier: 'Standard',
        description: 'Optimized for product photography and clean backgrounds.',
        baseCredits: 10
    }
]

export const CATEGORIES: ModelCategory[] = ['Cinema', 'Social', 'Production', 'Product']

export function calculateCredits(base: number, duration: number, is4k: boolean): number {
    let multiplier = 1
    if (is4k) multiplier *= 4
    if (duration > 8) multiplier *= 3 // Simple stepping for now
    return base * multiplier
}
