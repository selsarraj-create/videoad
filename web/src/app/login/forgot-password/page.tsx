"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, ArrowLeft, Mail, Check } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login/reset-password`,
        })

        if (error) {
            setError(error.message)
        } else {
            setSent(true)
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 selection:bg-primary/20 relative overflow-hidden font-sans">
            {/* Subtle background texture */}
            <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />

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
                        FASHION<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">STUDIO</span>
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
                            {sent ? 'Check Your Email' : 'Reset Password'}
                        </h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                            {sent
                                ? 'We sent you a reset link'
                                : 'Enter your email to receive a reset link'
                            }
                        </p>
                    </div>

                    {sent ? (
                        <div className="space-y-6">
                            <div className="flex flex-col items-center gap-4 py-6">
                                <div className="w-14 h-14 bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Check className="w-7 h-7 text-primary" />
                                </div>
                                <p className="text-sm text-muted-foreground text-center max-w-xs leading-relaxed">
                                    If an account exists for <span className="text-foreground font-bold">{email}</span>, you&apos;ll receive a password reset email shortly.
                                </p>
                            </div>
                            <Link href="/login">
                                <Button className="w-full h-14 bg-foreground text-background hover:bg-primary text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 rounded-none">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to Sign In
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Email Address</Label>
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

                            {error && (
                                <div className="p-4 border-l-2 border-destructive bg-destructive/5">
                                    <p className="text-[10px] font-bold text-destructive uppercase tracking-widest mb-1">Error</p>
                                    <p className="text-xs text-muted-foreground">{error}</p>
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-14 bg-foreground text-background hover:bg-primary text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 rounded-none shadow-xl"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                            </Button>

                            <Link href="/login" className="block">
                                <button
                                    type="button"
                                    className="w-full py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="w-3.5 h-3.5" />
                                    Back to Sign In
                                </button>
                            </Link>
                        </form>
                    )}
                </div>
            </motion.div>

            {/* Footer */}
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-[10px] text-muted-foreground/60 z-10 uppercase tracking-widest"
            >
                © 2026 Fashion Studio. All rights reserved.
            </motion.p>
        </div>
    )
}
