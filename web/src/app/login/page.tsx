"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Loader2, Video } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            router.push('/dashboard')
            router.refresh()
        }
    }

    return (
        <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-[500px] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />

            <Link href="/" className="mb-8 flex items-center gap-2 group z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-zinc-700 shadow-xl group-hover:scale-105 transition-transform">
                    <Video className="w-5 h-5 text-white" />
                </div>
                <h1 className="font-bold text-2xl tracking-tighter text-white">
                    CREATIVE<span className="font-light text-zinc-500">STUDIO</span>
                </h1>
            </Link>

            <Card className="w-full max-w-md bg-zinc-900/50 border-zinc-800 backdrop-blur-xl shadow-2xl relative overflow-hidden z-10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600 opacity-80" />

                <CardHeader className="space-y-1 text-center pb-2">
                    <CardTitle className="text-2xl font-bold tracking-tight text-white">Welcome back</CardTitle>
                    <CardDescription className="text-zinc-400">
                        Enter your credentials to access the studio
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-300">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-blue-500/50 transition-colors"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-zinc-300">Password</Label>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                className="bg-zinc-950/50 border-zinc-800 text-white placeholder:text-zinc-600 focus:border-blue-500/50 transition-colors"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-red-400 text-sm font-medium animate-in fade-in slide-in-from-top-1">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold shadow-lg shadow-blue-900/20 transition-all mt-2"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center text-xs text-zinc-500 pt-0">
                    <div className="w-full h-px bg-zinc-800/50" />
                    <p>Don't have an account? Contact admin for access.</p>
                </CardFooter>
            </Card>
        </div>
    )
}
