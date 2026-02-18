"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Sparkles, Lock, Check } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password !== confirmPassword) {
            setError("Passwords do not match")
            return
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.updateUser({ password })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            setSuccess(true)
            setTimeout(() => {
                router.push('/dashboard')
                router.refresh()
            }, 2000)
        }
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
                            {success ? 'Password Updated' : 'Set New Password'}
                        </h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                            {success
                                ? 'Redirecting you to the studio...'
                                : 'Enter your new password below'
                            }
                        </p>
                    </div>

                    {success ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="w-14 h-14 bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Check className="w-7 h-7 text-primary" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center">
                                Your password has been updated successfully.
                            </p>
                            <Loader2 className="w-4 h-4 animate-spin text-primary mt-2" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">New Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        id="password"
                                        type="password"
                                        placeholder="Min 6 characters"
                                        className="w-full h-12 pl-10 pr-4 bg-white/60 border border-nimbus text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Confirm Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                    <input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="Repeat your password"
                                        className="w-full h-12 pl-10 pr-4 bg-white/60 border border-nimbus text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
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
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
                            </Button>
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
                © 2026 Look Maison. All rights reserved.
            </motion.p>
        </div>
    )
}
