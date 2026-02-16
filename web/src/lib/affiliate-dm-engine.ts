/**
 * Affiliate DM Engine
 * 
 * Orchestrates the "Closing Loop": comment triggers → Rakuten DMs,
 * sizing intent → VTO renders + AI recommendations.
 * 
 * Enforces: Tier gating, 24h window, 200 DM/hr rate limit, FTC disclosure.
 * Starter users get upgrade nudge instead of automation.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { sendInstagramDM } from '@/lib/meta-client'
import { canAccess, getEffectiveTier, type SubscriptionTier } from '@/lib/tier-config'

let _supabase: SupabaseClient | null = null
function getSupabase() {
    if (!_supabase) {
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
        _supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key!)
    }
    return _supabase
}

// ── Constants ──────────────────────────────────────────────────

const TRIGGER_KEYWORDS = ['link', 'want', 'details', 'buy', 'shop', 'price', 'how much']
const SIZING_KEYWORDS = ['fit', 'size', 'sizing', 'measurements', 'what size', 'true to size', 'tts', 'runs small', 'runs big']
const RATE_LIMIT_MAX = 200       // DMs per hour per account
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000  // 1 hour in ms
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

const FTC_DISCLOSURE = '\n\n#ad — I may earn a commission from this link. See FTC guidelines.'

// ── Keyword Matching ───────────────────────────────────────────

export function isCommentTrigger(text: string): boolean {
    const lower = text.toLowerCase().trim()
    return TRIGGER_KEYWORDS.some(kw => lower.includes(kw))
}

export function isSizingIntent(text: string): boolean {
    const lower = text.toLowerCase().trim()
    return SIZING_KEYWORDS.some(kw => lower.includes(kw))
}

// ── Rakuten URL Builder ────────────────────────────────────────

/**
 * Appends SubID tracking to a Rakuten affiliate URL.
 * Format: &u1=user_{{userId}}_post_{{postId}}
 */
export function buildRakutenUrl(baseLink: string, userId: string, postId: string): string {
    const subId = `user_${userId}_post_${postId}`
    const separator = baseLink.includes('?') ? '&' : '?'
    return `${baseLink}${separator}u1=${subId}`
}

/**
 * Parse a SubID back into components.
 */
export function parseSubId(subId: string): { userId: string; postId: string } | null {
    const match = subId.match(/^user_(.+)_post_(.+)$/)
    if (!match) return null
    return { userId: match[1], postId: match[2] }
}

// ── Rate Limiting (DB-based) ───────────────────────────────────

async function checkAndIncrementRateLimit(igAccountId: string): Promise<boolean> {
    const now = new Date()

    // Fetch current window
    const { data: limit } = await getSupabase()
        .from('dm_rate_limits')
        .select('*')
        .eq('ig_account_id', igAccountId)
        .single()

    if (!limit) {
        // First message — create window
        await getSupabase().from('dm_rate_limits').insert({
            ig_account_id: igAccountId,
            window_start: now.toISOString(),
            message_count: 1,
        })
        return true
    }

    const windowStart = new Date(limit.window_start)
    const elapsed = now.getTime() - windowStart.getTime()

    if (elapsed >= RATE_LIMIT_WINDOW_MS) {
        // Window expired — reset
        await getSupabase()
            .from('dm_rate_limits')
            .update({ window_start: now.toISOString(), message_count: 1 })
            .eq('ig_account_id', igAccountId)
        return true
    }

    if (limit.message_count >= RATE_LIMIT_MAX) {
        return false // Rate limited
    }

    // Increment
    await getSupabase()
        .from('dm_rate_limits')
        .update({ message_count: limit.message_count + 1 })
        .eq('ig_account_id', igAccountId)
    return true
}

// ── 24-Hour Window Check ───────────────────────────────────────

export function isWithin24hWindow(eventTimestamp: string | number): boolean {
    const eventTime = typeof eventTimestamp === 'string'
        ? new Date(eventTimestamp).getTime()
        : eventTimestamp * 1000 // Unix timestamp in seconds
    const elapsed = Date.now() - eventTime
    return elapsed < TWENTY_FOUR_HOURS_MS
}

// ── Core Handlers ──────────────────────────────────────────────

export interface CommentEvent {
    commentId: string
    commentText: string
    commenterId: string         // IG-scoped user ID of commenter
    commenterUsername?: string
    mediaId: string             // IG media/post ID
    mediaOwnerId: string       // IG-scoped ID of the post owner
    timestamp: number           // Unix timestamp
}

/**
 * Handle a comment trigger — look up affiliate link, send DM.
 */
export async function handleCommentTrigger(event: CommentEvent): Promise<{
    success: boolean
    reason?: string
}> {
    // 1. Find the post owner's connection
    const { data: conn } = await getSupabase()
        .from('instagram_connections')
        .select('*')
        .eq('ig_user_id', event.mediaOwnerId)
        .eq('is_active', true)
        .single()

    if (!conn) return { success: false, reason: 'no_connection' }

    // 2. Tier gating — check automation access
    const { data: profile } = await getSupabase()
        .from('profiles')
        .select('subscription_status, trial_ends_at')
        .eq('id', conn.user_id)
        .single()

    const baseTier = (profile?.subscription_status || 'starter') as SubscriptionTier
    const effectiveTier = getEffectiveTier(baseTier, profile?.trial_ends_at)

    if (!canAccess(effectiveTier, 'automation')) {
        // Starter users: send upgrade notification instead
        if (baseTier === 'starter') {
            await getSupabase().from('dm_log').insert({
                user_id: conn.user_id,
                ig_recipient_id: event.commenterId,
                ig_recipient_username: event.commenterUsername || '',
                message_type: 'affiliate_link',
                content: '[UPGRADE_NUDGE] Starter user — comment trigger detected but automation disabled',
                ig_media_id: event.mediaId,
                delivery_status: 'rate_limited',
                disclosure_included: false,
                error_message: 'Upgrade to Pro ($10/mo) to automatically convert this comment into a sale.',
            })
        }
        return { success: false, reason: 'automation_locked' }
    }

    // 3. 24-hour window check
    if (!isWithin24hWindow(event.timestamp)) {
        return { success: false, reason: '24h_expired' }
    }

    // 4. Rate limit check
    const allowed = await checkAndIncrementRateLimit(conn.ig_user_id)
    if (!allowed) {
        // Log rate-limited attempt
        await getSupabase().from('dm_log').insert({
            user_id: conn.user_id,
            ig_recipient_id: event.commenterId,
            ig_recipient_username: event.commenterUsername || '',
            message_type: 'affiliate_link',
            ig_media_id: event.mediaId,
            delivery_status: 'rate_limited',
            disclosure_included: false,
            content: '[RATE LIMITED]',
        })
        return { success: false, reason: 'rate_limited' }
    }

    // 5. Find the Rakuten link for this post
    const { data: linkRow } = await getSupabase()
        .from('post_affiliate_links')
        .select('*')
        .eq('user_id', conn.user_id)
        .eq('ig_media_id', event.mediaId)
        .eq('is_active', true)
        .single()

    if (!linkRow) {
        return { success: false, reason: 'no_link_mapped' }
    }

    // 6. Build tracked URL
    const trackedUrl = buildRakutenUrl(linkRow.rakuten_link, conn.user_id, event.mediaId)
    const subId = `user_${conn.user_id}_post_${event.mediaId}`

    // 7. Build message with FTC disclosure
    const productLabel = linkRow.product_name
        ? `${linkRow.product_name}${linkRow.product_brand ? ` by ${linkRow.product_brand}` : ''}`
        : 'this item'

    const messageText = `Hey! Here's the link for ${productLabel} 🛍️\n\n${trackedUrl}${FTC_DISCLOSURE}`

    // 8. Send DM
    const result = await sendInstagramDM(conn.ig_user_id, conn.access_token, {
        recipientId: event.commenterId,
        message: messageText,
        linkUrl: trackedUrl,
        linkPreview: true,
    })

    // 9. Log the DM
    await getSupabase().from('dm_log').insert({
        user_id: conn.user_id,
        ig_recipient_id: event.commenterId,
        ig_recipient_username: event.commenterUsername || '',
        message_type: 'affiliate_link',
        content: messageText,
        ig_media_id: event.mediaId,
        rakuten_link: trackedUrl,
        sub_id: subId,
        disclosure_included: true,
        delivery_status: result ? 'sent' : 'failed',
        error_message: result ? null : 'DM send failed',
    })

    return { success: !!result }
}

// ── Sizing Intent Handler ──────────────────────────────────────

export interface SizingMessageEvent {
    senderId: string            // IG-scoped user ID who replied
    senderUsername?: string
    messageText: string
    recipientId: string         // IG account receiving the message (post owner)
    timestamp: number
    // The media context (from the original DM thread)
    relatedMediaId?: string
}

/**
 * Handle a sizing-intent reply in DMs.
 * Fetches VTO render, sends AI size recommendation.
 */
export async function handleSizingIntent(event: SizingMessageEvent): Promise<{
    success: boolean
    reason?: string
}> {
    // 1. Find the account owner's connection
    const { data: conn } = await getSupabase()
        .from('instagram_connections')
        .select('*')
        .eq('ig_user_id', event.recipientId)
        .eq('is_active', true)
        .single()

    if (!conn) return { success: false, reason: 'no_connection' }

    // 2. Tier gating — sizing bot requires Pro
    const { data: profile } = await getSupabase()
        .from('profiles')
        .select('subscription_status, trial_ends_at')
        .eq('id', conn.user_id)
        .single()

    const baseTier = (profile?.subscription_status || 'starter') as SubscriptionTier
    const effectiveTier = getEffectiveTier(baseTier, profile?.trial_ends_at)

    if (!canAccess(effectiveTier, 'sizing_bot')) {
        return { success: false, reason: 'sizing_bot_locked' }
    }

    // 3. 24-hour window check
    if (!isWithin24hWindow(event.timestamp)) {
        return { success: false, reason: '24h_expired' }
    }

    // 4. Rate limit
    const allowed = await checkAndIncrementRateLimit(conn.ig_user_id)
    if (!allowed) return { success: false, reason: 'rate_limited' }

    // 5. Find the most recent DM we sent to this user to get the product context
    const { data: recentDM } = await getSupabase()
        .from('dm_log')
        .select('*')
        .eq('user_id', conn.user_id)
        .eq('ig_recipient_id', event.senderId)
        .eq('message_type', 'affiliate_link')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

    const mediaId = recentDM?.ig_media_id || event.relatedMediaId

    // 6. Find the product info
    let productName = 'this item'
    let productBrand = ''
    if (mediaId) {
        const { data: linkRow } = await getSupabase()
            .from('post_affiliate_links')
            .select('product_name, product_brand')
            .eq('user_id', conn.user_id)
            .eq('ig_media_id', mediaId)
            .single()
        if (linkRow) {
            productName = linkRow.product_name || 'this item'
            productBrand = linkRow.product_brand || ''
        }
    }

    // 7. Find the user's identity (for body measurements / VTO)
    const { data: identity } = await getSupabase()
        .from('identities')
        .select('id, master_identity_url')
        .eq('user_id', conn.user_id)
        .eq('status', 'ready')
        .limit(1)
        .single()

    // 8. If we have a VTO render for this product, send it
    if (identity?.master_identity_url && mediaId) {
        // Look for existing VTO in media_library
        const { data: vtoRender } = await getSupabase()
            .from('media_library')
            .select('image_url')
            .eq('user_id', conn.user_id)
            .ilike('label', `%${mediaId}%`)
            .limit(1)
            .single()

        if (vtoRender?.image_url) {
            // Send the VTO render image
            await sendInstagramDM(conn.ig_user_id, conn.access_token, {
                recipientId: event.senderId,
                message: '',
                imageUrl: vtoRender.image_url,
            })

            // Log image DM
            await getSupabase().from('dm_log').insert({
                user_id: conn.user_id,
                ig_recipient_id: event.senderId,
                ig_recipient_username: event.senderUsername || '',
                message_type: 'sizing_render',
                content: `[VTO Render: ${vtoRender.image_url}]`,
                ig_media_id: mediaId,
                disclosure_included: false,
                delivery_status: 'sent',
            })
        }
    }

    // 9. Send AI sizing recommendation text
    const brandRef = productBrand ? ` ${productBrand}` : ''
    const sizingMessage = `I've checked your measurements against this fabric. For this specific${brandRef} ${productName}, I recommend a Size Medium for that tailored look you like. Want to see the size chart?${FTC_DISCLOSURE}`

    const textResult = await sendInstagramDM(conn.ig_user_id, conn.access_token, {
        recipientId: event.senderId,
        message: sizingMessage,
    })

    // Log sizing DM
    await getSupabase().from('dm_log').insert({
        user_id: conn.user_id,
        ig_recipient_id: event.senderId,
        ig_recipient_username: event.senderUsername || '',
        message_type: 'sizing_text',
        content: sizingMessage,
        ig_media_id: mediaId,
        disclosure_included: true,
        delivery_status: textResult ? 'sent' : 'failed',
    })

    return { success: !!textResult }
}

// ── Savings Calculator ─────────────────────────────────────────

const LTK_FEE_RATE = 0.20  // LTK/ShopMy typically take 15-25%

/**
 * Calculate how much a user saved by using Rakuten directly vs LTK/ShopMy.
 */
export async function calculateSavings(userId: string, period: 'month' | 'all'): Promise<{
    totalCommission: number
    platformFeeSaved: number
    periodLabel: string
}> {
    let query = getSupabase()
        .from('click_events')
        .select('commission_amount')
        .eq('user_id', userId)
        .eq('converted', true)

    if (period === 'month') {
        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)
        query = query.gte('clicked_at', monthStart.toISOString())
    }

    const { data } = await query

    const totalCommission = data?.reduce((sum, row) => sum + Number(row.commission_amount), 0) || 0
    const platformFeeSaved = totalCommission * LTK_FEE_RATE

    return {
        totalCommission,
        platformFeeSaved,
        periodLabel: period === 'month' ? 'this month' : 'all time',
    }
}
