"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Sparkles, Loader2, Plus, X, ShoppingBag, Shirt,
    ArrowRight, Check, RefreshCcw, Eye,
    Layers, Video, Link2, Package
} from "lucide-react"
import { PresetGrid } from "@/components/preset-grid"
import { type Preset, PRESETS } from "@/lib/presets"
import Link from "next/link"
import { BespokeInput } from "@/components/ui/bespoke-input"
import { ParticleSilhouette } from "@/components/ui/particle-silhouette"
import { StatusPill } from "@/components/ui/status-pill"

type Category = 'tops' | 'bottoms' | 'shoes' | 'accessories'

interface AffiliateItem {
    id: string
    title: string
    image_url: string | null
    affiliate_url: string | null
    price: number
    category: Category
}

interface LookGarment {
    item_id: string
    category: Category
    image_url: string
    title: string
    price: number
    affiliate_url: string
}

interface Look {
    id: string
    identity_id: string
    garments: LookGarment[]
    name: string
    claid_result_url: string | null
    status: string
}

const CATEGORIES: { key: Category; label: string; icon: typeof Shirt }[] = [
    { key: 'tops', label: 'Tops', icon: Shirt },
    { key: 'bottoms', label: 'Bottoms', icon: Package },
    { key: 'shoes', label: 'Shoes', icon: ShoppingBag },
    { key: 'accessories', label: 'Extras', icon: Sparkles },
]

export default function OutfitBuilderPage() {
    const [items, setItems] = useState<AffiliateItem[]>([])
    const [activeCategory, setActiveCategory] = useState<Category>('tops')
    const [currentLook, setCurrentLook] = useState<LookGarment[]>([])
    const [lookId, setLookId] = useState<string | null>(null)
    const [lookName, setLookName] = useState("Untitled Look")
    const [masterIdentityUrl, setMasterIdentityUrl] = useState<string | null>(null)
    const [identityId, setIdentityId] = useState<string | null>(null)
    const [claidResult, setClaidResult] = useState<string | null>(null)
    const [rendering, setRendering] = useState(false)
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)

    const supabase = createClient()

    // Load identity + affiliate items
    useEffect(() => {
        // Get identity
        supabase.from('identities').select('id, master_identity_url').eq('status', 'ready').limit(1).single()
            .then(({ data }: { data: { id?: string; master_identity_url?: string } | null }) => {
                if (data?.master_identity_url) {
                    setMasterIdentityUrl(data.master_identity_url)
                    setIdentityId(data.id || null)
                }
            }, () => { })

        // Get affiliate items
        supabase.from('affiliate_items').select('*').order('created_at', { ascending: false })
            .then(({ data }) => {
                if (data) setItems(data as AffiliateItem[])
            })
    }, [])

    // Poll look status when rendering
    useEffect(() => {
        if (!rendering || !lookId) return
        const interval = setInterval(async () => {
            const { data } = await supabase.from('current_looks').select('*').eq('id', lookId).single()
            if (data?.status === 'ready' && data.claid_result_url) {
                setClaidResult(data.claid_result_url)
                setRendering(false)
                clearInterval(interval)
            }
            if (data?.status === 'failed') {
                setRendering(false)
                clearInterval(interval)
            }
        }, 3000)
        return () => clearInterval(interval)
    }, [rendering, lookId])

    const categoryItems = items.filter(i => i.category === activeCategory)

    const addToLook = (item: AffiliateItem) => {
        // Replace existing item in same category
        const filtered = currentLook.filter(g => g.category !== item.category)
        setCurrentLook([...filtered, {
            item_id: item.id,
            category: item.category,
            image_url: item.image_url || '',
            title: item.title,
            price: item.price,
            affiliate_url: item.affiliate_url || ''
        }])
        setClaidResult(null)
    }

    const removeFromLook = (category: Category) => {
        setCurrentLook(currentLook.filter(g => g.category !== category))
        setClaidResult(null)
    }

    const totalCost = currentLook.reduce((sum, g) => sum + (g.price || 0), 0)

    const handleTryLook = async () => {
        if (!identityId || currentLook.length === 0) return
        setRendering(true)
        setClaidResult(null)

        try {
            // Save look to DB
            const { data: look } = await supabase.from('current_looks').insert({
                identity_id: identityId,
                garments: currentLook,
                name: lookName,
                status: 'building'
            }).select().single()

            if (!look) { setRendering(false); return }
            setLookId(look.id)

            // Trigger outfit try-on
            await fetch('/api/outfit-tryon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ look_id: look.id })
            })
        } catch (e) {
            console.error(e)
            setRendering(false)
        }
    }

    const handleGenerateVideo = async () => {
        if (!claidResult || !selectedPreset) return
        // Redirect to dashboard with look data for video generation
        window.location.href = `/dashboard?lookImage=${encodeURIComponent(claidResult)}&preset=${selectedPreset.id}`
    }

    const isInLook = (itemId: string) => currentLook.some(g => g.item_id === itemId)

    // ==========================================
    // RENDER
    // ==========================================
    return (
        <div className="min-h-screen bg-paper text-foreground font-sans selection:bg-primary/20">
            {/* Header */}
            {/* Header */}
            <header className="h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-serif text-xl tracking-tight text-foreground mix-blend-difference">
                            FASHION<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">STUDIO</span>
                        </span>
                    </Link>
                    <div className="w-px h-8 bg-nimbus" />
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h1 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Outfit Builder</h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {totalCost > 0 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs rounded-none px-3 py-1">
                            Total: ${totalCost.toFixed(2)}
                        </Badge>
                    )}
                    <Link href="/dashboard/content">
                        <Button variant="outline" size="sm" className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-nimbus hover:bg-nimbus/20 rounded-none h-9">
                            Content Vault
                        </Button>
                    </Link>
                </div>
            </header>

            {/* No identity banner */}
            {!masterIdentityUrl && (
                <div className="max-w-5xl mx-auto px-6 pt-6">
                    <div className="rounded-2xl border border-purple-800/40 bg-purple-900/10 p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-white">Set up your identity first</p>
                            <p className="text-xs text-zinc-500">You need a Master Identity to build outfits.</p>
                        </div>
                        <Link href="/dashboard/onboard">
                            <Button className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">
                                Set Up Identity
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            {/* ===================== DESKTOP: THREE-PANE ===================== */}
            <div className="hidden md:grid md:grid-cols-12 max-w-[1400px] mx-auto" style={{ height: 'calc(100vh - 56px)' }}>

                {/* LEFT PANE: Affiliate Library */}
                <div className="col-span-4 glass-panel flex flex-col overflow-hidden z-20">
                    <div className="p-6 border-b border-nimbus/50 space-y-4">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] font-serif">Affiliate Library</h2>
                        <div className="flex gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                                    className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all border
                                        ${activeCategory === cat.key
                                            ? 'bg-primary text-primary-foreground border-primary shadow-lg'
                                            : 'bg-white/50 text-muted-foreground border-nimbus hover:border-primary hover:text-foreground'
                                        }`}>
                                    <cat.icon className="w-3 h-3" /> {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        {categoryItems.length === 0 ? (
                            <div className="text-center py-20 grayscale opacity-60">
                                <ShoppingBag className="w-8 h-8 text-nimbus mx-auto mb-3" />
                                <p className="text-xs text-muted-foreground uppercase tracking-widest">No {activeCategory}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {categoryItems.map(item => {
                                    const selected = isInLook(item.id)
                                    return (
                                        <button key={item.id} onClick={() => selected ? removeFromLook(item.category) : addToLook(item)}
                                            className={`group relative aspect-[3/4] transition-all duration-500 ${selected
                                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-paper'
                                                : 'hover:translate-y-[-2px]'
                                                }`}>
                                            <div className="absolute inset-0 bg-white shadow-sm border border-nimbus/50 overflow-hidden">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover mix-blend-multiply p-4" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-nimbus/10">
                                                        <Shirt className="w-8 h-8 text-nimbus" />
                                                    </div>
                                                )}
                                            </div>

                                            {selected && (
                                                <div className="absolute top-2 right-2 w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center shadow-lg z-10">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}

                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-white/90 backdrop-blur-sm border-t border-nimbus/50 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                                                <p className="text-[10px] text-foreground font-bold uppercase tracking-wide truncate">{item.title}</p>
                                                <p className="text-[10px] text-muted-foreground font-serif mt-0.5">${item.price?.toFixed(2)}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* CENTER PANE: Canvas */}
                <div className="col-span-4 flex flex-col overflow-hidden relative z-10 glass-panel border-x border-white/20">
                    <div className="p-6 border-b border-nimbus/50 flex items-center justify-between bg-white/40 backdrop-blur-md">
                        <BespokeInput
                            value={lookName}
                            onChange={(e) => setLookName(e.target.value)}
                            className="w-48 !text-lg font-serif !border-b-0 !p-0 focus-visible:!border-b focus-visible:border-foreground bg-transparent"
                            placeholder="Name your look..."
                        />
                        <Badge className="bg-white text-muted-foreground border-nimbus text-[10px] shadow-sm rounded-none">
                            {currentLook.length} item{currentLook.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                        {/* Identity + Result Preview */}
                        <div className="relative w-full max-w-[340px]">
                            {claidResult ? (
                                <div className="rounded-none overflow-hidden border border-nimbus shadow-2xl bg-white p-2 rotate-1 hover:rotate-0 transition-transform duration-500">
                                    <img src={claidResult} alt="Outfit Result" className="w-full object-contain" />
                                    <div className="absolute bottom-4 left-4">
                                        <Badge className="bg-white/80 text-foreground border-nimbus text-[10px] backdrop-blur shadow-sm rounded-none uppercase tracking-widest">
                                            ✓ Outfit Ready
                                        </Badge>
                                    </div>
                                </div>
                            ) : masterIdentityUrl ? (
                                <div className="rounded-none overflow-hidden border border-nimbus bg-white shadow-xl relative aspect-[3/4] group">
                                    <div className="absolute inset-4 border border-nimbus/30 z-10 pointer-events-none" />
                                    <img src={masterIdentityUrl} alt="Identity" className="w-full h-full object-cover grayscale-[10%] opacity-90 group-hover:opacity-100 transition-opacity" />

                                    {/* Particle Overlay (Optional - can be enabled if we want 3D here too) */}
                                    {/* <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mix-blend-multiply"><ParticleSilhouette /></div> */}

                                    {currentLook.length > 0 && !rendering && (
                                        <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-white via-white/80 to-transparent pt-12">
                                            <div className="text-center">
                                                <Layers className="w-6 h-6 text-primary mx-auto mb-2" />
                                                <p className="text-xs text-foreground font-bold uppercase tracking-widest">{currentLook.length} Garments</p>
                                                <p className="text-[10px] text-muted-foreground font-serif italic">Ready to drape</p>
                                            </div>
                                        </div>
                                    )}
                                    {rendering && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-20">
                                            <div className="w-full px-8">
                                                <StatusPill status="processing" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-none border border-dashed border-nimbus bg-paper py-24 text-center">
                                    <Eye className="w-10 h-10 text-nimbus mx-auto mb-3" />
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">No identity found</p>
                                </div>
                            )}
                        </div>

                        {/* Current Look Items */}
                        {currentLook.length > 0 && (
                            <div className="mt-8 w-full max-w-[340px] space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-nimbus/50">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">Current Look</p>
                                    <span className="text-xs font-serif font-bold text-foreground">${totalCost.toFixed(2)}</span>
                                </div>
                                {currentLook.map(g => (
                                    <div key={g.category} className="flex items-center gap-3 p-2 bg-white/40 border border-nimbus hover:border-primary transition-colors group">
                                        {g.image_url && (
                                            <div className="w-10 h-10 border border-nimbus overflow-hidden bg-white">
                                                <img src={g.image_url} alt="" className="w-full h-full object-cover mix-blend-multiply" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-foreground font-medium truncate uppercase tracking-wide">{g.title}</p>
                                            <p className="text-[10px] text-primary font-bold font-serif">${g.price?.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => removeFromLook(g.category)}
                                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-500 transition-colors">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Try This Look Button */}
                    <div className="p-6 border-t border-nimbus/50 bg-white/40 backdrop-blur-md">
                        {rendering ? (
                            <StatusPill status="processing" />
                        ) : (
                            <Button
                                onClick={handleTryLook}
                                disabled={!masterIdentityUrl || currentLook.length === 0}
                                className={`w-full h-14 font-bold text-xs uppercase tracking-[0.2em] transition-all rounded-none ${masterIdentityUrl && currentLook.length > 0
                                    ? 'bg-foreground text-background hover:bg-primary hover:text-white shadow-xl hover:shadow-2xl'
                                    : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                    }`}
                            >
                                <Sparkles className="w-4 h-4 mr-2" /> Try This Look
                            </Button>
                        )}
                    </div>
                </div>

                {/* RIGHT PANE: Presets & Render Queue */}
                <div className="col-span-4 glass-panel flex flex-col overflow-hidden z-20">
                    <div className="p-6 border-b border-nimbus/50">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] font-serif">Style Presets & Render</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        {claidResult ? (
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <p className="text-[10px] text-foreground uppercase tracking-[0.2em] font-bold">Choose Video Style</p>
                                    <PresetGrid
                                        onSelect={setSelectedPreset}
                                        selectedPresetId={selectedPreset?.id || null}
                                    />
                                </div>
                                <Button
                                    onClick={handleGenerateVideo}
                                    disabled={!selectedPreset}
                                    className={`w-full h-14 font-bold text-xs uppercase tracking-[0.2em] transition-all rounded-none ${selectedPreset
                                        ? 'bg-foreground text-background hover:bg-primary shadow-xl hover:shadow-2xl'
                                        : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                        }`}
                                >
                                    <Video className="w-4 h-4 mr-2" /> Generate Video
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-24 grayscale opacity-60">
                                <Video className="w-8 h-8 text-nimbus mx-auto mb-3" />
                                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Render Output Locked</p>
                                <p className="text-[10px] text-muted-foreground/60 mt-2 font-serif italic">complete current look to unlock</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ===================== MOBILE: THUMB-FIRST TRAY ===================== */}
            <div className="md:hidden flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
                {/* Identity Preview */}
                <div className="flex-1 relative overflow-hidden bg-white/50">
                    {claidResult ? (
                        <img src={claidResult} alt="Outfit" className="w-full h-full object-contain p-8" />
                    ) : masterIdentityUrl ? (
                        <div className="w-full h-full relative">
                            <img src={masterIdentityUrl} alt="Identity" className="w-full h-full object-contain opacity-50 grayscale-[20%]" />
                            {currentLook.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center p-8">
                                    <div className="text-center">
                                        <p className="text-sm font-serif text-muted-foreground italic">Select garments to build your look</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center grayscale opacity-50">
                            <Eye className="w-12 h-12 text-nimbus" />
                        </div>
                    )}

                    {/* Floating look items on the image */}
                    {currentLook.length > 0 && (
                        <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2">
                            {currentLook.map(g => (
                                <div key={g.category} className="flex-shrink-0 flex items-center gap-2 bg-white/90 backdrop-blur-md shadow-lg rounded-none px-3 py-2 border border-nimbus">
                                    {g.image_url && <img src={g.image_url} alt="" className="w-6 h-6 object-cover mix-blend-multiply border border-nimbus" />}
                                    <span className="text-[10px] text-foreground font-bold uppercase tracking-wider">{g.title}</span>
                                    <button onClick={() => removeFromLook(g.category)}>
                                        <X className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {rendering && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
                            <div className="w-3/4">
                                <StatusPill status="processing" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Tray */}
                <div className="border-t border-nimbus/50 bg-white z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    {/* Category Pills */}
                    <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-nimbus/30">
                        {CATEGORIES.map(cat => {
                            const hasItem = currentLook.some(g => g.category === cat.key)
                            return (
                                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all
                                        ${activeCategory === cat.key
                                            ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                            : hasItem
                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                : 'text-muted-foreground bg-white border-nimbus'
                                        }`}>
                                    <cat.icon className="w-3 h-3" /> {cat.label}
                                    {hasItem && <Check className="w-2.5 h-2.5" />}
                                </button>
                            )
                        })}
                    </div>

                    {/* Horizontal Item Scroll */}
                    <div className="flex gap-3 px-4 py-4 overflow-x-auto bg-paper/50 min-h-[140px]">
                        {categoryItems.length === 0 ? (
                            <div className="w-full text-center py-8 grayscale opacity-50">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">No items found</p>
                            </div>
                        ) : categoryItems.map(item => {
                            const selected = isInLook(item.id)
                            return (
                                <button key={item.id} onClick={() => selected ? removeFromLook(item.category) : addToLook(item)}
                                    className={`flex-shrink-0 w-24 relative bg-white border transition-all ${selected
                                        ? 'border-primary ring-1 ring-primary shadow-lg'
                                        : 'border-nimbus hover:border-primary/50'
                                        }`}>
                                    <div className="aspect-[3/4] relative overflow-hidden">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt="" className="w-full h-full object-cover mix-blend-multiply p-2" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-nimbus/10">
                                                <Shirt className="w-5 h-5 text-nimbus" />
                                            </div>
                                        )}
                                        {selected && (
                                            <div className="absolute top-1 right-1 w-5 h-5 bg-primary text-primary-foreground flex items-center justify-center shadow-md">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-2 border-t border-nimbus/30 bg-white">
                                        <p className="text-[9px] text-foreground font-bold truncate uppercase">{item.title}</p>
                                        <p className="text-[9px] text-muted-foreground font-serif mt-0.5">${item.price?.toFixed(2)}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Try Look CTA */}
                    <div className="p-4 bg-white border-t border-nimbus/50">
                        <Button
                            onClick={claidResult && !rendering ? handleGenerateVideo : handleTryLook}
                            disabled={!masterIdentityUrl || currentLook.length === 0 || rendering}
                            className={`w-full h-12 rounded-none font-bold text-xs uppercase tracking-[0.2em] shadow-xl ${!masterIdentityUrl || currentLook.length === 0 || rendering
                                    ? 'bg-nimbus/20 text-muted-foreground'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                }`}
                        >
                            {rendering ? (
                                " PROCESSING..."
                            ) : claidResult ? (
                                <><Video className="w-4 h-4 mr-2" /> GENERATE VIDEO</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-2" /> TRY THIS LOOK ({currentLook.length})</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
