import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    exchangeCodeForToken,
    exchangeForLongLivedToken,
    getLinkedPages,
    getIGAccountDetails,
    subscribePageToWebhooks,
} from '@/lib/meta-client'

const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`

/**
 * GET /api/meta/callback
 * Handles the OAuth callback from Facebook Login.
 * Exchanges code → short-lived → long-lived token,
 * discovers IG account, stores in DB, subscribes to webhooks.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state') // user_id
    const error = searchParams.get('error')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    // Handle user-denied or error
    if (error || !code) {
        const reason = searchParams.get('error_reason') || 'unknown'
        console.error(`[Meta Callback] OAuth denied: ${reason}`)
        return NextResponse.redirect(`${appUrl}/dashboard?ig=error&reason=${reason}`)
    }

    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== state) {
        return NextResponse.redirect(`${appUrl}/login?error=state_mismatch`)
    }

    try {
        // 1. Exchange code for short-lived token
        const shortLived = await exchangeCodeForToken(code, REDIRECT_URI)

        // 2. Exchange for long-lived token (60 days)
        const longLived = await exchangeForLongLivedToken(shortLived.access_token)
        const expiresAt = new Date(Date.now() + longLived.expires_in * 1000)

        // 3. Discover linked Facebook Pages with IG accounts
        const pages = await getLinkedPages(longLived.access_token)
        const pageWithIG = pages.find(p => p.instagram_business_account?.id)

        if (!pageWithIG || !pageWithIG.instagram_business_account) {
            console.error('[Meta Callback] No Professional IG account linked to any Page')
            return NextResponse.redirect(
                `${appUrl}/dashboard?ig=error&reason=no_professional_account`
            )
        }

        const igUserId = pageWithIG.instagram_business_account.id
        const pageId = pageWithIG.id
        const pageName = pageWithIG.name

        // 4. Fetch IG account details
        const igAccount = await getIGAccountDetails(igUserId, longLived.access_token)

        // 5. Validate account type (must be BUSINESS or MEDIA_CREATOR)
        if (!['BUSINESS', 'MEDIA_CREATOR'].includes(igAccount.account_type)) {
            return NextResponse.redirect(
                `${appUrl}/dashboard?ig=error&reason=not_professional`
            )
        }

        // 6. Upsert connection in DB
        const { error: dbError } = await supabase
            .from('instagram_connections')
            .upsert({
                user_id: user.id,
                ig_user_id: igUserId,
                ig_username: igAccount.username,
                ig_profile_picture_url: igAccount.profile_picture_url,
                page_id: pageId,
                page_name: pageName,
                access_token: longLived.access_token,
                token_expires_at: expiresAt.toISOString(),
                scopes: [
                    'instagram_basic',
                    'instagram_manage_messages',
                    'instagram_content_publish',
                    'pages_show_list',
                    'pages_read_engagement',
                ],
                account_type: igAccount.account_type === 'MEDIA_CREATOR' ? 'CREATOR' : 'BUSINESS',
                is_active: true,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' })

        if (dbError) {
            console.error('[Meta Callback] DB upsert error:', dbError)
            return NextResponse.redirect(`${appUrl}/dashboard?ig=error&reason=db_error`)
        }

        // 7. Subscribe Page to webhook events (comments + messages)
        // Use the Page-scoped access token from the pages list
        const pageAccessToken = pageWithIG.access_token
        await subscribePageToWebhooks(pageId, pageAccessToken)

        console.log(`[Meta Callback] IG @${igAccount.username} connected for user ${user.id}`)
        return NextResponse.redirect(`${appUrl}/dashboard?ig=connected`)

    } catch (err: any) {
        console.error('[Meta Callback] Error:', err.message)
        return NextResponse.redirect(`${appUrl}/dashboard?ig=error&reason=exchange_failed`)
    }
}
