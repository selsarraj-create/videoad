import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const META_APP_ID = process.env.META_APP_ID!
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`

const SCOPES = [
    'instagram_basic',
    'instagram_manage_messages',
    'instagram_content_publish',
    'pages_show_list',
    'pages_read_engagement',
].join(',')

/**
 * GET /api/meta/auth
 * Initiates the Meta OAuth flow — redirects user to Facebook Login dialog.
 */
export async function GET() {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`)
    }

    // Build Facebook Login URL
    const loginUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth')
    loginUrl.searchParams.set('client_id', META_APP_ID)
    loginUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    loginUrl.searchParams.set('scope', SCOPES)
    loginUrl.searchParams.set('response_type', 'code')
    loginUrl.searchParams.set('state', user.id) // Pass user ID as state for CSRF + mapping

    return NextResponse.redirect(loginUrl.toString())
}
