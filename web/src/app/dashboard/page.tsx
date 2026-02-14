"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { type Preset } from "@/lib/presets"

interface Job {
    id: string
    created_at: string
    input_params: Record<string, unknown>
    status: 'pending' | 'processing' | 'completed' | 'failed'
    output_url: string | null
    model: string
    tier: string
    project_id: string
    error_message: string | null
    provider_metadata?: Record<string, unknown>
}

interface MediaItem {
    id: string
    job_id: string
    image_url: string
    person_image_url: string | null
    garment_image_url: string | null
    label: string
    created_at: string
}

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Upload, Loader2, Sparkles, Image as ImageIcon,
    FastForward, Library, ExternalLink, Camera,
    Video, User, Shirt, Check, Plus
} from "lucide-react"
import { PresetGrid } from "@/components/preset-grid"
import { getOrCreateDefaultProject } from "@/app/actions"
import Link from "next/link"

type Tab = 'try-on' | 'video'

export default function StudioPage() {
    const [activeTab, setActiveTab] = useState<Tab>('try-on')

    // Identity state
    const [masterIdentityUrl, setMasterIdentityUrl] = useState<string | null>(null)
    const [identityLoading, setIdentityLoading] = useState(true)

    // Try-On state
    const [garmentImageUrl, setGarmentImageUrl] = useState("")
    const [garmentPreview, setGarmentPreview] = useState<string | null>(null)
    const [tryOnLoading, setTryOnLoading] = useState(false)
    const [tryOnResult, setTryOnResult] = useState<string | null>(null)
    const [tryOnError, setTryOnError] = useState<string | null>(null)

    // Video state
    const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null)
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16')
    const [videoLoading, setVideoLoading] = useState(false)

    // Shared state
    const [jobs, setJobs] = useState<Job[]>([])
    const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
    const [projectId, setProjectId] = useState<string | null>(null)

    const garmentFileRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // Initialize + check for master identity
    useEffect(() => {
        getOrCreateDefaultProject().then(({ projectId: pid }) => {
            if (pid) setProjectId(pid)
        })
        // Check for a ready identity
        supabase.from('identities').select('master_identity_url').eq('status', 'ready').limit(1).single()
            .then(({ data }: { data: { master_identity_url?: string } | null }) => {
                if (data?.master_identity_url) setMasterIdentityUrl(data.master_identity_url)
                setIdentityLoading(false)
            }, () => setIdentityLoading(false))
    }, [])

    // Poll jobs + media library
    useEffect(() => {
        const fetchData = async () => {
            const { data: jobData } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(30)
            if (jobData) setJobs(jobData as Job[])

            const { data: mediaData } = await supabase.from('media_library').select('*').order('created_at', { ascending: false })
            if (mediaData) setMediaLibrary(mediaData as MediaItem[])
        }
        fetchData()
        const interval = setInterval(fetchData, 4000)
        return () => clearInterval(interval)
    }, [])

    // Check for completed try-on jobs and auto-save to media library
    useEffect(() => {
        const tryOnJobs = jobs.filter(j => j.tier === 'try_on' && j.status === 'completed' && j.output_url)
        for (const job of tryOnJobs) {
            const alreadySaved = mediaLibrary.some(m => m.job_id === job.id)
            if (!alreadySaved) {
                supabase.from('media_library').insert({
                    job_id: job.id,
                    image_url: job.output_url,
                    person_image_url: (job.input_params as Record<string, string>)?.person_image_url || null,
                    garment_image_url: (job.input_params as Record<string, string>)?.garment_image_url || null,
                    label: ''
                }).then(() => {
                    // Refresh media library
                    supabase.from('media_library').select('*').order('created_at', { ascending: false })
                        .then(({ data }) => { if (data) setMediaLibrary(data as MediaItem[]) })
                })
            }
        }
    }, [jobs])

    // File upload handler (garments only — person uses Master Identity)
    const uploadFile = async (file: File) => {
        // Show preview and set a temporary data URL immediately
        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            setGarmentPreview(dataUrl)
            setGarmentImageUrl(dataUrl) // Use data URL as fallback
        }
        reader.readAsDataURL(file)

        // Try uploading to Supabase storage — upgrade to public URL on success
        try {
            const fileName = `garments/${Date.now()}_${file.name}`
            const { error } = await supabase.storage.from('raw_assets').upload(fileName, file)
            if (!error) {
                const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
                setGarmentImageUrl(urlData.publicUrl)
            } else {
                console.warn('Storage upload failed, using data URL:', error.message)
            }
        } catch (err) {
            console.warn('Storage not available, using data URL fallback')
        }
    }

    // Try-On handler
    const handleTryOn = async () => {
        if (!masterIdentityUrl) {
            setTryOnError('No Master Identity found. Complete onboarding first.')
            return
        }
        if (!garmentImageUrl) {
            setTryOnError('Upload a garment image first.')
            return
        }
        setTryOnLoading(true)
        setTryOnResult(null)
        setTryOnError(null)
        try {
            const res = await fetch('/api/try-on', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ person_image_url: masterIdentityUrl, garment_image_url: garmentImageUrl })
            })
            const data = await res.json()

            if (!res.ok) {
                setTryOnError(data.error || `Server error (${res.status})`)
                setTryOnLoading(false)
                return
            }

            if (data.job?.id) {
                // Poll for result
                const pollInterval = setInterval(async () => {
                    const { data: job } = await supabase.from('jobs').select('*').eq('id', data.job.id).single()
                    if (job?.status === 'completed' && job.output_url) {
                        setTryOnResult(job.output_url)
                        setTryOnLoading(false)
                        clearInterval(pollInterval)
                    } else if (job?.status === 'failed') {
                        setTryOnError(job.error_message || 'Try-on failed. Please try again.')
                        setTryOnLoading(false)
                        clearInterval(pollInterval)
                    }
                }, 3000)
            } else {
                setTryOnError('No job created — unexpected response.')
                setTryOnLoading(false)
            }
        } catch (e) {
            console.error(e)
            setTryOnError('Network error — check your connection.')
            setTryOnLoading(false)
        }
    }

    // Video generation handler
    const handleGenerateVideo = async () => {
        if (!selectedMediaItem || !selectedPreset) return
        setVideoLoading(true)
        try {
            await fetch('/api/fashion-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    garment_image_url: selectedMediaItem.image_url,
                    preset_id: selectedPreset.id,
                    aspect_ratio: aspectRatio
                })
            })
        } catch (e) { console.error(e) }
        setTimeout(() => setVideoLoading(false), 2000)
    }

    const canTryOn = masterIdentityUrl && garmentImageUrl && !tryOnLoading
    const canGenerateVideo = selectedMediaItem && selectedPreset && !videoLoading
    const videoJobs = jobs.filter(j => j.tier !== 'try_on')

    // Render an upload drop zone inline
    const renderUploadZone = (
        type: 'person' | 'garment',
        preview: string | null,
        fileRef: React.RefObject<HTMLInputElement | null>,
        IconComp: typeof User,
        label: string,
        sublabel: string
    ) => (
        <div
            onClick={() => fileRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                ${preview ? 'border-zinc-700 bg-zinc-900/30' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-600 hover:bg-zinc-900/40'}`}
        >
            {preview ? (
                <div className="relative aspect-[3/4] max-h-[220px]">
                    <img src={preview} alt={label} className="w-full h-full object-contain p-3" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <Badge className="absolute bottom-2 left-2 bg-green-900/40 text-green-400 border-green-700/40 text-[9px]">
                        ✓ {label}
                    </Badge>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setGarmentPreview(null); setGarmentImageUrl('')
                        }}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white flex items-center justify-center text-[10px]"
                    >×</button>
                </div>
            ) : (
                <div className="py-10 flex flex-col items-center gap-2">
                    <div className="w-11 h-11 rounded-xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
                        <IconComp className="w-5 h-5 text-zinc-500" />
                    </div>
                    <p className="text-xs text-zinc-400 font-medium">{label}</p>
                    <p className="text-[10px] text-zinc-600">{sublabel}</p>
                </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
        </div>
    )

    return (
        <div className="h-screen bg-[#0a0a0a] text-zinc-400 flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <header className="h-14 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl flex items-center justify-between px-6 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="font-bold text-lg tracking-tighter text-white/90">
                            FASHION<span className="font-light text-zinc-600">STUDIO</span>
                        </h1>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex bg-zinc-900/60 rounded-lg p-0.5 border border-zinc-800 ml-4">
                        <button onClick={() => setActiveTab('try-on')}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === 'try-on'
                                ? 'bg-purple-900/40 text-purple-300 border border-purple-700/40'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}>
                            <Camera className="w-3.5 h-3.5" /> Try On
                        </button>
                        <button onClick={() => setActiveTab('video')}
                            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === 'video'
                                ? 'bg-pink-900/40 text-pink-300 border border-pink-700/40'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}>
                            <Video className="w-3.5 h-3.5" /> Create Video
                        </button>
                    </div>
                </div>

                <Link href="/dashboard/content"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all">
                    <Library className="w-3.5 h-3.5" /> Content Vault
                </Link>
                <Link href="/dashboard/outfit"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-900/10 transition-all">
                    <Sparkles className="w-3.5 h-3.5" /> Outfit Builder
                </Link>
            </header>

            <main className="flex-1 grid grid-cols-12 overflow-hidden">

                {/* ===== LEFT PANEL ===== */}
                <section className="col-span-7 flex flex-col border-r border-zinc-800/50 overflow-y-auto">
                    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-8">

                        {activeTab === 'try-on' ? (
                            /* ---- TRY ON TAB ---- */
                            <>
                                {/* Identity Banner */}
                                {!identityLoading && !masterIdentityUrl && (
                                    <div className="rounded-2xl border border-purple-800/40 bg-purple-900/10 p-5 flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-white">Set Up Your Identity First</p>
                                            <p className="text-xs text-zinc-500">We need a selfie to create your AI identity for virtual try-on.</p>
                                        </div>
                                        <Link href="/dashboard/onboard">
                                            <Button className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">
                                                <User className="w-3.5 h-3.5 mr-1.5" /> Set Up Identity
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {/* Step 1: Master Identity */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-purple-900/40 border border-purple-700/40 flex items-center justify-center text-[10px] font-black text-purple-400">1</div>
                                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Your Identity</Label>
                                    </div>
                                    {masterIdentityUrl ? (
                                        <div className="rounded-2xl border border-green-800/30 bg-zinc-900/30 overflow-hidden">
                                            <div className="relative aspect-[3/4] max-h-[220px]">
                                                <img src={masterIdentityUrl} alt="Master Identity" className="w-full h-full object-contain p-3" />
                                                <Badge className="absolute bottom-2 left-2 bg-green-900/40 text-green-400 border-green-700/40 text-[9px]">✓ Master Identity</Badge>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 py-10 text-center">
                                            <User className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                                            <p className="text-xs text-zinc-500">Complete identity setup to start trying on</p>
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Upload Clothing */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black transition-all
                                            ${masterIdentityUrl ? 'bg-purple-900/40 border-purple-700/40 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>2</div>
                                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Upload Clothing Item</Label>
                                    </div>
                                    {renderUploadZone('garment', garmentPreview, garmentFileRef, Shirt, 'Clothing Item', 'Flat-lay or product photo')}
                                </div>

                                {/* Try On Button */}
                                <div className="space-y-3">
                                    <Button
                                        onClick={handleTryOn}
                                        disabled={!canTryOn}
                                        className={`w-full h-14 text-sm font-bold tracking-wide transition-all rounded-xl ${canTryOn
                                            ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-purple-600 hover:from-purple-500 hover:via-violet-500 hover:to-purple-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)]'
                                            : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                            }`}
                                    >
                                        {tryOnLoading ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Try-On...</>
                                        ) : (
                                            <><Camera className="w-4 h-4 mr-2" /> Try On Clothing</>
                                        )}
                                    </Button>

                                    {tryOnError && (
                                        <div className="flex items-start gap-2 p-3 rounded-xl border border-red-800/40 bg-red-900/10">
                                            <span className="text-red-400 text-xs flex-shrink-0 mt-0.5">⚠</span>
                                            <p className="text-xs text-red-400">{tryOnError}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Try-On Result */}
                                {tryOnResult && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Check className="w-4 h-4 text-green-400" />
                                            <Label className="text-xs font-bold text-green-400 uppercase tracking-widest">Try-On Result</Label>
                                            <Badge className="bg-green-900/20 text-green-400 border-green-700/30 text-[9px]">Saved to Media Library</Badge>
                                        </div>
                                        <div className="rounded-2xl overflow-hidden border border-green-800/30 bg-zinc-900/30">
                                            <img src={tryOnResult} alt="Try-on result" className="w-full max-h-[400px] object-contain bg-zinc-950" />
                                        </div>
                                        <Button
                                            onClick={() => {
                                                setActiveTab('video')
                                                const item = mediaLibrary.find(m => m.image_url === tryOnResult)
                                                if (item) setSelectedMediaItem(item)
                                            }}
                                            className="w-full h-10 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-xl"
                                        >
                                            <Video className="w-3.5 h-3.5 mr-1.5" /> Use This for Video →
                                        </Button>
                                    </div>
                                )}

                                {/* Recent Try-On Results */}
                                {mediaLibrary.length > 0 && (
                                    <div className="space-y-3 pb-8">
                                        <Label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Your Media Library ({mediaLibrary.length})</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {mediaLibrary.slice(0, 6).map(item => (
                                                <div key={item.id} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/30 group cursor-pointer hover:border-zinc-600 transition-all"
                                                    onClick={() => { setActiveTab('video'); setSelectedMediaItem(item) }}>
                                                    <img src={item.image_url} alt="" className="aspect-[3/4] w-full object-cover" />
                                                    <div className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <p className="text-[9px] text-purple-400 font-bold text-center">Use for video →</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            /* ---- VIDEO TAB ---- */
                            <>
                                {/* Step 1: Pick from Media Library */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-pink-900/40 border border-pink-700/40 flex items-center justify-center text-[10px] font-black text-pink-400">1</div>
                                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select from Media Library</Label>
                                    </div>
                                    {mediaLibrary.length === 0 ? (
                                        <div className="rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/20 py-12 text-center">
                                            <ImageIcon className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                                            <p className="text-xs text-zinc-500">No images yet! Go to <button onClick={() => setActiveTab('try-on')} className="text-purple-400 hover:text-purple-300 font-bold">Try On</button> to create one.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {mediaLibrary.map(item => (
                                                <button key={item.id}
                                                    onClick={() => setSelectedMediaItem(item)}
                                                    className={`rounded-xl overflow-hidden border-2 transition-all ${selectedMediaItem?.id === item.id
                                                        ? 'border-pink-500 ring-2 ring-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)]'
                                                        : 'border-zinc-800 hover:border-zinc-600'
                                                        }`}
                                                >
                                                    <img src={item.image_url} alt="" className="aspect-[3/4] w-full object-cover" />
                                                </button>
                                            ))}
                                            <button onClick={() => setActiveTab('try-on')}
                                                className="rounded-xl border-2 border-dashed border-zinc-800 hover:border-zinc-600 aspect-[3/4] flex flex-col items-center justify-center gap-1 transition-all">
                                                <Plus className="w-5 h-5 text-zinc-600" />
                                                <span className="text-[9px] text-zinc-600 font-bold">New Try-On</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Select Preset */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black transition-all
                                            ${selectedMediaItem ? 'bg-pink-900/40 border-pink-700/40 text-pink-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>2</div>
                                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Choose Your Vibe</Label>
                                    </div>
                                    <PresetGrid selectedPresetId={selectedPreset?.id || null} onSelect={setSelectedPreset} />
                                </div>

                                {/* Step 3: Format & Generate */}
                                <div className="space-y-4 pb-12">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black transition-all
                                            ${selectedPreset ? 'bg-pink-900/40 border-pink-700/40 text-pink-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>3</div>
                                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Format & Generate</Label>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] uppercase font-bold text-zinc-600">Aspect Ratio</span>
                                        <div className="flex bg-zinc-900 rounded-lg p-0.5 gap-0.5 border border-zinc-800">
                                            {(['9:16', '16:9', '1:1'] as const).map(ratio => (
                                                <button key={ratio} onClick={() => setAspectRatio(ratio)}
                                                    className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${aspectRatio === ratio ? 'bg-pink-900/40 text-pink-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                                                        }`}>
                                                    {ratio === '9:16' ? '9:16 Reels' : ratio === '16:9' ? '16:9 Wide' : '1:1 Square'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <Button onClick={handleGenerateVideo} disabled={!canGenerateVideo}
                                        className={`w-full h-14 text-sm font-bold tracking-wide transition-all rounded-xl ${canGenerateVideo
                                            ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white shadow-[0_0_30px_rgba(236,72,153,0.3)]'
                                            : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                            }`}>
                                        {videoLoading ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Fashion Video...</>
                                        ) : (
                                            <><Sparkles className="w-4 h-4 mr-2" /> Generate Fashion Video</>
                                        )}
                                    </Button>

                                    {selectedPreset && (
                                        <p className="text-[10px] text-zinc-600 text-center">
                                            {selectedPreset.emoji} {selectedPreset.name} • Veo 3.1 Fast • 8s clip
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </section>

                {/* ===== RIGHT: Archive ===== */}
                <aside className="col-span-5 bg-zinc-900/20 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center">
                        <h2 className="text-zinc-100/90 font-bold tracking-tight text-sm uppercase flex items-center gap-2">
                            <span className={`w-1.5 h-4 rounded-sm ${activeTab === 'try-on' ? 'bg-purple-600' : 'bg-pink-600'}`} />
                            {activeTab === 'try-on' ? 'Try-On Results' : 'Video Generations'}
                        </h2>
                        <Link href="/dashboard/content"
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
                            View All <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 gap-4">
                            {activeTab === 'try-on' ? (
                                /* Try-on results */
                                mediaLibrary.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Camera className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                        <p className="text-xs text-zinc-600">Upload a selfie + clothing to see try-on results</p>
                                    </div>
                                ) : mediaLibrary.map(item => (
                                    <div key={item.id} className="group rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all">
                                        <div className="aspect-[3/4] max-h-[300px] bg-zinc-950 relative">
                                            <img src={item.image_url} alt="" className="w-full h-full object-contain" />
                                        </div>
                                        <div className="p-3 flex items-center justify-between">
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <Button variant="ghost" size="sm"
                                                onClick={() => { setActiveTab('video'); setSelectedMediaItem(item) }}
                                                className="h-6 text-[10px] text-pink-400 hover:text-pink-300 hover:bg-pink-900/20">
                                                <Video className="w-3 h-3 mr-1" /> Make Video
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                /* Video results */
                                videoJobs.length === 0 ? (
                                    <div className="text-center py-20">
                                        <Video className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                        <p className="text-xs text-zinc-600">Your generated videos will appear here</p>
                                    </div>
                                ) : videoJobs.map(job => (
                                    <div key={job.id} className="group rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all">
                                        <div className="aspect-video bg-zinc-950 relative">
                                            {job.output_url ? (
                                                <video src={job.output_url} controls className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="text-center space-y-2">
                                                        <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-pink-500 animate-spin mx-auto" />
                                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                                            {job.status === 'failed' ? 'Failed' : 'Generating...'}
                                                        </p>
                                                    </div>
                                                    {job.status !== 'failed' && <div className="absolute inset-0 bg-gradient-to-t from-pink-900/10 to-transparent animate-pulse" />}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className={`text-[10px] h-5 border-0 ${job.status === 'completed' ? 'bg-green-900/20 text-green-400' :
                                                    job.status === 'failed' ? 'bg-red-900/20 text-red-400' :
                                                        'bg-pink-900/20 text-pink-400'}`}>
                                                    {job.status}
                                                </Badge>
                                                <span className="text-[10px] text-zinc-600 font-mono">
                                                    {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {job.error_message && <p className="text-[10px] text-red-400 mt-1 line-clamp-1">{job.error_message}</p>}

                                            {job.status === 'completed' && job.output_url && job.model === 'veo-3.1-fast' && (
                                                <Button variant="ghost" size="sm"
                                                    className="w-full h-7 mt-2 text-[10px] text-pink-400 hover:text-pink-300 hover:bg-pink-900/20"
                                                    onClick={async () => {
                                                        const prompt = window.prompt("What happens next?")
                                                        if (!prompt) return
                                                        await fetch('/api/extend', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ job_id: job.id, prompt })
                                                        })
                                                    }}>
                                                    <FastForward className="w-3 h-3 mr-1" /> Extend +7s
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    )
}
