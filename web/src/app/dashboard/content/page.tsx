"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Library, Search, Link2, ExternalLink,
    Copy, Check, Trash2, ArrowLeft, Play
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
    created_at: string
}

export default function ContentLibraryPage() {
    const [videos, setVideos] = useState<ContentItem[]>([])
    const [links, setLinks] = useState<ContentLink[]>([])
    const [search, setSearch] = useState("")
    const [editingLinkId, setEditingLinkId] = useState<string | null>(null)
    const [affiliateUrl, setAffiliateUrl] = useState("")
    const [linkTitle, setLinkTitle] = useState("")
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const supabase = createClient()

    // Fetch completed videos
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
        }
        fetchData()
    }, [])

    const getLink = (jobId: string) => links.find(l => l.job_id === jobId)

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

        // Refresh links
        const { data: linkData } = await supabase.from('content_links').select('*').order('created_at', { ascending: false })
        if (linkData) setLinks(linkData as ContentLink[])
    }

    const removeLink = async (linkId: string) => {
        await supabase.from('content_links').delete().eq('id', linkId)
        setLinks(links.filter(l => l.id !== linkId))
    }

    const copyVideoUrl = (url: string, id: string) => {
        navigator.clipboard.writeText(url)
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
        <div className="min-h-screen bg-[#0a0a0a] text-zinc-400 font-sans">
            {/* Header */}
            <header className="h-14 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-xs font-medium">Back to Create</span>
                    </Link>
                    <div className="w-px h-5 bg-zinc-800" />
                    <div className="flex items-center gap-2">
                        <Library className="w-4 h-4 text-purple-400" />
                        <h1 className="font-bold text-sm text-white/90 uppercase tracking-wider">Content Library</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            placeholder="Search by preset or title..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 w-60 text-xs bg-zinc-900/50 border-zinc-800 text-zinc-300 placeholder:text-zinc-600"
                        />
                    </div>
                </div>
            </header>

            {/* Content Grid */}
            <div className="max-w-7xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-xs text-zinc-600">
                        {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''} in your library
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredVideos.map((video) => {
                            const link = getLink(video.id)
                            const presetName = (video.provider_metadata?.preset_id || video.input_params?.preset_id || 'custom').replace(/-/g, ' ')

                            return (
                                <div key={video.id} className="group rounded-2xl overflow-hidden bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 transition-all">
                                    {/* Video Preview */}
                                    <div className="aspect-video bg-zinc-950 relative">
                                        {video.output_url ? (
                                            <video
                                                src={video.output_url}
                                                className="w-full h-full object-cover"
                                                onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                                                onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0 }}
                                                muted
                                                loop
                                            />
                                        ) : null}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <button
                                                onClick={() => video.output_url && copyVideoUrl(video.output_url, video.id)}
                                                className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur text-white/80 hover:text-white flex items-center justify-center"
                                                title="Copy video URL"
                                            >
                                                {copiedId === video.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info + Link */}
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-purple-900/20 text-purple-400 border-0 text-[9px] capitalize">
                                                    {presetName}
                                                </Badge>
                                                {video.provider_metadata?.aspect_ratio && (
                                                    <span className="text-[9px] text-zinc-600 font-mono">{video.provider_metadata.aspect_ratio}</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                {new Date(video.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>

                                        {/* Affiliate Link Section */}
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
                                                    <Button
                                                        size="sm"
                                                        onClick={() => saveLink(video.id)}
                                                        className="h-7 px-3 text-[10px] bg-purple-600 hover:bg-purple-500 text-white flex-1"
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => { setEditingLinkId(null); setAffiliateUrl(''); setLinkTitle('') }}
                                                        className="h-7 px-3 text-[10px] text-zinc-500"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : link ? (
                                            <div className="flex items-center justify-between p-2 bg-zinc-900/30 rounded-lg border border-zinc-800/50">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Link2 className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                                    <div className="min-w-0">
                                                        {link.title && <p className="text-[10px] text-zinc-300 font-medium truncate">{link.title}</p>}
                                                        <a href={link.affiliate_url || '#'} target="_blank" rel="noopener noreferrer"
                                                            className="text-[9px] text-purple-400 hover:text-purple-300 truncate block"
                                                        >
                                                            {link.affiliate_url || 'No URL set'}
                                                        </a>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            setEditingLinkId(video.id)
                                                            setAffiliateUrl(link.affiliate_url || '')
                                                            setLinkTitle(link.title || '')
                                                        }}
                                                        className="text-zinc-600 hover:text-zinc-400 p-1"
                                                    >
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeLink(link.id)}
                                                        className="text-zinc-600 hover:text-red-400 p-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setEditingLinkId(video.id)}
                                                className="w-full h-8 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-900/10 border border-dashed border-zinc-800 hover:border-purple-800/50"
                                            >
                                                <Link2 className="w-3 h-3 mr-1" /> Add Affiliate Link
                                            </Button>
                                        )}
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
