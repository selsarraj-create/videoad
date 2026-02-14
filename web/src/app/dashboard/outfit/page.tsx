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
        <div className="min-h-screen bg-[#050505] text-white font-sans">
            {/* Header */}
            <header className="h-14 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-bold text-lg tracking-tighter text-white/90">
                            FASHION<span className="font-light text-zinc-600">STUDIO</span>
                        </span>
                    </Link>
                    <div className="w-px h-5 bg-zinc-800" />
                    <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <h1 className="text-sm font-bold text-white/80 uppercase tracking-wider">Outfit Builder</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {totalCost > 0 && (
                        <Badge className="bg-green-900/30 text-green-400 border-green-700/30 text-xs">
                            Total: ${totalCost.toFixed(2)}
                        </Badge>
                    )}
                    <Link href="/dashboard/content">
                        <Button variant="outline" size="sm" className="text-xs text-zinc-400 border-zinc-800">
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
                <div className="col-span-4 border-r border-zinc-800/50 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 space-y-3">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Affiliate Library</h2>
                        <div className="flex gap-1">
                            {CATEGORIES.map(cat => (
                                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                        ${activeCategory === cat.key
                                            ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                                        }`}>
                                    <cat.icon className="w-3 h-3" /> {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {categoryItems.length === 0 ? (
                            <div className="text-center py-16">
                                <ShoppingBag className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                <p className="text-xs text-zinc-600">No {activeCategory} in library yet</p>
                                <p className="text-[10px] text-zinc-700 mt-1">Add items via the affiliate_items table</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                {categoryItems.map(item => {
                                    const selected = isInLook(item.id)
                                    return (
                                        <button key={item.id} onClick={() => selected ? removeFromLook(item.category) : addToLook(item)}
                                            className={`group rounded-xl border overflow-hidden text-left transition-all ${selected
                                                ? 'border-purple-600/60 bg-purple-900/15 ring-1 ring-purple-600/30'
                                                : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
                                                }`}>
                                            <div className="aspect-square bg-zinc-950 relative">
                                                {item.image_url ? (
                                                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Shirt className="w-8 h-8 text-zinc-800" />
                                                    </div>
                                                )}
                                                {selected && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-white" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-2.5">
                                                <p className="text-[11px] text-zinc-300 font-medium truncate">{item.title}</p>
                                                <p className="text-[10px] text-purple-400 font-bold mt-0.5">${item.price?.toFixed(2)}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* CENTER PANE: Canvas */}
                <div className="col-span-4 flex flex-col border-r border-zinc-800/50 overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
                        <Input
                            value={lookName}
                            onChange={(e) => setLookName(e.target.value)}
                            className="h-8 w-48 text-xs bg-transparent border-none text-white font-bold focus:ring-0 px-0"
                            placeholder="Name your look..."
                        />
                        <Badge className="bg-zinc-900 text-zinc-500 border-zinc-800 text-[9px]">
                            {currentLook.length} item{currentLook.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
                        {/* Identity + Result Preview */}
                        <div className="relative w-full max-w-[320px]">
                            {claidResult ? (
                                <div className="rounded-2xl overflow-hidden border-2 border-purple-700/40 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                                    <img src={claidResult} alt="Outfit Result" className="w-full object-contain" />
                                    <div className="absolute bottom-3 left-3">
                                        <Badge className="bg-green-900/60 text-green-400 border-green-700/40 text-[9px] backdrop-blur">
                                            ✓ Outfit Ready
                                        </Badge>
                                    </div>
                                </div>
                            ) : masterIdentityUrl ? (
                                <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
                                    <img src={masterIdentityUrl} alt="Identity" className="w-full object-contain opacity-60" />
                                    {currentLook.length > 0 && !rendering && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                                            <div className="text-center">
                                                <Layers className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                                                <p className="text-xs text-zinc-300 font-bold">{currentLook.length} garment{currentLook.length > 1 ? 's' : ''} selected</p>
                                                <p className="text-[10px] text-zinc-500">Hit &quot;Try This Look&quot; to render</p>
                                            </div>
                                        </div>
                                    )}
                                    {rendering && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl">
                                            <div className="text-center">
                                                <Loader2 className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-spin" />
                                                <p className="text-xs text-zinc-300 font-bold">Rendering outfit...</p>
                                                <p className="text-[10px] text-zinc-500">Claid is draping {currentLook.length} garment{currentLook.length > 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 py-20 text-center">
                                    <Eye className="w-10 h-10 text-zinc-800 mx-auto mb-3" />
                                    <p className="text-xs text-zinc-600">No identity set up yet</p>
                                </div>
                            )}
                        </div>

                        {/* Current Look Items */}
                        {currentLook.length > 0 && (
                            <div className="mt-6 w-full max-w-[320px] space-y-2">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Current Look</p>
                                {currentLook.map(g => (
                                    <div key={g.category} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/40 border border-zinc-800/50">
                                        {g.image_url && (
                                            <img src={g.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-zinc-300 truncate">{g.title}</p>
                                            <p className="text-[9px] text-purple-400 font-bold">${g.price?.toFixed(2)}</p>
                                        </div>
                                        <button onClick={() => removeFromLook(g.category)}
                                            className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-500 hover:text-red-400 flex items-center justify-center text-[10px]">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                                    <span className="text-[10px] text-zinc-500">Total</span>
                                    <span className="text-sm font-bold text-white">${totalCost.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Try This Look Button */}
                    <div className="p-4 border-t border-zinc-800/50">
                        <Button
                            onClick={handleTryLook}
                            disabled={!masterIdentityUrl || currentLook.length === 0 || rendering}
                            className={`w-full h-12 font-bold text-sm transition-all rounded-xl ${masterIdentityUrl && currentLook.length > 0 && !rendering
                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)]'
                                : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                }`}
                        >
                            {rendering ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rendering...</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-2" /> Try This Look</>
                            )}
                        </Button>
                    </div>
                </div>

                {/* RIGHT PANE: Presets & Render Queue */}
                <div className="col-span-4 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Style Presets & Render</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {claidResult ? (
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Choose Video Style</p>
                                    <PresetGrid
                                        onSelect={setSelectedPreset}
                                        selectedPresetId={selectedPreset?.id || null}
                                    />
                                </div>
                                <Button
                                    onClick={handleGenerateVideo}
                                    disabled={!selectedPreset}
                                    className={`w-full h-12 font-bold text-sm transition-all rounded-xl ${selectedPreset
                                        ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white'
                                        : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                        }`}
                                >
                                    <Video className="w-4 h-4 mr-2" /> Generate Video
                                </Button>
                            </div>
                        ) : (
                            <div className="text-center py-20">
                                <Video className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                <p className="text-xs text-zinc-600">Try a look first to unlock video presets</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ===================== MOBILE: THUMB-FIRST TRAY ===================== */}
            <div className="md:hidden flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
                {/* Identity Preview */}
                <div className="flex-1 relative overflow-hidden bg-zinc-950">
                    {claidResult ? (
                        <img src={claidResult} alt="Outfit" className="w-full h-full object-contain" />
                    ) : masterIdentityUrl ? (
                        <img src={masterIdentityUrl} alt="Identity" className="w-full h-full object-contain opacity-50" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <Eye className="w-12 h-12 text-zinc-800" />
                        </div>
                    )}

                    {/* Floating look items on the image */}
                    {currentLook.length > 0 && (
                        <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                            {currentLook.map(g => (
                                <div key={g.category} className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1.5 border border-zinc-700/50">
                                    {g.image_url && <img src={g.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />}
                                    <span className="text-[9px] text-zinc-300 font-medium">{g.title}</span>
                                    <button onClick={() => removeFromLook(g.category)}>
                                        <X className="w-3 h-3 text-zinc-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {rendering && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="text-center">
                                <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-2" />
                                <p className="text-xs text-white font-bold">Rendering outfit...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Tray */}
                <div className="border-t border-zinc-800 bg-[#0a0a0a]">
                    {/* Category Pills */}
                    <div className="flex gap-1 px-4 py-2 overflow-x-auto">
                        {CATEGORIES.map(cat => {
                            const hasItem = currentLook.some(g => g.category === cat.key)
                            return (
                                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all
                                        ${activeCategory === cat.key
                                            ? 'bg-purple-900/50 text-purple-300 border border-purple-700/40'
                                            : hasItem
                                                ? 'bg-green-900/20 text-green-400 border border-green-800/30'
                                                : 'text-zinc-500 bg-zinc-900/50 border border-zinc-800'
                                        }`}>
                                    <cat.icon className="w-3 h-3" /> {cat.label}
                                    {hasItem && <Check className="w-2.5 h-2.5" />}
                                </button>
                            )
                        })}
                    </div>

                    {/* Horizontal Item Scroll */}
                    <div className="flex gap-3 px-4 py-3 overflow-x-auto pb-4">
                        {categoryItems.length === 0 ? (
                            <div className="w-full text-center py-4">
                                <p className="text-[10px] text-zinc-600">No items in this category</p>
                            </div>
                        ) : categoryItems.map(item => {
                            const selected = isInLook(item.id)
                            return (
                                <button key={item.id} onClick={() => selected ? removeFromLook(item.category) : addToLook(item)}
                                    className={`flex-shrink-0 w-20 rounded-xl border overflow-hidden transition-all ${selected
                                        ? 'border-purple-600 ring-1 ring-purple-600/30'
                                        : 'border-zinc-800'
                                        }`}>
                                    <div className="aspect-square bg-zinc-950 relative">
                                        {item.image_url ? (
                                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Shirt className="w-5 h-5 text-zinc-700" />
                                            </div>
                                        )}
                                        {selected && (
                                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center">
                                                <Check className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-1.5">
                                        <p className="text-[9px] text-zinc-400 truncate">{item.title}</p>
                                        <p className="text-[9px] text-purple-400 font-bold">${item.price?.toFixed(2)}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Try Look CTA */}
                    <div className="px-4 pb-4">
                        <Button
                            onClick={claidResult && !rendering ? handleGenerateVideo : handleTryLook}
                            disabled={!masterIdentityUrl || currentLook.length === 0 || rendering}
                            className="w-full h-11 rounded-full font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                        >
                            {rendering ? (
                                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Rendering...</>
                            ) : claidResult ? (
                                <><Video className="w-4 h-4 mr-1.5" /> Generate Video</>
                            ) : (
                                <><Sparkles className="w-4 h-4 mr-1.5" /> Try This Look ({currentLook.length})</>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
