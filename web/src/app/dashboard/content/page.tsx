"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Library, Search, Link2, ExternalLink, Shirt,
    Copy, Check, Trash2, ArrowLeft, Layers,
    DollarSign, ShoppingBag, Package, Sparkles
} from "lucide-react"
import Link from "next/link"

interface ContentItem {
    id: string
    created_at: string
    output_url: string | null
    status: string
    model: string
    input_params: { preset_id?: string; pipeline?: string; prompt?: string }
    provider_metadata?: { preset_id?: string; on_model_image_url?: string; aspect_ratio?: string }
}

interface ContentLink {
    id: string
    job_id: string
    affiliate_url: string | null
    title: string | null
    look_id: string | null
    outfit_cost: number | null
    created_at: string
}

interface LookData {
    id: string
    garments: Array<{
        item_id: string
        category: string
        image_url: string
        title: string
        price: number
        affiliate_url: string
    }>
    name: string
    claid_result_url: string | null
}

const CATEGORY_ICONS: Record<string, typeof Shirt> = {
    tops: Shirt,
    bottoms: Package,
    shoes: ShoppingBag,
    accessories: Sparkles,
}

export default function ContentVaultPage() {
    const [videos, setVideos] = useState<ContentItem[]>([])
    const [links, setLinks] = useState<ContentLink[]>([])
    const [looks, setLooks] = useState<LookData[]>([])
    const [search, setSearch] = useState("")
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
    const [affiliateUrl, setAffiliateUrl] = useState("")
    const [linkTitle, setLinkTitle] = useState("")
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [expandedLook, setExpandedLook] = useState<string | null>(null)

    const supabase = createClient()

    useEffect(() => {
        const fetchData = async () => {
            const { data: jobData } = await supabase
                .from('jobs')
                .select('*')
                .eq('status', 'completed')
                .not('output_url', 'is', null)
                .order('created_at', { ascending: false })

            if (jobData) setVideos(jobData as ContentItem[])

            const { data: linkData } = await supabase
                .from('content_links')
                .select('*')
                .order('created_at', { ascending: false })

            if (linkData) setLinks(linkData as ContentLink[])

            const { data: lookData } = await supabase
                .from('current_looks')
                .select('*')
                .eq('status', 'ready')
                .order('created_at', { ascending: false })

            if (lookData) setLooks(lookData as LookData[])
        }
        fetchData()
    }, [])

    const getLink = (jobId: string) => links.find(l => l.job_id === jobId)
    const getLook = (lookId: string | null) => lookId ? looks.find(l => l.id === lookId) : null

    const saveLink = async (jobId: string) => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const existing = getLink(jobId)
        if (existing) {
            await supabase
                .from('content_links')
                .update({ affiliate_url: affiliateUrl, title: linkTitle })
                .eq('id', existing.id)
        } else {
            const { data } = await supabase
                .from('content_links')
                .insert({
                    job_id: jobId,
                    user_id: user.id,
                    affiliate_url: affiliateUrl,
                    title: linkTitle
                })
                .select()
                .single()
            if (data) setLinks([...links, data as ContentLink])
        }

        setEditingLinkId(null)
        setAffiliateUrl("")
        setLinkTitle("")

        const { data: linkData } = await supabase.from('content_links').select('*').order('created_at', { ascending: false })
        if (linkData) setLinks(linkData as ContentLink[])
    }

    const removeLink = async (linkId: string) => {
        await supabase.from('content_links').delete().eq('id', linkId)
        setLinks(links.filter(l => l.id !== linkId))
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const filteredVideos = videos.filter(v => {
        if (!search) return true
        const presetId = v.provider_metadata?.preset_id || v.input_params?.preset_id || ''
        const link = getLink(v.id)
        return presetId.includes(search.toLowerCase()) ||
            (link?.title || '').toLowerCase().includes(search.toLowerCase())
    })

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-400 font-sans">
            {/* Header */}
            <header className="h-14 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-xs font-medium">Studio</span>
                    </Link>
                    <div className="w-px h-5 bg-zinc-800" />
                    <div className="flex items-center gap-2">
                        <Library className="w-4 h-4 text-purple-400" />
                        <h1 className="font-bold text-sm text-white/90 uppercase tracking-wider">Content Vault</h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            placeholder="Search by preset or title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 w-60 text-xs bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-600"
                        />
                    </div>
                    <Link href="/dashboard/outfit">
                        <Button variant="outline" size="sm" className="text-xs text-purple-400 border-purple-800/40 hover:bg-purple-900/20">
                            <Layers className="w-3 h-3 mr-1" /> Outfit Builder
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Content Grid */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-xs text-zinc-600">
                        {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''} in your vault
                    </p>
                </div>

                {filteredVideos.length === 0 ? (
                    <div className="text-center py-32">
                        <Library className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
                        <h3 className="text-sm text-zinc-500 font-medium">No videos yet</h3>
                        <p className="text-xs text-zinc-600 mt-1">Generate your first fashion video to get started</p>
                        <Link href="/dashboard">
                            <Button className="mt-4 bg-purple-600 hover:bg-purple-500 text-white text-xs">
                                Create Video
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {filteredVideos.map((video) => {
                            const link = getLink(video.id)
                            const look = getLook(link?.look_id || null)
                            const presetName = (video.provider_metadata?.preset_id || video.input_params?.preset_id || 'custom').replace(/-/g, ' ')
                            const outfitCost = look?.garments?.reduce((sum, g) => sum + (g.price || 0), 0) || link?.outfit_cost || 0

                            return (
                                <div key={video.id} className="group rounded-2xl overflow-hidden bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-all">
                                    <div className="flex flex-col sm:flex-row">
                                        {/* Video Preview */}
                                        <div className="sm:w-[280px] flex-shrink-0">
                                            <div className="aspect-video sm:aspect-[3/4] bg-zinc-950 relative">
                                                {video.output_url ? (
                                                    <video
                                                        src={video.output_url}
                                                        className="w-full h-full object-cover"
                                                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                                                        onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0 }}
                                                        muted loop
                                                    />
                                                ) : null}
                                                <div className="absolute top-2 left-2 flex gap-1">
                                                    <Badge className="bg-black/60 backdrop-blur-sm text-zinc-300 border-0 text-[9px] capitalize">
                                                        {presetName}
                                                    </Badge>
                                                </div>
                                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => video.output_url && copyToClipboard(video.output_url, video.id)}
                                                        className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur text-white/80 hover:text-white flex items-center justify-center"
                                                    >
                                                        {copiedId === video.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Panel */}
                                        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                            <div className="space-y-3">
                                                {/* Title + Date */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-sm font-bold text-white/90 truncate">
                                                        {link?.title || look?.name || `Fashion Video`}
                                                    </h3>
                                                    <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">
                                                        {new Date(video.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>

                                                {/* Outfit Breakdown */}
                                                {look && look.garments && look.garments.length > 0 && (
                                                    <div className="space-y-2">
                                                        <button
                                                            onClick={() => setExpandedLook(expandedLook === video.id ? null : video.id)}
                                                            className="flex items-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 transition"
                                                        >
                                                            <Layers className="w-3 h-3" />
                                                            {look.garments.length} item{look.garments.length > 1 ? 's' : ''} in outfit
                                                            <span className="text-purple-400 font-bold">${outfitCost.toFixed(2)}</span>
                                                        </button>

                                                        {expandedLook === video.id && (
                                                            <div className="space-y-1.5 pl-1">
                                                                {look.garments.map((g, i) => {
                                                                    const Icon = CATEGORY_ICONS[g.category] || Shirt
                                                                    return (
                                                                        <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                                                                            {g.image_url ? (
                                                                                <img src={g.image_url} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                                                            ) : (
                                                                                <div className="w-7 h-7 rounded bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                                                                    <Icon className="w-3.5 h-3.5 text-zinc-600" />
                                                                                </div>
                                                                            )}
                                                                            <div className="flex-1 min-w-0">
                                                                                <p className="text-[10px] text-zinc-300 truncate">{g.title}</p>
                                                                                <p className="text-[9px] text-purple-400 font-bold">${g.price?.toFixed(2)}</p>
                                                                            </div>
                                                                            {g.affiliate_url && (
                                                                                <button
                                                                                    onClick={() => copyToClipboard(g.affiliate_url, `${video.id}-${i}`)}
                                                                                    className="p-1 text-zinc-600 hover:text-purple-400"
                                                                                    title="Copy affiliate link"
                                                                                >
                                                                                    {copiedId === `${video.id}-${i}` ? (
                                                                                        <Check className="w-3 h-3 text-green-400" />
                                                                                    ) : (
                                                                                        <Link2 className="w-3 h-3" />
                                                                                    )}
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Outfit Cost Banner */}
                                                {outfitCost > 0 && (
                                                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-950/20 border border-green-800/20">
                                                        <DollarSign className="w-4 h-4 text-green-400" />
                                                        <div>
                                                            <p className="text-[10px] text-green-400 font-bold">Total Outfit Cost</p>
                                                            <p className="text-sm text-white font-bold">${outfitCost.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Affiliate Link Section */}
                                            <div className="mt-3">
                                                {editingLinkId === video.id ? (
                                                    <div className="space-y-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                                        <Input
                                                            placeholder="Video title..."
                                                            value={linkTitle}
                                                            onChange={(e) => setLinkTitle(e.target.value)}
                                                            className="h-7 text-[11px] bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                                        />
                                                        <Input
                                                            placeholder="https://affiliate-link.com/..."
                                                            value={affiliateUrl}
                                                            onChange={(e) => setAffiliateUrl(e.target.value)}
                                                            className="h-7 text-[11px] bg-zinc-800/50 border-zinc-700 text-zinc-200"
                                                        />
                                                        <div className="flex gap-1.5">
                                                            <Button size="sm" onClick={() => saveLink(video.id)}
                                                                className="h-7 px-3 text-[10px] bg-purple-600 hover:bg-purple-500 text-white flex-1">
                                                                Save
                                                            </Button>
                                                            <Button size="sm" variant="ghost"
                                                                onClick={() => { setEditingLinkId(null); setAffiliateUrl(''); setLinkTitle('') }}
                                                                className="h-7 px-3 text-[10px] text-zinc-500">
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : link ? (
                                                    <div className="flex items-center justify-between p-2 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <Link2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                                            <a href={link.affiliate_url || '#'} target="_blank" rel="noopener noreferrer"
                                                                className="text-[9px] text-purple-400 hover:text-purple-300 truncate">
                                                                {link.affiliate_url || 'No URL set'}
                                                            </a>
                                                        </div>
                                                        <div className="flex gap-1 flex-shrink-0">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingLinkId(video.id)
                                                                    setAffiliateUrl(link.affiliate_url || '')
                                                                    setLinkTitle(link.title || '')
                                                                }}
                                                                className="text-zinc-600 hover:text-zinc-400 p-1">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                            <button onClick={() => removeLink(link.id)}
                                                                className="text-zinc-600 hover:text-red-400 p-1">
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost" size="sm"
                                                        onClick={() => setEditingLinkId(video.id)}
                                                        className="w-full h-8 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-900/10 border border-dashed border-zinc-800 hover:border-purple-800/50"
                                                    >
                                                        <Link2 className="w-3 h-3 mr-1" /> Add Affiliate Link
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
