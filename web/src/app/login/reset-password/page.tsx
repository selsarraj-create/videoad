"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, Sparkles, Lock, CheckCircle2 } from "lucide-react"
import Link from "next/link"

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
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 selection:bg-purple-500/30">
            {/* Background Glow */}
            <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-purple-900/15 rounded-full blur-[150px] pointer-events-none" />

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
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-blue-500 opacity-80" />

                <CardHeader className="space-y-1 text-center pb-2">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">
                        {success ? 'Password updated' : 'Set new password'}
                    </CardTitle>
                    <CardDescription className="text-zinc-400">
                        {success
                            ? 'Redirecting you to the dashboard...'
                            : 'Enter your new password below'
                        }
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                    {success ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <div className="w-14 h-14 rounded-full bg-green-900/20 border border-green-800/30 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-green-400" />
                            </div>
                            <p className="text-sm text-zinc-400 text-center">
                                Your password has been updated successfully.
                            </p>
                            <Loader2 className="w-4 h-4 animate-spin text-purple-400 mt-2" />
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-zinc-300">New password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Min 6 characters"
                                        className="pl-10 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-purple-500/50 transition-all"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password" className="text-zinc-300">Confirm password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="Repeat your password"
                                        className="pl-10 bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-purple-500/50 transition-all"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-11 font-bold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg shadow-purple-900/20 transition-all"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
