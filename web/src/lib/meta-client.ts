/**
 * Meta Graph API Client
 * 
 * Handles OAuth token exchange, refresh, Instagram account lookup,
 * and messaging via the Instagram Messaging API (Graph API v21.0).
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0'
const META_APP_ID = process.env.META_APP_ID!
const META_APP_SECRET = process.env.META_APP_SECRET!

// ── Token Exchange ─────────────────────────────────────────────

/**
 * Exchange authorization code for a short-lived user access token.
 */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
    access_token: string
    token_type: string
    expires_in: number
}> {
    const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?` + new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: redirectUri,
        code,
    }))

    if (!res.ok) {
        const err = await res.json()
        throw new Error(`Token exchange failed: ${JSON.stringify(err)}`)
    }

    return res.json()
}

/**
 * Exchange a short-lived token for a long-lived token (60 days).
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
    access_token: string
    token_type: string
    expires_in: number
}> {
    const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?` + new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: shortLivedToken,
    }))

    if (!res.ok) {
        const err = await res.json()
        throw new Error(`Long-lived token exchange failed: ${JSON.stringify(err)}`)
    }

    return res.json()
}

/**
 * Refresh a long-lived token before expiry.
 * Only works if the token is still valid and within 60-day window.
 */
export async function refreshLongLivedToken(currentToken: string): Promise<{
    access_token: string
    token_type: string
    expires_in: number
}> {
    const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?` + new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: currentToken,
    }))

    if (!res.ok) {
        const err = await res.json()
        throw new Error(`Token refresh failed: ${JSON.stringify(err)}`)
    }

    return res.json()
}

// ── Account Discovery ──────────────────────────────────────────

export interface IGAccount {
    id: string              // IG-scoped user ID
    username: string
    profile_picture_url: string
    account_type: 'BUSINESS' | 'MEDIA_CREATOR'
    name: string
}

export interface PageInfo {
    id: string
    name: string
    access_token: string    // Page-scoped access token
    instagram_business_account?: { id: string }
}

/**
 * Get all Facebook Pages the user manages, with their linked IG accounts.
 */
export async function getLinkedPages(userAccessToken: string): Promise<PageInfo[]> {
    const res = await fetch(
        `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
    )

    if (!res.ok) {
        const err = await res.json()
        throw new Error(`Failed to fetch pages: ${JSON.stringify(err)}`)
    }

    const data = await res.json()
    return data.data || []
}

/**
 * Get Instagram account details from IG-scoped user ID.
 */
export async function getIGAccountDetails(igUserId: string, accessToken: string): Promise<IGAccount> {
    const res = await fetch(
        `${GRAPH_API_BASE}/${igUserId}?fields=id,username,profile_picture_url,account_type,name&access_token=${accessToken}`
    )

    if (!res.ok) {
        const err = await res.json()
        throw new Error(`Failed to fetch IG account: ${JSON.stringify(err)}`)
    }

    return res.json()
}

// ── Webhook Subscriptions ──────────────────────────────────────

/**
 * Subscribe a Facebook Page to webhook events (comments + messages).
 */
export async function subscribePageToWebhooks(pageId: string, pageAccessToken: string): Promise<boolean> {
    const res = await fetch(`${GRAPH_API_BASE}/${pageId}/subscribed_apps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            subscribed_fields: ['feed', 'messages'],
            access_token: pageAccessToken,
        }),
    })

    if (!res.ok) {
        const err = await res.json()
        console.error(`Webhook subscription failed for page ${pageId}:`, err)
        return false
    }

    return true
}

// ── Messaging ──────────────────────────────────────────────────

export interface DMPayload {
    recipientId: string         // IG-scoped user ID of recipient
    message: string
    linkUrl?: string            // If set, sends as link with preview
    imageUrl?: string           // If set, sends image attachment
    linkPreview?: boolean
}

/**
 * Send a DM via the Instagram Messaging API.
 * Uses the Page-scoped IG user ID as the sender.
 */
export async function sendInstagramDM(
    igUserId: string,
    accessToken: string,
    payload: DMPayload
): Promise<{ message_id: string } | null> {
    // Build message body
    let messageBody: Record<string, any> = {}

    if (payload.imageUrl) {
        // Image message
        messageBody = {
            recipient: { id: payload.recipientId },
            message: {
                attachment: {
                    type: 'image',
                    payload: { url: payload.imageUrl, is_reusable: true },
                },
            },
        }
    } else if (payload.linkUrl && payload.linkPreview !== false) {
        // Text with link (Instagram shows link preview automatically)
        messageBody = {
            recipient: { id: payload.recipientId },
            message: {
                text: payload.message,
                // Note: Instagram auto-generates link previews for URLs in text
            },
        }
    } else {
        // Plain text
        messageBody = {
            recipient: { id: payload.recipientId },
            message: { text: payload.message },
        }
    }

    const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(messageBody),
    })

    if (!res.ok) {
        const err = await res.json()
        console.error(`DM send failed:`, err)
        return null
    }

    return res.json()
}

// ── Utilities ──────────────────────────────────────────────────

/**
 * Debug: inspect token permissions and expiry.
 */
export async function debugToken(accessToken: string): Promise<any> {
    const res = await fetch(
        `${GRAPH_API_BASE}/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`
    )
    return res.json()
}
