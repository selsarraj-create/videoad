import { NextResponse } from 'next/server'
import {
    handleCommentTrigger,
    handleSizingIntent,
    isCommentTrigger,
    isSizingIntent,
    type CommentEvent,
    type SizingMessageEvent,
} from '@/lib/affiliate-dm-engine'

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN!

/**
 * GET /api/meta/webhook
 * Webhook verification (Meta challenge handshake).
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[Webhook] Verification successful')
        return new Response(challenge, { status: 200 })
    }

    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/**
 * POST /api/meta/webhook
 * Receives real-time events from Meta: comments and messages.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()

        // Instagram sends events under the "instagram" object field
        if (body.object !== 'instagram' && body.object !== 'page') {
            return NextResponse.json({ received: true })
        }

        // Process each entry
        for (const entry of body.entry || []) {
            // ── Comment Events ─────────────────────────────────
            for (const change of entry.changes || []) {
                if (change.field === 'comments' || change.field === 'feed') {
                    const value = change.value

                    // Only process new comments (not edits/deletes)
                    if (value?.item === 'comment' && value?.verb === 'add') {
                        const commentText = value.message || ''

                        if (isCommentTrigger(commentText)) {
                            const event: CommentEvent = {
                                commentId: value.comment_id || value.id,
                                commentText,
                                commenterId: value.from?.id || '',
                                commenterUsername: value.from?.username,
                                mediaId: value.media?.id || value.post_id || '',
                                mediaOwnerId: entry.id, // The Page/IG account receiving the webhook
                                timestamp: value.created_time || Math.floor(Date.now() / 1000),
                            }

                            // Fire-and-forget — don't block the webhook response
                            handleCommentTrigger(event)
                                .then(res => console.log(`[Webhook] Comment trigger result:`, res))
                                .catch(err => console.error(`[Webhook] Comment trigger error:`, err))
                        }
                    }
                }
            }

            // ── Message Events ─────────────────────────────────
            for (const messaging of entry.messaging || []) {
                const messageText = messaging.message?.text || ''
                const senderId = messaging.sender?.id || ''
                const recipientId = messaging.recipient?.id || ''
                const timestamp = messaging.timestamp || Math.floor(Date.now() / 1000)

                // Skip echo (messages we sent)
                if (messaging.message?.is_echo) continue

                if (isSizingIntent(messageText)) {
                    const event: SizingMessageEvent = {
                        senderId,
                        senderUsername: messaging.sender?.username,
                        messageText,
                        recipientId,
                        timestamp,
                    }

                    // Fire-and-forget
                    handleSizingIntent(event)
                        .then(res => console.log(`[Webhook] Sizing intent result:`, res))
                        .catch(err => console.error(`[Webhook] Sizing intent error:`, err))
                }
            }
        }

        // Always return 200 quickly to avoid Meta retries
        return NextResponse.json({ received: true })

    } catch (err) {
        console.error('[Webhook] Parse error:', err)
        // Still return 200 to prevent Meta from disabling the webhook
        return NextResponse.json({ received: true })
    }
}
