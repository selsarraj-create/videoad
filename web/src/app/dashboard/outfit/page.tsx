"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { BespokeInput } from "@/components/ui/bespoke-input"
import { StatusPill } from "@/components/ui/status-pill"
import {
    OutfitCanvas, buildCompositePayload,
    type PlacedGarment, type GarmentZone,
    categoryToZone, ZONE_CONFIG,
} from "@/components/outfit-canvas"
import {
    DndContext, DragEndEvent, DragOverlay, DragStartEvent,
    PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from "@dnd-kit/core"
import {
    Sparkles, Loader2, Shirt, ShoppingBag, Package, Crown,
    Layers, Video, ArrowRight, X, Check, Eye, GripVertical,
} from "lucide-react"
import Link from "next/link"

// ── Types ─────────────────────────────────────────────────────
type Category = "tops" | "bottoms" | "shoes" | "accessories"

interface WardrobeItem {
    id: string
    title: string
    original_image_url: string
    clean_image_url: string | null
    status: string
    source: string
    category?: Category
}

const CATEGORIES: { key: Category; label: string; icon: typeof Shirt; zone: GarmentZone }[] = [
    { key: "tops", label: "Tops", icon: Shirt, zone: "torso" },
    { key: "bottoms", label: "Bottoms", icon: Package, zone: "legs" },
    { key: "shoes", label: "Shoes", icon: ShoppingBag, zone: "feet" },
    { key: "accessories", label: "Extras", icon: Crown, zone: "head" },
]

// ── Draggable Sidebar Item ────────────────────────────────────
function DraggableSidebarItem({ item, isPlaced }: { item: WardrobeItem; isPlaced: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: item.id,
        data: { item },
    })

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 }
        : undefined

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            style={style}
            className={`group relative aspect-[3/4] cursor-grab active:cursor-grabbing transition-all duration-300 ${isPlaced ? "ring-2 ring-primary ring-offset-2 ring-offset-paper opacity-60" : "hover:translate-y-[-2px]"
                }`}
        >
            <div className="absolute inset-0 bg-white shadow-sm border border-nimbus/50 overflow-hidden">
                {item.clean_image_url || item.original_image_url ? (
                    <img
                        src={item.clean_image_url || item.original_image_url}
                        alt={item.title}
                        className="w-full h-full object-contain mix-blend-multiply p-3"
                        draggable={false}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-nimbus/10">
                        <Shirt className="w-8 h-8 text-nimbus" />
                    </div>
                )}
            </div>

            {isPlaced && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center shadow-lg z-10">
                    <Check className="w-3 h-3" />
                </div>
            )}

            {/* Drag handle indicator */}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-muted-foreground/60" />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm border-t border-nimbus/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-[10px] text-foreground font-bold uppercase tracking-wide truncate">{item.title}</p>
                {item.status !== "ready" && (
                    <p className="text-[9px] text-amber-600 uppercase tracking-wider mt-0.5">Processing…</p>
                )}
            </div>
        </div>
    )
}

// ── Droppable Canvas Wrapper ──────────────────────────────────
function DroppableCanvas({ children }: { children: React.ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: "outfit-canvas" })
    return (
        <div
            ref={setNodeRef}
            className={`relative transition-all duration-300 ${isOver ? "ring-4 ring-primary/30 ring-offset-4 ring-offset-paper" : ""}`}
        >
            {children}
            {isOver && (
                <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/30 z-50 flex items-center justify-center pointer-events-none">
                    <span className="text-xs text-primary font-bold uppercase tracking-widest bg-white/80 px-4 py-2 shadow-lg">
                        Drop to place
                    </span>
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ══════════════════════════════════════════════════════════════
export default function OutfitBuilderPage() {
    const isDesktop = useMediaQuery("(min-width: 1024px)")

    // ── State ─────────────────────────────────────────────────
    const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([])
    const [activeCategory, setActiveCategory] = useState<Category>("tops")
    const [placedGarments, setPlacedGarments] = useState<PlacedGarment[]>([])
    const [selectedGarmentId, setSelectedGarmentId] = useState<string | null>(null)
    const [lookName, setLookName] = useState("Untitled Look")
    const [masterIdentityUrl, setMasterIdentityUrl] = useState<string | null>(null)
    const [identityId, setIdentityId] = useState<string | null>(null)
    const [vtoResult, setVtoResult] = useState<string | null>(null)
    const [rendering, setRendering] = useState(false)
    const [lookId, setLookId] = useState<string | null>(null)
    const [draggingId, setDraggingId] = useState<string | null>(null)

    // Mobile: bottom sheet
    const [sheetOpen, setSheetOpen] = useState(false)
    const [sheetZone, setSheetZone] = useState<GarmentZone>("torso")

    const supabase = createClient()

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

    // ── Data Loading ──────────────────────────────────────────
    useEffect(() => {
        // Get identity
        supabase
            .from("identities")
            .select("id, master_identity_url")
            .eq("status", "ready")
            .limit(1)
            .single()
            .then(({ data }: { data: { id?: string; master_identity_url?: string } | null }) => {
                if (data?.master_identity_url) {
                    setMasterIdentityUrl(data.master_identity_url)
                    setIdentityId(data.id || null)
                }
            }, () => { })

        // Get wardrobe items
        fetch("/api/wardrobe")
            .then((r) => r.json())
            .then((data) => {
                if (data.items) {
                    // Infer categories from title keywords (fallback)
                    const items = (data.items as WardrobeItem[]).map((item) => ({
                        ...item,
                        category: inferCategory(item.title),
                    }))
                    setWardrobeItems(items)
                }
            })
            .catch(console.error)
    }, [])

    // ── Poll look status ──────────────────────────────────────
    useEffect(() => {
        if (!rendering || !lookId) return
        const interval = setInterval(async () => {
            const { data } = await supabase
                .from("current_looks")
                .select("*")
                .eq("id", lookId)
                .single()
            if (data?.status === "ready" && data.claid_result_url) {
                setVtoResult(data.claid_result_url)
                setRendering(false)
                clearInterval(interval)
            }
            if (data?.status === "failed") {
                setRendering(false)
                clearInterval(interval)
            }
        }, 3000)
        return () => clearInterval(interval)
    }, [rendering, lookId])

    // ── Category Inference ────────────────────────────────────
    function inferCategory(title: string): Category {
        const lower = title.toLowerCase()
        if (/shoe|sneaker|boot|heel|sandal|loafer/i.test(lower)) return "shoes"
        if (/pant|jean|trouser|short|skirt|legging/i.test(lower)) return "bottoms"
        if (/hat|cap|watch|necklace|earring|scarf|bag|belt|glass/i.test(lower)) return "accessories"
        return "tops"
    }

    // ── Filtered items ────────────────────────────────────────
    const categoryItems = wardrobeItems.filter(
        (i) => i.category === activeCategory && i.status === "ready"
    )

    // ── Place / Remove garment ────────────────────────────────
    const placeGarment = useCallback((item: WardrobeItem, zone?: GarmentZone) => {
        const targetZone = zone || categoryToZone(item.category || "tops")
        // Replace existing in same zone
        setPlacedGarments((prev) => {
            const filtered = prev.filter((g) => g.zone !== targetZone)
            return [
                ...filtered,
                {
                    id: item.id,
                    image_url: item.clean_image_url || item.original_image_url,
                    zone: targetZone,
                    title: item.title,
                    category: item.category || "tops",
                    scale: 1.0,
                    offsetX: 0,
                    offsetY: 0,
                },
            ]
        })
        setVtoResult(null)
    }, [])

    const removeGarment = useCallback((id: string) => {
        setPlacedGarments((prev) => prev.filter((g) => g.id !== id))
        setSelectedGarmentId(null)
        setVtoResult(null)
    }, [])

    const updateScale = useCallback((id: string, scale: number) => {
        setPlacedGarments((prev) =>
            prev.map((g) => (g.id === id ? { ...g, scale } : g))
        )
    }, [])

    // ── DnD handlers ──────────────────────────────────────────
    const handleDragStart = (event: DragStartEvent) => {
        setDraggingId(event.active.id as string)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        setDraggingId(null)
        const { active, over } = event
        if (!over || over.id !== "outfit-canvas") return
        const item = active.data.current?.item as WardrobeItem | undefined
        if (item) placeGarment(item)
    }

    // ── Mobile zone tap ───────────────────────────────────────
    const handleZoneTap = (zone: GarmentZone) => {
        const config = ZONE_CONFIG[zone]
        setSheetZone(zone)
        // Switch to the corresponding category
        const cat = config.category as Category
        setActiveCategory(cat)
        setSheetOpen(true)
    }

    const handleMobileSelect = (item: WardrobeItem) => {
        placeGarment(item, sheetZone)
        setSheetOpen(false)
    }

    // ── Try this look ─────────────────────────────────────────
    const handleTryLook = async () => {
        if (!identityId || placedGarments.length === 0) return
        setRendering(true)
        setVtoResult(null)

        try {
            const composite = buildCompositePayload(placedGarments)
            const garmentData = placedGarments.map((g) => ({
                item_id: g.id,
                category: g.category,
                image_url: g.image_url,
                title: g.title,
                price: 0,
                affiliate_url: "",
            }))

            const { data: look } = await supabase
                .from("current_looks")
                .insert({
                    identity_id: identityId,
                    garments: garmentData,
                    name: lookName,
                    status: "building",
                })
                .select()
                .single()

            if (!look) {
                setRendering(false)
                return
            }
            setLookId(look.id)

            await fetch("/api/outfit-tryon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    look_id: look.id,
                    composite_data: composite,
                }),
            })
        } catch (e) {
            console.error(e)
            setRendering(false)
        }
    }

    // ── Is garment placed? ────────────────────────────────────
    const isPlaced = (id: string) => placedGarments.some((g) => g.id === id)

    // ── Get sheet items for the current zone ──────────────────
    const sheetCategoryItems = wardrobeItems.filter(
        (i) => i.category === (ZONE_CONFIG[sheetZone]?.category as Category) && i.status === "ready"
    )

    // ══════════════════════════════════════════════════════════
    // RENDER
    // ══════════════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-paper text-foreground font-sans selection:bg-primary/20">
            {/* ── Header ─────────────────────────────────────── */}
            <header className="h-16 lg:h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 sticky top-0 z-50">
                <div className="flex items-center gap-4 lg:gap-6">
                    <Link href="/dashboard" className="flex items-center gap-2 lg:gap-3">
                        <div className="w-7 h-7 lg:w-8 lg:h-8 bg-primary flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary-foreground" />
                        </div>
                        <span className="font-serif text-lg lg:text-xl tracking-tight text-foreground mix-blend-difference">
                            FASHION<span className="font-sans text-[9px] lg:text-[10px] tracking-[0.2em] ml-1.5 opacity-60">STUDIO</span>
                        </span>
                    </Link>
                    <div className="w-px h-6 lg:h-8 bg-nimbus" />
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h1 className="text-[10px] lg:text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">
                            Digital Mirror
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {placedGarments.length > 0 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] lg:text-xs rounded-none px-2 lg:px-3 py-1">
                            {placedGarments.length} item{placedGarments.length !== 1 ? "s" : ""}
                        </Badge>
                    )}
                    <Link href="/dashboard">
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] lg:text-xs font-bold uppercase tracking-wider text-muted-foreground border-nimbus hover:bg-nimbus/20 rounded-none h-8 lg:h-9"
                        >
                            Dashboard
                        </Button>
                    </Link>
                </div>
            </header>

            {/* No identity banner */}
            {!masterIdentityUrl && (
                <div className="max-w-5xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6">
                    <div className="border border-primary/30 bg-primary/5 p-4 lg:p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-foreground">Set up your identity first</p>
                            <p className="text-xs text-muted-foreground">You need a Master Identity to build outfits.</p>
                        </div>
                        <Link href="/dashboard/onboard">
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-none">
                                Set Up Identity
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            {/* ════════════════════════════════════════════════ */}
            {/* DESKTOP: Stylist Mode (≥1024px)                */}
            {/* ════════════════════════════════════════════════ */}
            {isDesktop ? (
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-12 max-w-[1600px] mx-auto" style={{ height: "calc(100vh - 80px)" }}>

                        {/* LEFT: Wardrobe Sidebar */}
                        <div className="col-span-3 glass-panel flex flex-col overflow-hidden z-20 border-r border-nimbus/30">
                            <div className="p-5 border-b border-nimbus/50 space-y-4">
                                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-serif">
                                    Wardrobe
                                </h2>
                                <div className="flex flex-wrap gap-1.5">
                                    {CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.key}
                                            onClick={() => setActiveCategory(cat.key)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all border ${activeCategory === cat.key
                                                    ? "bg-primary text-primary-foreground border-primary shadow-lg"
                                                    : "bg-white/50 text-muted-foreground border-nimbus hover:border-primary hover:text-foreground"
                                                }`}
                                        >
                                            <cat.icon className="w-3 h-3" /> {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
                                {categoryItems.length === 0 ? (
                                    <div className="text-center py-20 grayscale opacity-60">
                                        <ShoppingBag className="w-8 h-8 text-nimbus mx-auto mb-3" />
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">
                                            No {activeCategory} in wardrobe
                                        </p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-2 font-serif italic">
                                            Add items via upload or marketplace
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {categoryItems.map((item) => (
                                            <DraggableSidebarItem
                                                key={item.id}
                                                item={item}
                                                isPlaced={isPlaced(item.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CENTER: Digital Mirror Canvas */}
                        <div className="col-span-6 flex flex-col overflow-hidden z-10">
                            <div className="p-4 border-b border-nimbus/50 flex items-center justify-between bg-white/40 backdrop-blur-md">
                                <BespokeInput
                                    value={lookName}
                                    onChange={(e) => setLookName(e.target.value)}
                                    className="w-48 !text-lg font-serif !border-b-0 !p-0 focus-visible:!border-b focus-visible:border-foreground bg-transparent"
                                    placeholder="Name your look..."
                                />
                                {placedGarments.length > 0 && (
                                    <button
                                        onClick={() => { setPlacedGarments([]); setVtoResult(null) }}
                                        className="text-[10px] text-muted-foreground hover:text-red-500 uppercase tracking-wider font-bold transition-colors"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto bg-gradient-to-b from-stone-50/50 to-stone-100/50">
                                <div className="w-full max-w-[420px]">
                                    <DroppableCanvas>
                                        <OutfitCanvas
                                            identityMasterUrl={masterIdentityUrl}
                                            placedGarments={placedGarments}
                                            isDesktop={true}
                                            selectedGarmentId={selectedGarmentId}
                                            onSelectGarment={setSelectedGarmentId}
                                            onRemoveGarment={removeGarment}
                                            onScaleChange={updateScale}
                                            vtoResult={vtoResult}
                                            rendering={rendering}
                                        />
                                    </DroppableCanvas>
                                </div>
                            </div>

                            {/* Bottom CTA */}
                            <div className="p-4 border-t border-nimbus/50 bg-white/60 backdrop-blur-md">
                                {rendering ? (
                                    <StatusPill status="processing" />
                                ) : (
                                    <Button
                                        onClick={handleTryLook}
                                        disabled={!masterIdentityUrl || placedGarments.length === 0}
                                        className={`w-full h-14 font-bold text-xs uppercase tracking-[0.2em] transition-all rounded-none ${masterIdentityUrl && placedGarments.length > 0
                                                ? "bg-foreground text-background hover:bg-primary hover:text-white shadow-xl hover:shadow-2xl"
                                                : "bg-nimbus/20 text-muted-foreground cursor-not-allowed"
                                            }`}
                                    >
                                        <Sparkles className="w-4 h-4 mr-2" /> Try This Look
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Current Look Summary */}
                        <div className="col-span-3 glass-panel flex flex-col overflow-hidden z-20 border-l border-nimbus/30">
                            <div className="p-5 border-b border-nimbus/50">
                                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-serif">
                                    Current Look
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5">
                                {placedGarments.length === 0 ? (
                                    <div className="text-center py-20 grayscale opacity-60">
                                        <Layers className="w-8 h-8 text-nimbus mx-auto mb-3" />
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">No items placed</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-2 font-serif italic">
                                            Drag garments onto your digital twin
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {placedGarments.map((g) => (
                                            <div
                                                key={g.id}
                                                className={`flex items-center gap-3 p-3 bg-white/50 border transition-all cursor-pointer ${selectedGarmentId === g.id
                                                        ? "border-primary shadow-md"
                                                        : "border-nimbus hover:border-primary/50"
                                                    }`}
                                                onClick={() => setSelectedGarmentId(g.id === selectedGarmentId ? null : g.id)}
                                            >
                                                <div className="w-12 h-12 border border-nimbus overflow-hidden bg-white flex-shrink-0">
                                                    <img
                                                        src={g.image_url}
                                                        alt=""
                                                        className="w-full h-full object-contain mix-blend-multiply p-1"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] text-foreground font-bold truncate uppercase tracking-wide">
                                                        {g.title}
                                                    </p>
                                                    <p className="text-[10px] text-primary font-serif capitalize">{g.zone}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        removeGarment(g.id)
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Drag overlay — shows the item being dragged */}
                    <DragOverlay>
                        {draggingId ? (() => {
                            const item = wardrobeItems.find((i) => i.id === draggingId)
                            if (!item) return null
                            return (
                                <div className="w-24 h-32 bg-white/90 backdrop-blur-md shadow-2xl border-2 border-primary overflow-hidden pointer-events-none">
                                    <img
                                        src={item.clean_image_url || item.original_image_url}
                                        alt=""
                                        className="w-full h-full object-contain mix-blend-multiply p-2"
                                    />
                                </div>
                            )
                        })() : null}
                    </DragOverlay>
                </DndContext>
            ) : (
                /* ══════════════════════════════════════════════ */
                /* MOBILE: Touch Mode (<1024px)                 */
                /* ══════════════════════════════════════════════ */
                <div className="flex flex-col" style={{ height: "calc(100vh - 64px)" }}>
                    {/* Canvas area */}
                    <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 bg-gradient-to-b from-stone-50 to-stone-100">
                        <div className="w-full max-w-[320px]">
                            <OutfitCanvas
                                identityMasterUrl={masterIdentityUrl}
                                placedGarments={placedGarments}
                                isDesktop={false}
                                selectedGarmentId={null}
                                onSelectGarment={() => { }}
                                onRemoveGarment={removeGarment}
                                onScaleChange={updateScale}
                                onZoneTap={handleZoneTap}
                                vtoResult={vtoResult}
                                rendering={rendering}
                            />
                        </div>

                        {/* Floating garment chips */}
                        {placedGarments.length > 0 && !vtoResult && (
                            <div className="absolute bottom-3 left-3 right-3 flex gap-2 overflow-x-auto pb-1">
                                {placedGarments.map((g) => (
                                    <div
                                        key={g.id}
                                        className="flex-shrink-0 flex items-center gap-2 bg-white/90 backdrop-blur-md shadow-lg px-3 py-2 border border-nimbus"
                                    >
                                        <img
                                            src={g.image_url}
                                            alt=""
                                            className="w-6 h-6 object-contain mix-blend-multiply"
                                        />
                                        <span className="text-[10px] text-foreground font-bold uppercase tracking-wider max-w-[60px] truncate">
                                            {g.title}
                                        </span>
                                        <button onClick={() => removeGarment(g.id)}>
                                            <X className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Bottom CTA */}
                    <div className="p-4 bg-white border-t border-nimbus/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                        <Button
                            onClick={handleTryLook}
                            disabled={!masterIdentityUrl || placedGarments.length === 0 || rendering}
                            className={`w-full h-12 rounded-none font-bold text-xs uppercase tracking-[0.2em] shadow-xl ${!masterIdentityUrl || placedGarments.length === 0 || rendering
                                    ? "bg-nimbus/20 text-muted-foreground"
                                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                                }`}
                        >
                            {rendering ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-2" /> Try This Look ({placedGarments.length})</>
                            )}
                        </Button>
                    </div>

                    {/* Mobile Bottom Sheet Drawer */}
                    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                        <SheetContent side="bottom" className="max-h-[60vh] rounded-t-2xl border-t-2 border-primary/20 bg-paper">
                            <SheetHeader className="pb-2">
                                <SheetTitle className="text-sm font-bold uppercase tracking-widest text-foreground">
                                    {ZONE_CONFIG[sheetZone]?.label || "Select"}
                                </SheetTitle>
                                <SheetDescription className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                    Tap to place on your look
                                </SheetDescription>
                            </SheetHeader>

                            <div className="overflow-y-auto px-4 pb-6">
                                {sheetCategoryItems.length === 0 ? (
                                    <div className="text-center py-12 opacity-50">
                                        <ShoppingBag className="w-8 h-8 text-nimbus mx-auto mb-3" />
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest">
                                            No items available
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-3">
                                        {sheetCategoryItems.map((item) => {
                                            const placed = isPlaced(item.id)
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleMobileSelect(item)}
                                                    className={`relative bg-white border transition-all ${placed
                                                            ? "border-primary ring-1 ring-primary shadow-lg"
                                                            : "border-nimbus hover:border-primary/50 active:scale-95"
                                                        }`}
                                                >
                                                    <div className="aspect-square relative overflow-hidden">
                                                        <img
                                                            src={item.clean_image_url || item.original_image_url}
                                                            alt={item.title}
                                                            className="w-full h-full object-contain mix-blend-multiply p-2"
                                                        />
                                                        {placed && (
                                                            <div className="absolute top-1 right-1 w-5 h-5 bg-primary text-primary-foreground flex items-center justify-center shadow">
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-2 border-t border-nimbus/30">
                                                        <p className="text-[9px] font-bold text-foreground truncate uppercase">
                                                            {item.title}
                                                        </p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            )}
        </div>
    )
}
