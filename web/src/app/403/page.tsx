"use client"

import Link from "next/link"
import { ShieldX, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"

export default function ForbiddenPage() {
    return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full text-center space-y-6"
            >
                <div className="w-20 h-20 mx-auto bg-red-50 border border-red-200 flex items-center justify-center">
                    <ShieldX className="w-10 h-10 text-red-400" />
                </div>

                <div className="space-y-2">
                    <h1 className="font-serif text-3xl tracking-tight">Access Denied</h1>
                    <p className="text-muted-foreground text-sm">
                        You don&apos;t have permission to view this page. This area is restricted to a different account type.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 h-12 bg-foreground text-white hover:bg-foreground/90 transition-colors text-xs uppercase tracking-[0.2em] font-bold px-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go to Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
                    >
                        Return Home
                    </Link>
                </div>
            </motion.div>
        </div>
    )
}
