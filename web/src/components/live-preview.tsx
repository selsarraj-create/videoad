"use client"

import { useState, useEffect } from "react"
import { Shot } from "@/lib/types"
import { Loader2, Zap } from "lucide-react"

interface LivePreviewProps {
    shot: Shot
}

export function LivePreview({ shot }: LivePreviewProps) {
    const [isGenerating, setIsGenerating] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    // Debounced simulation of preview generation
    useEffect(() => {
        setIsGenerating(true)
        const timer = setTimeout(() => {
            setIsGenerating(false)
            // In a real app, we would fetch the actual preview here
            // For now, we'll just keep the current state or mock a "refresh"
        }, 1500)

        return () => clearTimeout(timer)
    }, [shot.prompt, shot.cameraControls, shot.motionSketch, shot.motionVideoRef])

    // Apply simple CSS transforms for immediate feedback on camera controls
    const transformStyle = {
        transform: `scale(${1 + (shot.cameraControls?.zoom || 0) * 0.1}) 
                    translate(${(shot.cameraControls?.pan?.x || 0) * 10}px, ${(shot.cameraControls?.pan?.y || 0) * 10}px) 
                    rotate(${shot.cameraControls?.roll || 0}deg)
                    perspective(1000px) rotateX(${shot.cameraControls?.tilt || 0}deg)`,
        transition: 'transform 0.2s ease-out'
    }

    return (
        <div className="relative w-full aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/10 group">
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-zinc-300 border border-white/5">
                <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span>Live Preview (Fast)</span>
            </div>

            {isGenerating && (
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-primary/20 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-primary border border-primary/20 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Updating...</span>
                </div>
            )}

            <div className="w-full h-full flex items-center justify-center overflow-hidden" style={{ perspective: '1000px' }}>
                <div
                    className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-zinc-700"
                    style={transformStyle}
                >
                    {/* Placeholder for actual video content */}
                    <div className="text-center p-4">
                        <p className="text-xs font-mono mb-2">{shot.prompt ? shot.prompt.substring(0, 30) + "..." : "No prompt"}</p>
                        <div className="grid grid-cols-10 gap-0.5 w-32 mx-auto opacity-20">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <div key={i} className="aspect-square bg-white/50 rounded-[1px]" />
                            ))}
                        </div>
                    </div>

                    {/* Motion Path Overlay */}
                    {shot.motionSketch && (
                        <div className="absolute inset-0 z-20 opacity-50 pointer-events-none mix-blend-screen">
                            <img src={shot.motionSketch} alt="Motion Path" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
