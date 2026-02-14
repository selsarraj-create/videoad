"use client"

import { useState, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Loader2, Sparkles, Mail } from "lucide-react"
import Link from "next/link"

/* ── SVG brand icons ── */
function GoogleIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    )
}

function GitHubIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
    )
}

function LoginContent() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [socialLoading, setSocialLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    // Check for callback errors
    const callbackError = searchParams.get('error')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(null)

        if (mode === 'login') {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) {
                setError(error.message)
                setLoading(false)
            } else {
                const redirect = searchParams.get('redirect') || '/dashboard'
                router.push(redirect)
                router.refresh()
            }
        } else {
            // Server-side signup with auto-confirm
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Sign up failed')
                setLoading(false)
            } else {
                // Auto-login after successful signup
                const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
                if (loginError) {
                    setSuccess("Account created! Sign in with your credentials.")
                    setMode('login')
                    setLoading(false)
                } else {
                    router.push('/dashboard')
                    router.refresh()
                }
            }
        }
    }

    const handleSocialLogin = async (provider: 'google' | 'github') => {
        setSocialLoading(provider)
        setError(null)

        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        if (error) {
            setError(error.message)
            setSocialLoading(null)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 selection:bg-purple-500/30">
            {/* Background Glow Effects */}
            <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-purple-900/15 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[350px] bg-blue-900/10 rounded-full blur-[130px] pointer-events-none" />

            {/* Logo */}
            <Link href="/" className="mb-8 flex items-center gap-2 group z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center border border-purple-500/30 shadow-xl group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-2xl tracking-tighter text-white">
                    FASHION<span className="font-light text-zinc-600">STUDIO</span>
                </h1>
            </Link>

            <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-xl shadow-2xl relative overflow-hidden z-10">
                {/* Top gradient bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 opacity-80" />

                <CardHeader className="space-y-1 text-center pb-2">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                        {mode === 'login' ? 'Welcome back' : 'Create account'}
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        {mode === 'login'
                            ? 'Sign in to access your fashion studio'
                            : 'Sign up to start creating fashion videos'
                        }
                    </CardDescription>
                </CardHeader>

                {/* Mode Tabs */}
                <div className="px-6">
                    <div className="flex bg-zinc-950/50 rounded-lg p-0.5 border border-zinc-800">
                        <button
                            onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                            className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${mode === 'login'
                                ? 'bg-zinc-800 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                            className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${mode === 'signup'
                                ? 'bg-purple-900/40 text-purple-300 shadow-sm border border-purple-800/50'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            Create Account
                        </button>
                    </div>
                </div>

                <CardContent className="space-y-4 pt-4">
                    {/* Social Login Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            className="h-11 bg-zinc-950/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white transition-all duration-200 group"
                            onClick={() => handleSocialLogin('google')}
                            disabled={socialLoading !== null}
                        >
                            {socialLoading === 'google' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <GoogleIcon className="w-4 h-4 mr-2" />
                                    <span className="text-sm font-medium">Google</span>
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            className="h-11 bg-zinc-950/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white transition-all duration-200 group"
                            onClick={() => handleSocialLogin('github')}
                            disabled={socialLoading !== null}
                        >
                            {socialLoading === 'github' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <GitHubIcon className="w-4 h-4 mr-2" />
                                    <span className="text-sm font-medium">GitHub</span>
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Divider */}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-zinc-800/50" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-zinc-900/50 backdrop-blur px-3 text-zinc-500 font-medium tracking-wider">
                                or continue with email
                            </span>
                        </div>
                    </div>

                    {/* Email/Password Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-300">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    className="pl-10 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20 transition-all duration-200"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                                {mode === 'login' && (
                                    <Link
                                        href="/login/forgot-password"
                                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
                            <Input
                                id="password"
                                type="password"
                                placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-purple-500/50 focus:ring-purple-500/20 transition-all duration-200"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        {/* Error / Success Messages */}
                        {(error || callbackError) && (
                            <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                {error || 'Authentication failed. Please try again.'}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/50 text-green-400 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                {success}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className={`w-full h-11 font-bold shadow-lg transition-all duration-200 mt-2 ${mode === 'login'
                                ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-purple-900/20'
                                : 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white shadow-purple-900/20'
                                }`}
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? "Sign In" : "Create Account"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center text-xs text-zinc-500 pt-0">
                    <div className="w-full h-px bg-zinc-800/50" />
                    <p>
                        {mode === 'login'
                            ? <>Don&apos;t have an account? <button onClick={() => setMode('signup')} className="text-purple-400 hover:text-purple-300 font-medium transition-colors">Create one</button></>
                            : <>Already have an account? <button onClick={() => setMode('login')} className="text-purple-400 hover:text-purple-300 font-medium transition-colors">Sign in</button></>
                        }
                    </p>
                </CardFooter>
            </Card>

            {/* Footer */}
            <p className="mt-6 text-xs text-zinc-600 z-10">
                By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}
