"use client"

import { motion } from "framer-motion"
import { Loader2, Sparkles } from "lucide-react"

interface StatusPillProps {
    status: 'processing' | 'rendering' | 'polishing'
    progress?: number
}

export function StatusPill({ status }: StatusPillProps) {
    const messages = {
        processing: "QUANTIZING GEOMETRY",
        rendering: "SYNTHESIZING PIXELS",
        polishing: "APPLYING MOTION GRADE"
    }

    return (
        <div className="w-full h-14 relative overflow-hidden bg-zinc-900 flex items-center justify-center">
            {/* Vaporwave Gradient Background */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-cyan-400"
                animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear"
                }}
                style={{ backgroundSize: "200% 200%" }}
            />

            {/* Glass Overlay */}
            <div className="absolute inset-1 bg-black/40 backdrop-blur-[2px] z-10" />

            {/* Content */}
            <div className="relative z-20 flex items-center gap-3 text-white">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span className="text-xs font-bold uppercase tracking-[0.2em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {messages[status]}
                </span>
                <Sparkles className="w-4 h-4 text-pink-300 animate-pulse" />
            </div>

            {/* Scanline Effect */}
            <div className="absolute inset-0 bg-[url('/scanline.png')] opacity-10 pointer-events-none z-30 bg-repeat-y" style={{ backgroundSize: '100% 4px' }} />
        </div>
    )
}
