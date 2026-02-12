"use client"

import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RotateCw, Move, Maximize, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface CameraControlsProps {
    values: {
        pan: { x: number, y: number }
        zoom: number
        tilt: number
        roll: number
    }
    onChange: (values: CameraControlsProps['values']) => void
}

export function CameraControls({ values, onChange }: CameraControlsProps) {
    // Local state for smooth slider updates if needed, 
    // but for now directly controlling via props is fine given React's speed.

    const update = (key: keyof CameraControlsProps['values'], val: any) => {
        onChange({ ...values, [key]: val })
    }

    const reset = () => {
        onChange({
            pan: { x: 0, y: 0 },
            zoom: 0,
            tilt: 0,
            roll: 0
        })
    }

    return (
        <div className="space-y-4 p-4 bg-black/20 rounded-lg border border-white/5">
            <div className="flex items-center justify-between mb-2">
                <Label className="text-[10px] font-bold uppercase text-zinc-500">Camera Director</Label>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-zinc-800 rounded-full"
                    onClick={reset}
                >
                    <RefreshCw className="w-3 h-3 text-zinc-500" />
                </Button>
            </div>

            {/* Pan Controls (X/Y) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                        <Move className="w-3 h-3 text-blue-400" /> Pan (Horizontal / Vertical)
                    </Label>
                    <span className="text-[9px] font-mono text-zinc-600">{values.pan.x.toFixed(1)}, {values.pan.y.toFixed(1)}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Slider
                        defaultValue={[0]}
                        value={[values.pan.x]}
                        min={-10} max={10} step={0.1}
                        onValueChange={(v: number[]) => update('pan', { ...values.pan, x: v[0] })}
                        className="[&>.absolute]:bg-blue-600"
                    />
                    <Slider
                        defaultValue={[0]}
                        value={[values.pan.y]}
                        min={-10} max={10} step={0.1}
                        onValueChange={(v: number[]) => update('pan', { ...values.pan, y: v[0] })}
                        className="[&>.absolute]:bg-blue-600"
                    />
                </div>
            </div>

            {/* Zoom */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                        <Maximize className="w-3 h-3 text-green-400" /> Zoom
                    </Label>
                    <span className="text-[9px] font-mono text-zinc-600">{values.zoom.toFixed(1)}x</span>
                </div>
                <Slider
                    defaultValue={[0]}
                    value={[values.zoom]}
                    min={-5} max={5} step={0.1}
                    onValueChange={(v: number[]) => update('zoom', v[0])}
                    className="[&>.absolute]:bg-green-600"
                />
            </div>

            {/* Tilt / Roll */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                        <RotateCw className="w-3 h-3 text-purple-400" /> Tilt / Roll
                    </Label>
                    <span className="text-[9px] font-mono text-zinc-600">{values.tilt.toFixed(1)}°</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Slider
                        defaultValue={[0]}
                        value={[values.tilt]}
                        min={-45} max={45} step={1}
                        onValueChange={(v: number[]) => update('tilt', v[0])}
                        className="[&>.absolute]:bg-purple-600"
                    />
                    <Slider
                        defaultValue={[0]}
                        value={[values.roll]}
                        min={-180} max={180} step={1}
                        onValueChange={(v: number[]) => update('roll', v[0])}
                        className="[&>.absolute]:bg-purple-600"
                    />
                </div>
            </div>
        </div>
    )
}
