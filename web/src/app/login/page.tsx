"use client"

import { useState, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

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


function LoginContent() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [socialLoading, setSocialLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

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
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, selected_tier: 'starter' })
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Sign up failed')
                setLoading(false)
            } else {
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

    const handleSocialLogin = async (provider: 'google') => {
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
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-primary/20 relative overflow-hidden font-sans">
            {/* Subtle background texture */}
            <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />

            {/* Decorative floating elements */}
            <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-20 right-[15%] w-32 h-32 border border-nimbus/40 rotate-12 hidden lg:block"
            />
            <motion.div
                animate={{ y: [0, 15, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-32 left-[10%] w-24 h-24 border border-nimbus/30 -rotate-6 hidden lg:block"
            />

            {/* Logo */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
                <Link href="/" className="mb-12 flex items-center gap-3 group z-10 relative">
                    <div className="w-10 h-10 bg-primary flex items-center justify-center group-hover:shadow-lg transition-shadow">
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <h1 className="font-serif text-2xl tracking-tight text-foreground">
                        LOOK<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">MAISON</span>
                    </h1>
                </Link>
            </motion.div>

            {/* Main Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="frosted-touch p-10 shadow-xl space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-2">
                        <h2 className="font-serif text-3xl tracking-tight text-foreground">
                            {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
                        </h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                            {mode === 'login'
                                ? 'Sign in to your creative space'
                                : 'Start free — upgrade anytime from your dashboard'
                            }
                        </p>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex border border-nimbus">
                        <button
                            onClick={() => { setMode('login'); setError(null); setSuccess(null) }}
                            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 ${mode === 'login'
                                ? 'bg-foreground text-background'
                                : 'bg-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 border-l border-nimbus ${mode === 'signup'
                                ? 'bg-foreground text-background'
                                : 'bg-transparent text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Create Account
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {(
                            /* ── CREDENTIALS (login or signup) ── */
                            <motion.div
                                key="credentials"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-6"
                            >
                                {/* Social Login */}
                                <div>
                                    <button
                                        className="w-full h-12 border border-nimbus bg-white/50 hover:bg-white transition-all duration-300 flex items-center justify-center gap-2 group"
                                        onClick={() => handleSocialLogin('google')}
                                        disabled={socialLoading !== null}
                                    >
                                        {socialLoading === 'google' ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        ) : (
                                            <>
                                                <GoogleIcon className="w-4 h-4" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Continue with Google</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-nimbus" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-background/80 backdrop-blur-sm px-4 text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">
                                            or continue with email
                                        </span>
                                    </div>
                                </div>



                                {/* Email/Password Form */}
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Email</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                            <input
                                                id="email"
                                                type="email"
                                                placeholder="name@example.com"
                                                className="w-full h-12 pl-10 pr-4 bg-white/60 border border-nimbus text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="password" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Password</Label>
                                            {mode === 'login' && (
                                                <Link
                                                    href="/login/forgot-password"
                                                    className="text-[10px] text-primary hover:text-foreground transition-colors uppercase tracking-widest font-bold"
                                                >
                                                    Forgot?
                                                </Link>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                                                className="w-full h-12 pl-10 pr-10 bg-white/60 border border-nimbus text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Error / Success Messages */}
                                    {(error || callbackError) && (
                                        <div className="p-4 border-l-2 border-destructive bg-destructive/5">
                                            <p className="text-[10px] font-bold text-destructive uppercase tracking-widest mb-1">Error</p>
                                            <p className="text-xs text-muted-foreground">{error || 'Authentication failed. Please try again.'}</p>
                                        </div>
                                    )}

                                    {success && (
                                        <div className="p-4 border-l-2 border-primary bg-primary/5">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Success</p>
                                            <p className="text-xs text-muted-foreground">{success}</p>
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        className="w-full h-14 bg-foreground text-background hover:bg-primary text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 rounded-none shadow-xl hover:shadow-2xl"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                {mode === 'login' ? 'Sign In' : 'Create Account'}
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer toggle */}
                    <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground">
                            {mode === 'login'
                                ? <>Don&apos;t have an account?{' '}<button onClick={() => { setMode('signup'); setError(null); setSuccess(null) }} className="text-primary hover:text-foreground font-bold uppercase tracking-widest text-[10px] transition-colors">Create one</button></>
                                : <>Already have an account?{' '}<button onClick={() => setMode('login')} className="text-primary hover:text-foreground font-bold uppercase tracking-widest text-[10px] transition-colors">Sign in</button></>
                            }
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Footer */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-[10px] text-muted-foreground/60 z-10 uppercase tracking-widest"
            >
                © 2026 Look Maison. All rights reserved.
            </motion.p>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    )
}
