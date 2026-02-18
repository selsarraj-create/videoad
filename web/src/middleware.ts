import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh the session — IMPORTANT: do not remove this
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const pathname = request.nextUrl.pathname

    // ── Auth gate: redirect unauthenticated users ──────────────────────
    const isProtectedRoute =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/admin') ||
        (pathname.startsWith('/brand') && !pathname.startsWith('/brand/login'))

    if (!user && isProtectedRoute) {
        const url = request.nextUrl.clone()
        // Brand routes → brand login, everything else → creator login
        url.pathname = pathname.startsWith('/brand') ? '/brand/login' : '/login'
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
    }

    // If logged-in user visits /login, redirect to their dashboard
    if (user && pathname === '/login') {
        const role = await getUserRole(supabase, user)
        const url = request.nextUrl.clone()
        url.pathname = role === 'brand' ? '/brand/dashboard' : '/dashboard'
        return NextResponse.redirect(url)
    }

    // If logged-in brand visits /brand/login, redirect to brand dashboard
    if (user && pathname === '/brand/login') {
        const url = request.nextUrl.clone()
        url.pathname = '/brand/dashboard'
        return NextResponse.redirect(url)
    }

    // ── Role gate: enforce role-based access ───────────────────────────
    if (user && isProtectedRoute) {
        const role = await getUserRole(supabase, user)

        // /brand/* requires brand or admin role
        if (pathname.startsWith('/brand') && role !== 'brand' && role !== 'admin') {
            const url = request.nextUrl.clone()
            url.pathname = '/403'
            return NextResponse.redirect(url)
        }

        // /admin/* requires admin role
        if (pathname.startsWith('/admin') && role !== 'admin') {
            const url = request.nextUrl.clone()
            url.pathname = '/403'
            return NextResponse.redirect(url)
        }

        // /dashboard/* is for creators (and admins)
        if (pathname.startsWith('/dashboard') && role === 'brand') {
            const url = request.nextUrl.clone()
            url.pathname = '/brand/dashboard'
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}

// ── Helper: resolve user role ─────────────────────────────────────────
// Priority: app_metadata.role (set at signup, most reliable) → profiles.role → 'creator'
async function getUserRole(
    supabase: ReturnType<typeof createServerClient>,
    user: { id: string; app_metadata?: Record<string, unknown> }
): Promise<string> {
    // 1. Check app_metadata first (set during signup, embedded in auth)
    const metaRole = user.app_metadata?.role
    if (typeof metaRole === 'string' && ['creator', 'brand', 'admin'].includes(metaRole)) {
        return metaRole
    }

    // 2. Fallback to profiles table
    const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    return data?.role ?? 'creator'
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/ops-metrics|api/queue-status|api/credits/webhook|api/webhooks/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|ico)$).*)',
    ],
}
