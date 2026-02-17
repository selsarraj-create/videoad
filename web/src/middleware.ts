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
        pathname.startsWith('/brand')

    if (!user && isProtectedRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('redirect', pathname)
        return NextResponse.redirect(url)
    }

    // If logged-in user visits /login, redirect to their dashboard
    if (user && pathname === '/login') {
        const role = await getUserRole(supabase, user.id)
        const url = request.nextUrl.clone()
        url.pathname = role === 'brand' ? '/brand/dashboard' : '/dashboard'
        return NextResponse.redirect(url)
    }

    // ── Role gate: enforce role-based access ───────────────────────────
    if (user && isProtectedRoute) {
        const role = await getUserRole(supabase, user.id)

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

// ── Helper: fetch user role from profiles ─────────────────────────────
async function getUserRole(
    supabase: ReturnType<typeof createServerClient>,
    userId: string
): Promise<string> {
    const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

    return data?.role ?? 'creator'
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/ops-metrics|api/queue-status|api/credits/webhook|api/webhooks/stripe|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|mov|ico)$).*)',
    ],
}
