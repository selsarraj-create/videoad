import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Identity Selection Middleware
 *
 * Server-side utilities for resolving the active identity and fetching
 * the associated 4K anchor images before calling downstream APIs (Claid, Veo).
 */

export interface IdentityAnchors {
    identity_id: string
    name: string
    master_identity_url: string | null
    master_body_collage: string | null
    views: Array<{
        angle: string
        image_url: string
        master_url: string | null
    }>
}

/**
 * Resolve the active identity for a user.
 *
 * Priority:
 *  1. Explicitly provided identity_id (validated against user ownership)
 *  2. The user's default identity (is_default = true)
 *  3. The oldest ready identity
 *
 * Returns null if the user has no ready identities.
 */
export async function getActiveIdentity(
    supabase: SupabaseClient,
    userId: string,
    requestedIdentityId?: string
): Promise<{ id: string; name: string; master_identity_url: string | null } | null> {

    // If an explicit identity_id was provided, validate ownership
    if (requestedIdentityId) {
        const { data } = await supabase
            .from('identities')
            .select('id, name, master_identity_url')
            .eq('id', requestedIdentityId)
            .eq('user_id', userId)
            .eq('status', 'ready')
            .single()

        if (data) return data
        // Fall through to default if the requested ID was invalid
    }

    // Try default identity
    const { data: defaultIdentity } = await supabase
        .from('identities')
        .select('id, name, master_identity_url')
        .eq('user_id', userId)
        .eq('is_default', true)
        .eq('status', 'ready')
        .single()

    if (defaultIdentity) return defaultIdentity

    // Fallback: oldest ready identity
    const { data: oldest } = await supabase
        .from('identities')
        .select('id, name, master_identity_url')
        .eq('user_id', userId)
        .eq('status', 'ready')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

    return oldest ?? null
}

/**
 * Fetch all 4K anchor images for a given identity.
 *
 * Returns the master identity URL, body collage, and all validated
 * angle views (with master_url if upscaled).
 *
 * Used by API routes before calling Claid or building Veo ingredients.
 */
export async function getIdentityAnchors(
    supabase: SupabaseClient,
    identityId: string
): Promise<IdentityAnchors | null> {

    // Fetch identity record
    const { data: identity } = await supabase
        .from('identities')
        .select('id, name, master_identity_url, master_body_collage')
        .eq('id', identityId)
        .single()

    if (!identity) return null

    // Fetch all validated views
    const { data: views } = await supabase
        .from('identity_views')
        .select('angle, image_url, master_url')
        .eq('identity_id', identityId)
        .eq('status', 'validated')
        .order('angle')

    return {
        identity_id: identity.id,
        name: identity.name,
        master_identity_url: identity.master_identity_url,
        master_body_collage: identity.master_body_collage,
        views: views ?? [],
    }
}

/**
 * Get the body-angle master URLs for Claid processing.
 * Returns URLs prioritizing upscaled masters (master_url),
 * falling back to raw validated images.
 */
export function getBodyMasterUrls(anchors: IdentityAnchors): string[] {
    const bodyAngles = ['front', 'profile', 'three_quarter']
    return anchors.views
        .filter(v => bodyAngles.includes(v.angle))
        .map(v => v.master_url || v.image_url)
}

/**
 * Get face close-up URLs for Veo ingredient 3 (face detail).
 */
export function getFaceDetailUrls(anchors: IdentityAnchors): string[] {
    const faceAngles = ['face_front', 'face_side']
    return anchors.views
        .filter(v => faceAngles.includes(v.angle))
        .map(v => v.master_url || v.image_url)
}
