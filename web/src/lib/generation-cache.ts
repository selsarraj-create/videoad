/**
 * Generation Cache — Deduplication layer for paid AI generation calls.
 *
 * Before calling Veo/Kling, hash the inputs and check if a completed job
 * with the same hash exists. If yes, return the cached output_url (Cost: $0).
 * If no, proceed with generation and tag the new job with the hash.
 *
 * Hash inputs: prompt + model + resolution + duration + preset_id + aspect_ratio
 *
 * Design decisions:
 *   - DB-backed (not Redis) — simpler infra, persists across deploys
 *   - User-scoped: cache hits only return results the requesting user owns
 *     (prevents information leakage between users)
 *   - 24-hour TTL: only cache hits from the last 24h are returned
 *     (models improve, stale outputs shouldn't be served forever)
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ── Hash Generation ──────────────────────────────────────────────

interface GenerateInputs {
    prompt: string
    model: string
    resolution?: string
    duration?: number
    preset_id?: string
    aspect_ratio?: string
    camera_move?: string
    style_ref?: string
}

/**
 * Create a deterministic SHA-256 hash of the generation inputs.
 * Only the fields that affect the output are included.
 */
export async function hashInputs(inputs: GenerateInputs): Promise<string> {
    const canonical = JSON.stringify({
        p: (inputs.prompt || '').trim().toLowerCase(),
        m: inputs.model || 'veo-3.1-fast',
        r: inputs.resolution || '720p',
        d: inputs.duration || 5,
        pr: inputs.preset_id || '',
        ar: inputs.aspect_ratio || '9:16',
        cm: inputs.camera_move || '',
        sr: inputs.style_ref || '',
    })

    // Use Web Crypto API (available in Node 18+ and Edge Runtime)
    const encoder = new TextEncoder()
    const data = encoder.encode(canonical)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Cache Lookup ─────────────────────────────────────────────────

export interface CacheHit {
    found: true
    job_id: string
    output_url: string
    model: string
    created_at: string
}

export interface CacheMiss {
    found: false
    hash: string
}

export type CacheResult = CacheHit | CacheMiss

/**
 * Check if a completed job with the same input hash exists for this user.
 * Returns the cached output URL if found, or the hash to tag the new job with.
 *
 * Only returns results from the last 24 hours to avoid serving stale outputs.
 */
export async function checkGenerationCache(
    supabase: SupabaseClient,
    userId: string,
    inputs: GenerateInputs,
): Promise<CacheResult> {
    const hash = await hashInputs(inputs)

    // Look for a completed job with the same hash from this user
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: cached } = await supabase
        .from('jobs')
        .select('id, output_url, model, created_at')
        .eq('input_hash', hash)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .not('output_url', 'is', null)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

    if (cached?.output_url) {
        return {
            found: true,
            job_id: cached.id,
            output_url: cached.output_url,
            model: cached.model,
            created_at: cached.created_at,
        }
    }

    return { found: false, hash }
}
