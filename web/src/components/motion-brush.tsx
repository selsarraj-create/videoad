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
            // Clear with transparent background (or semi-transparent overlay guide)
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
        ctx.beginPath()
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        ctx.lineWidth = tool === 'brush' ? 5 : 20
        ctx.strokeStyle = tool === 'brush' ? '#ff0000' : 'rgba(0,0,0,1)' // Red for motion path

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out'
        } else {
            ctx.globalCompositeOperation = 'source-over'
        }

        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top)
        ctx.stroke()
    }

    const stopDrawing = () => {
        setIsDrawing(false)
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
            <div className="border rounded-md overflow-hidden bg-slate-50 relative cursor-crosshair">
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
                {/* Grid overlay for reference */}
                <div className="absolute inset-0 pointer-events-none opacity-20"
                    style={{ backgroundImage: 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />
            </div>

            <div className="flex gap-2">
                <Button variant={tool === 'brush' ? 'default' : 'outline'} size="sm" onClick={() => setTool('brush')}>
                    <Pencil className="w-4 h-4 mr-1" /> Draw
                </Button>
                <Button variant={tool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => setTool('eraser')}>
                    <Eraser className="w-4 h-4 mr-1" /> Erase
                </Button>
                <Button variant="outline" size="sm" onClick={clear}>
                    <Undo className="w-4 h-4 mr-1" /> Clear
                </Button>
                <Button size="sm" onClick={handleSave} className="ml-2">
                    <Save className="w-4 h-4 mr-1" /> Save Mask
                </Button>
            </div>
        </div>
    )
}
