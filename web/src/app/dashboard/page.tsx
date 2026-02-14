"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { type Preset } from "@/lib/presets"

interface Job {
    id: string;
    created_at: string;
    input_params: { prompt?: string; garment_image_url?: string; preset_id?: string; pipeline?: string; original_job_id?: string };
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output_url: string | null;
    model: string;
    tier: string;
    project_id: string;
    error_message: string | null;
    provider_metadata?: { task_id?: string; aspect_ratio?: string; preset_id?: string; on_model_image_url?: string };
}

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Upload, Loader2, Sparkles, Image as ImageIcon,
    FastForward, Library, ExternalLink
} from "lucide-react"
import { PresetGrid } from "@/components/preset-grid"
import { getOrCreateDefaultProject } from "@/app/actions"
import Link from "next/link"

export default function StudioPage() {
    // State
    const [garmentImageUrl, setGarmentImageUrl] = useState("")
    const [garmentPreview, setGarmentPreview] = useState<string | null>(null)
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16')
    const [loading, setLoading] = useState(false)
    const [jobs, setJobs] = useState<Job[]>([])
    const [projectId, setProjectId] = useState<string | null>(null)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    // Initialize
    useEffect(() => {
        getOrCreateDefaultProject().then(({ projectId: pid }) => {
            if (pid) setProjectId(pid)
        })
    }, [])

    // Poll jobs
    useEffect(() => {
        const fetchJobs = async () => {
            const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(20)
            if (data) setJobs(data as Job[])
        }
        fetchJobs()
        const interval = setInterval(fetchJobs, 5000)
        return () => clearInterval(interval)
    }, [])

    // Handle file upload
    const handleFileUpload = async (file: File) => {
        // Show preview immediately
        const reader = new FileReader()
        reader.onload = (e) => setGarmentPreview(e.target?.result as string)
        reader.readAsDataURL(file)

        // Upload to Supabase storage
        const fileName = `garments/${Date.now()}_${file.name}`
        const { data, error } = await supabase.storage.from('raw_assets').upload(fileName, file)
        if (error) {
            console.error('Upload failed:', error)
            return
        }
        const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
        setGarmentImageUrl(urlData.publicUrl)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file?.type.startsWith('image/')) handleFileUpload(file)
    }

    const handleGenerate = async () => {
        if (!garmentImageUrl || !selectedPreset) return
        setLoading(true)
        try {
            await fetch('/api/fashion-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    garment_image_url: garmentImageUrl,
                    preset_id: selectedPreset.id,
                    aspect_ratio: aspectRatio
                })
            })
        } catch (e) { console.error(e) }
        setTimeout(() => setLoading(false), 2000)
    }

    const canGenerate = garmentImageUrl && selectedPreset && !loading

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
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/content"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all"
                    >
                        <Library className="w-3.5 h-3.5" /> Content Library
                    </Link>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut()
                            window.location.href = "/"
                        }}
                        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </header>

            {/* Two-Column Layout */}
            <main className="flex-1 grid grid-cols-12 overflow-hidden">

                {/* LEFT: Create Panel */}
                <section className="col-span-7 flex flex-col border-r border-zinc-800/50 overflow-y-auto">
                    <div className="flex-1 p-8 max-w-2xl mx-auto w-full space-y-8">

                        {/* Step 1: Upload */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-purple-900/40 border border-purple-700/40 flex items-center justify-center text-[10px] font-black text-purple-400">1</div>
                                <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Upload Garment</Label>
                            </div>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
                                    ${dragOver
                                        ? 'border-purple-500 bg-purple-900/10'
                                        : garmentPreview
                                            ? 'border-zinc-700 bg-zinc-900/30'
                                            : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-600 hover:bg-zinc-900/40'
                                    }`}
                            >
                                {garmentPreview ? (
                                    <div className="relative aspect-[3/4] max-h-[300px]">
                                        <img src={garmentPreview} alt="Garment" className="w-full h-full object-contain p-4" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                                            <Badge className="bg-green-900/40 text-green-400 border-green-700/40 text-[9px]">
                                                ✓ Uploaded
                                            </Badge>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setGarmentPreview(null); setGarmentImageUrl('') }}
                                            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-zinc-800/80 text-zinc-400 hover:text-white flex items-center justify-center text-xs"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <div className="py-16 flex flex-col items-center gap-3">
                                        <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
                                            <Upload className="w-6 h-6 text-zinc-500" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm text-zinc-400 font-medium">Drop a flat-lay or mannequin photo</p>
                                            <p className="text-xs text-zinc-600 mt-1">JPG, PNG up to 10MB</p>
                                        </div>
                                    </div>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileUpload(file)
                                    }}
                                />
                            </div>
                        </div>

                        {/* Step 2: Select Preset */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black transition-all
                                    ${garmentImageUrl ? 'bg-purple-900/40 border-purple-700/40 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>2</div>
                                <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Choose Your Vibe</Label>
                            </div>
                            <PresetGrid
                                selectedPresetId={selectedPreset?.id || null}
                                onSelect={setSelectedPreset}
                            />
                        </div>

                        {/* Step 3: Options + Generate */}
                        <div className="space-y-4 pb-12">
                            <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-black transition-all
                                    ${selectedPreset ? 'bg-purple-900/40 border-purple-700/40 text-purple-400' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>3</div>
                                <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Format & Generate</Label>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-[10px] uppercase font-bold text-zinc-600">Aspect Ratio</span>
                                <div className="flex bg-zinc-900 rounded-lg p-0.5 gap-0.5 border border-zinc-800">
                                    {(['9:16', '16:9', '1:1'] as const).map((ratio) => (
                                        <button
                                            key={ratio}
                                            onClick={() => setAspectRatio(ratio)}
                                            className={`text-[10px] font-bold px-3 py-1.5 rounded-md transition-all ${aspectRatio === ratio
                                                ? 'bg-purple-900/40 text-purple-400 shadow-sm'
                                                : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            {ratio === '9:16' ? '9:16 Reels' : ratio === '16:9' ? '16:9 Wide' : '1:1 Square'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={handleGenerate}
                                disabled={!canGenerate}
                                className={`w-full h-14 text-sm font-bold tracking-wide transition-all rounded-xl ${canGenerate
                                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-500 hover:via-pink-500 hover:to-purple-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_40px_rgba(168,85,247,0.5)]'
                                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                    }`}
                            >
                                {loading ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Your Fashion Video...</>
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
                    </div>
                </section>

                {/* RIGHT: Archive */}
                <aside className="col-span-5 bg-zinc-900/20 flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-zinc-800/50 flex justify-between items-center">
                        <h2 className="text-zinc-100/90 font-bold tracking-tight text-sm uppercase flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-purple-600 rounded-sm" /> Recent Generations
                        </h2>
                        <Link href="/dashboard/content"
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1"
                        >
                            View Library <ExternalLink className="w-3 h-3" />
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 gap-4">
                            {jobs.length === 0 && (
                                <div className="text-center py-20">
                                    <ImageIcon className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                    <p className="text-xs text-zinc-600">Your generated videos will appear here</p>
                                </div>
                            )}
                            {jobs.map((job) => (
                                <div key={job.id} className="group relative rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all">
                                    <div className="aspect-video bg-zinc-950 relative">
                                        {job.output_url ? (
                                            <video src={job.output_url} controls className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="text-center space-y-2">
                                                    <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-purple-500 animate-spin mx-auto" />
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                                                        {job.status === 'failed' ? 'Failed' : job.provider_metadata?.on_model_image_url ? 'Generating Video...' : 'Processing Image...'}
                                                    </p>
                                                </div>
                                                {job.status !== 'failed' && <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 to-transparent animate-pulse" />}
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`text-[10px] h-5 border-0 ${job.status === 'completed' ? 'bg-green-900/20 text-green-400' : job.status === 'failed' ? 'bg-red-900/20 text-red-400' : 'bg-purple-900/20 text-purple-400'}`}>
                                                    {job.status}
                                                </Badge>
                                                {job.provider_metadata?.preset_id && (
                                                    <span className="text-[10px] text-zinc-600 font-medium">
                                                        {job.provider_metadata.preset_id.replace(/-/g, ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        {job.error_message && <p className="text-[10px] text-red-400 mt-1 line-clamp-1">{job.error_message}</p>}

                                        {/* Extend Button */}
                                        {job.status === 'completed' && job.output_url && job.model === 'veo-3.1-fast' && (
                                            <div className="mt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full h-7 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
                                                    onClick={async () => {
                                                        const prompt = window.prompt("What happens next in the video?")
                                                        if (!prompt) return
                                                        await fetch('/api/extend', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ job_id: job.id, prompt })
                                                        })
                                                    }}
                                                >
                                                    <FastForward className="w-3 h-3 mr-1" /> Extend +7s
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>

            </main>
        </div>
    )
}
