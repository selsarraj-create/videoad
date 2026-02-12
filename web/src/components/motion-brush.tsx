"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Eraser, Pencil, Undo, Save } from "lucide-react"

interface MotionBrushProps {
    width?: number
    height?: number
    onSave: (dataUrl: string) => void
    initialData?: string
}

export function MotionBrush({ width = 320, height = 180, onSave, initialData }: MotionBrushProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [tool, setTool] = useState<'brush' | 'eraser'>('brush')
    const [lastPoint, setLastPoint] = useState<{ x: number, y: number } | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        if (initialData) {
            const img = new Image()
            img.onload = () => ctx.drawImage(img, 0, 0)
            img.src = initialData
        } else {
            ctx.clearRect(0, 0, width, height)
        }
    }, [initialData, width, height])

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        setIsDrawing(true)
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        ctx.beginPath()
        ctx.moveTo(x, y)
        setLastPoint({ x, y })
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        ctx.lineWidth = tool === 'brush' ? 4 : 20
        ctx.strokeStyle = tool === 'brush' ? '#00E5FF' : 'rgba(0,0,0,1)' // Cyan for motion
        ctx.shadowBlur = tool === 'brush' ? 10 : 0
        ctx.shadowColor = '#00E5FF'

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out'
        } else {
            ctx.globalCompositeOperation = 'source-over'
        }

        ctx.lineTo(x, y)
        ctx.stroke()
        setLastPoint({ x, y })
    }

    const stopDrawing = () => {
        if (!isDrawing) return
        setIsDrawing(false)

        if (tool === 'brush' && lastPoint) {
            // Draw arrow head
            const canvas = canvasRef.current
            if (!canvas) return
            const ctx = canvas.getContext('2d')
            if (!ctx || !lastPoint) return

            // Simple circle at the end for now to denote "destination"
            // Calculating true angle requires history of points which state updates might miss in rapid draw
            // A dot is a good enough "waypoint" indicator for now
            ctx.beginPath()
            ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2)
            ctx.fillStyle = '#00E5FF'
            ctx.fill()
        }
        setLastPoint(null)
    }

    const handleSave = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        onSave(canvas.toDataURL())
    }

    const clear = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, width, height)
    }

    return (
        <div className="flex flex-col gap-2 items-center">
            <div className="border border-zinc-700 rounded-md overflow-hidden bg-zinc-900/50 relative cursor-crosshair">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    className="touch-none"
                    style={{ backgroundSize: 'cover' }}
                />
                {/* Grid overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-10"
                    style={{ backgroundImage: 'linear-gradient(#444 1px, transparent 1px), linear-gradient(90deg, #444 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
            </div>

            <div className="flex gap-2">
                <Button variant={tool === 'brush' ? 'default' : 'outline'} size="sm" onClick={() => setTool('brush')} className={tool === 'brush' ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "border-zinc-700 text-zinc-400"}>
                    <Pencil className="w-3 h-3 mr-1" /> Draw
                </Button>
                <Button variant={tool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => setTool('eraser')} className={tool === 'eraser' ? "bg-red-600 hover:bg-red-500 text-white" : "border-zinc-700 text-zinc-400"}>
                    <Eraser className="w-3 h-3 mr-1" /> Erase
                </Button>
                <Button variant="outline" size="sm" onClick={clear} className="border-zinc-700 text-zinc-400 hover:text-white">
                    <Undo className="w-3 h-3 mr-1" /> Clear
                </Button>
                <Button size="sm" onClick={handleSave} className="ml-2 bg-zinc-100 text-zinc-900 hover:bg-white">
                    <Save className="w-3 h-3 mr-1" /> Save Mask
                </Button>
            </div>
        </div>
    )
}
