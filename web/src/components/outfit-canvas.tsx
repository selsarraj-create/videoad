"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { X, RotateCcw, Maximize2, Minimize2 } from "lucide-react"

// ── Zone Definitions ──────────────────────────────────────────
export type GarmentZone = "head" | "torso" | "legs" | "feet"

export const ZONE_CONFIG: Record<
    GarmentZone,
    { label: string; topPercent: number; heightPercent: number; category: string }
> = {
    head: { label: "Accessories", topPercent: 0, heightPercent: 15, category: "accessories" },
    torso: { label: "Tops", topPercent: 15, heightPercent: 35, category: "tops" },
    legs: { label: "Bottoms", topPercent: 50, heightPercent: 35, category: "bottoms" },
    feet: { label: "Shoes", topPercent: 85, heightPercent: 15, category: "shoes" },
}

export const ZONE_SNAP_Y: Record<GarmentZone, number> = {
    head: 7,
    torso: 32,
    legs: 62,
    feet: 88,
}

// Map category string → zone
export function categoryToZone(category: string): GarmentZone {
    switch (category) {
        case "tops": return "torso"
        case "bottoms": return "legs"
        case "shoes": return "feet"
        case "accessories": return "head"
        default: return "torso"
    }
}

// ── Placed Garment Interface ──────────────────────────────────
export interface PlacedGarment {
    id: string
    image_url: string
    zone: GarmentZone
    title: string
    category: string
    scale: number    // 0.5 – 1.5
    offsetX: number  // % from center (-50 to 50)
    offsetY: number  // fine-tune offset in %
}

// ── Draggable Garment on Canvas ──────────────────────────────
function DraggableGarmentOverlay({
    garment,
    isDesktop,
    onRemove,
    onSelect,
    isSelected,
    onScaleChange,
}: {
    garment: PlacedGarment
    isDesktop: boolean
    onRemove: (id: string) => void
    onSelect: (id: string) => void
    isSelected: boolean
    onScaleChange: (id: string, scale: number) => void
}) {
    const snapY = ZONE_SNAP_Y[garment.zone]
    const widthPercent = garment.zone === "feet" ? 30 : garment.zone === "head" ? 25 : 55

    return (
        <div
            className="absolute transition-all duration-300 ease-out group"
            style={{
                top: `${snapY + garment.offsetY}%`,
                left: `${50 + garment.offsetX}%`,
                transform: `translate(-50%, -50%) scale(${garment.scale})`,
                width: `${widthPercent}%`,
                zIndex: isSelected ? 30 : 20,
            }}
            onClick={(e) => {
                e.stopPropagation()
                if (isDesktop) onSelect(garment.id)
            }}
        >
            <img
                src={garment.image_url}
                alt={garment.title}
                className={`w-full h-auto object-contain drop-shadow-xl pointer-events-none select-none ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent rounded-sm" : ""
                    }`}
                draggable={false}
            />

            {/* Controls — desktop only, on selection */}
            {isDesktop && isSelected && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 backdrop-blur-md shadow-xl border border-nimbus px-2 py-1 z-40">
                    <button
                        onClick={(e) => { e.stopPropagation(); onScaleChange(garment.id, Math.min(garment.scale + 0.1, 1.5)) }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-nimbus/20 transition-colors"
                        title="Scale up"
                    >
                        <Maximize2 className="w-3 h-3 text-foreground" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onScaleChange(garment.id, Math.max(garment.scale - 0.1, 0.3)) }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-nimbus/20 transition-colors"
                        title="Scale down"
                    >
                        <Minimize2 className="w-3 h-3 text-foreground" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onScaleChange(garment.id, 1.0) }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-nimbus/20 transition-colors"
                        title="Reset"
                    >
                        <RotateCcw className="w-3 h-3 text-foreground" />
                    </button>
                    <div className="w-px h-5 bg-nimbus mx-0.5" />
                    <button
                        onClick={(e) => { e.stopPropagation(); onRemove(garment.id) }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-red-50 transition-colors"
                        title="Remove"
                    >
                        <X className="w-3 h-3 text-red-500" />
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Main Canvas Component ─────────────────────────────────────

interface OutfitCanvasProps {
    identityMasterUrl: string | null
    placedGarments: PlacedGarment[]
    isDesktop: boolean
    selectedGarmentId: string | null
    onSelectGarment: (id: string | null) => void
    onRemoveGarment: (id: string) => void
    onScaleChange: (id: string, scale: number) => void
    onZoneTap?: (zone: GarmentZone) => void   // mobile only
    vtoResult?: string | null
    rendering?: boolean
}

export function OutfitCanvas({
    identityMasterUrl,
    placedGarments,
    isDesktop,
    selectedGarmentId,
    onSelectGarment,
    onRemoveGarment,
    onScaleChange,
    onZoneTap,
    vtoResult,
    rendering,
}: OutfitCanvasProps) {
    const canvasRef = useRef<HTMLDivElement>(null)

    // Deselect when clicking empty canvas area
    const handleCanvasClick = useCallback(() => {
        onSelectGarment(null)
    }, [onSelectGarment])

    // Render the VTO result if available
    if (vtoResult) {
        return (
            <div className="relative w-full" style={{ aspectRatio: "3/4" }}>
                <div className="absolute inset-0 overflow-hidden bg-white border border-nimbus shadow-2xl">
                    <img
                        src={vtoResult}
                        alt="Outfit Result"
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4">
                        <span className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-foreground text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 border border-nimbus shadow-sm">
                            ✓ Outfit Ready
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div
            ref={canvasRef}
            className="relative w-full select-none"
            style={{ aspectRatio: "3/4" }}
            onClick={handleCanvasClick}
        >
            {/* Base: Identity Master */}
            <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-stone-50 to-stone-100 border border-nimbus/60 shadow-xl">
                {identityMasterUrl ? (
                    <img
                        src={identityMasterUrl}
                        alt="Your Identity"
                        className="w-full h-full object-cover"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center opacity-40">
                            <div className="w-16 h-16 mx-auto mb-3 border-2 border-dashed border-nimbus rounded-full flex items-center justify-center">
                                <span className="text-2xl">👤</span>
                            </div>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">No identity</p>
                        </div>
                    </div>
                )}

                {/* Rendering overlay */}
                {rendering && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-40">
                        <div className="text-center space-y-3">
                            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Generating...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Placed Garments */}
            {placedGarments.map((garment) => (
                <DraggableGarmentOverlay
                    key={garment.id}
                    garment={garment}
                    isDesktop={isDesktop}
                    onRemove={onRemoveGarment}
                    onSelect={(id) => onSelectGarment(id)}
                    isSelected={selectedGarmentId === garment.id}
                    onScaleChange={onScaleChange}
                />
            ))}

            {/* Mobile: Invisible Hit Zones */}
            {!isDesktop && identityMasterUrl && !rendering && (
                <div className="absolute inset-0 z-10">
                    {(Object.entries(ZONE_CONFIG) as [GarmentZone, typeof ZONE_CONFIG[GarmentZone]][]).map(
                        ([zone, config]) => {
                            const hasGarment = placedGarments.some((g) => g.zone === zone)
                            return (
                                <button
                                    key={zone}
                                    className={`absolute w-full border-b border-dashed transition-all duration-300 ${hasGarment
                                            ? "border-primary/20"
                                            : "border-transparent active:bg-primary/10 active:border-primary/30"
                                        }`}
                                    style={{
                                        top: `${config.topPercent}%`,
                                        height: `${config.heightPercent}%`,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onZoneTap?.(zone)
                                    }}
                                >
                                    {/* Subtle zone indicator on tap */}
                                    {!hasGarment && (
                                        <span className="absolute inset-0 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
                                            <span className="text-[10px] text-primary/60 font-bold uppercase tracking-widest bg-white/70 backdrop-blur-sm px-3 py-1">
                                                + {config.label}
                                            </span>
                                        </span>
                                    )}
                                </button>
                            )
                        }
                    )}
                </div>
            )}

            {/* Empty state hint */}
            {placedGarments.length === 0 && identityMasterUrl && !rendering && (
                <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
                    <div className="text-center bg-white/80 backdrop-blur-sm px-6 py-4 border border-nimbus/50 shadow-lg">
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                            {isDesktop ? "Drag garments here" : "Tap to add garments"}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-serif italic">
                            Build your look on your digital twin
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Composite Payload Builder ────────────────────────────────
// Builds the backend-ready data WITHOUT the identity image
export function buildCompositePayload(garments: PlacedGarment[]) {
    return {
        garments: garments.map((g) => ({
            image_url: g.image_url,
            zone: g.zone,
            category: g.category,
            position: {
                topPercent: ZONE_SNAP_Y[g.zone] + g.offsetY,
                scale: g.scale,
                offsetX: g.offsetX,
            },
        })),
        transparent_background: true,
    }
}
