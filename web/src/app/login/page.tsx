"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Loader2, Sparkles } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

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
                router.push('/dashboard')
                router.refresh()
            }
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/dashboard`
                }
            })
            if (error) {
                setError(error.message)
            } else {
                setSuccess("Check your email for a confirmation link!")
            }
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 selection:bg-purple-500/30">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />

            <Link href="/" className="mb-8 flex items-center gap-2 group z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center border border-purple-500/30 shadow-xl group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-2xl tracking-tighter text-white">
                    FASHION<span className="font-light text-zinc-600">STUDIO</span>
                </h1>
            </Link>

            <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-xl shadow-2xl relative overflow-hidden z-10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-600 opacity-80" />

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
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-purple-500/50 transition-colors"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-zinc-300">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder={mode === 'signup' ? 'Min 6 characters' : ''}
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-purple-500/50 transition-colors"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-lg bg-green-900/20 border border-green-900/50 text-green-400 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                {success}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className={`w-full h-11 font-bold shadow-lg transition-all mt-2 ${mode === 'login'
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
                            ? <>Don&apos;t have an account? <button onClick={() => setMode('signup')} className="text-purple-400 hover:text-purple-300 font-medium">Create one</button></>
                            : <>Already have an account? <button onClick={() => setMode('login')} className="text-purple-400 hover:text-purple-300 font-medium">Sign in</button></>
                        }
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
