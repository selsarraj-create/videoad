"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { type Preset } from "@/lib/presets"
import { motion, AnimatePresence } from "framer-motion"

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
    Video, User, Shirt, Check, Plus, ArrowRight, Trash2, X
} from "lucide-react"
import { PresetGrid } from "@/components/preset-grid"
import { getOrCreateDefaultProject } from "@/app/actions"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { BespokeInput } from "@/components/ui/bespoke-input"
import { ParticleSilhouette } from "@/components/ui/particle-silhouette"
import { StatusPill } from "@/components/ui/status-pill"

type Tab = 'try-on' | 'video'

interface PersonaSlot {
    id: string
    name: string
    master_identity_url: string | null
    is_default: boolean
    status: string
    created_at: string
}

export default function StudioPage() {
    const [activeTab, setActiveTab] = useState<Tab>('try-on')

    // Persona state
    const [personaSlots, setPersonaSlots] = useState<PersonaSlot[]>([])
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
    const [personaLoading, setPersonaLoading] = useState(true)

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

    // Extension Dialog State
    const [extensionDialogOpen, setExtensionDialogOpen] = useState(false)
    const [extensionJob, setExtensionJob] = useState<Job | null>(null)
    const [extensionPrompt, setExtensionPrompt] = useState("")

    // Shared state
    const [jobs, setJobs] = useState<Job[]>([])
    const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
    const [projectId, setProjectId] = useState<string | null>(null)


    const garmentFileRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // Derived: get selected persona's image URL
    const selectedPersona = personaSlots.find(p => p.id === selectedPersonaId)
    const masterIdentityUrl = selectedPersona?.master_identity_url || null

    // Fetch persona slots
    const fetchPersonas = useCallback(async () => {
        try {
            const res = await fetch('/api/personas')
            const data = await res.json()
            if (data.personas) {
                setPersonaSlots(data.personas)
                // Auto-select default or first
                if (!selectedPersonaId || !data.personas.find((p: PersonaSlot) => p.id === selectedPersonaId)) {
                    const defaultP = data.personas.find((p: PersonaSlot) => p.is_default) || data.personas[0]
                    if (defaultP) setSelectedPersonaId(defaultP.id)
                }
            }
        } catch (err) {
            console.error('Failed to fetch personas:', err)
        } finally {
            setPersonaLoading(false)
        }
    }, [selectedPersonaId])

    // Initialize
    useEffect(() => {
        getOrCreateDefaultProject().then(({ projectId: pid }) => {
            if (pid) setProjectId(pid)
        })
        fetchPersonas()
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

    // Delete persona handler
    const handleDeletePersona = async (id: string) => {
        try {
            await fetch(`/api/personas?id=${id}`, { method: 'DELETE' })
            await fetchPersonas()
        } catch (err) {
            console.error('Failed to delete persona:', err)
        }
    }

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
                body: JSON.stringify({
                    identity_id: selectedPersonaId,
                    person_image_url: masterIdentityUrl,
                    garment_image_url: garmentImageUrl
                })
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
                    aspect_ratio: aspectRatio,
                    identity_id: selectedPersonaId || ''
                })
            })
        } catch (e) { console.error(e) }
        setTimeout(() => setVideoLoading(false), 2000)
    }

    // Extension Handler
    const handleExtendVideo = async () => {
        if (!extensionJob || !extensionPrompt) return;

        try {
            await fetch('/api/extend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: extensionJob.id, prompt: extensionPrompt })
            })
            setExtensionDialogOpen(false)
            setExtensionPrompt("")
            setExtensionJob(null)
        } catch (e) {
            console.error(e)
        }
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
            className={`relative border-b border-nimbus transition-all duration-300 cursor-pointer overflow-hidden group py-10
                ${preview ? 'bg-white' : 'bg-transparent hover:bg-white/40'}`}
        >
            {preview ? (
                <div className="relative aspect-[3/4] max-h-[300px] mx-auto">
                    <img src={preview} alt={label} className="w-full h-full object-contain p-4 mix-blend-multiply" />
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setGarmentPreview(null); setGarmentImageUrl('')
                            }}
                            className="bg-stretch-limo text-white w-6 h-6 flex items-center justify-center rounded-none text-[10px]"
                        >×</button>
                    </div>
                    <Badge className="absolute bottom-4 left-4 bg-stretch-limo text-white border-0 rounded-none text-[9px] uppercase tracking-widest">
                        ✓ {label}
                    </Badge>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 flex items-center justify-center border border-nimbus rounded-none group-hover:border-stretch-limo transition-colors">
                        <IconComp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{label}</p>
                        <p className="text-[10px] text-muted-foreground italic font-serif">{sublabel}</p>
                    </div>
                </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
        </div>
    )

    return (
        <div className="min-h-screen bg-paper text-foreground flex flex-col font-sans overflow-hidden selection:bg-primary/20">
            {/* Header */}
            <header className="h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-8 z-50 sticky top-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <h1 className="font-serif text-xl tracking-tight text-foreground mix-blend-difference">
                            FASHION<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">STUDIO</span>
                        </h1>
                    </div>

                    {/* Tab Switcher - Minimal Text Only */}
                    <div className="flex items-center gap-8 ml-12">
                        <button onClick={() => setActiveTab('try-on')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2 
                                ${activeTab === 'try-on' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Try On
                            {activeTab === 'try-on' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('video')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2
                                ${activeTab === 'video' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Create Video
                            {activeTab === 'video' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <Link href="/dashboard/content"
                        className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                        <Library className="w-3.5 h-3.5" /> Content Vault
                    </Link>
                </div>
            </header>

            <main className="flex-1 grid grid-cols-12 overflow-hidden">

                {/* ===== LEFT PANEL ===== */}
                <section className="col-span-12 lg:col-span-5 flex flex-col overflow-y-auto glass-panel z-20 relative">
                    <div className="flex-1 p-8 lg:p-12 max-w-xl mx-auto w-full space-y-12">

                        {activeTab === 'try-on' ? (
                            /* ---- TRY ON TAB ---- */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-12">
                                {/* Identity Banner */}
                                {!personaLoading && personaSlots.length === 0 && (
                                    <div className="p-6 border border-nimbus bg-white/50 flex flex-col gap-4">
                                        <div className="space-y-2">
                                            <p className="font-serif text-lg text-primary">Identity Required</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">Create your first persona to begin. You can have up to 5 different looks.</p>
                                        </div>
                                        <Link href="/dashboard/onboard">
                                            <Button className="w-full bg-foreground text-background rounded-none hover:bg-primary transition-colors h-12 text-xs uppercase tracking-widest">
                                                <Plus className="w-4 h-4 mr-2" /> Create First Persona
                                            </Button>
                                        </Link>
                                    </div>
                                )}

                                {/* Step 1: Persona Gallery */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">01 / Personas</Label>
                                        {selectedPersona && <span className="text-[10px] text-primary italic font-serif">{selectedPersona.name}</span>}
                                    </div>

                                    {/* Horizontal Gallery */}
                                    <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
                                        {personaSlots.map((persona) => (
                                            <button
                                                key={persona.id}
                                                onClick={() => setSelectedPersonaId(persona.id)}
                                                className={`relative flex-shrink-0 w-28 group snap-start transition-all duration-300 ${selectedPersonaId === persona.id
                                                    ? 'ring-2 ring-primary shadow-lg scale-[1.02]'
                                                    : 'opacity-70 hover:opacity-100'
                                                    }`}
                                            >
                                                <div className="aspect-[3/4] bg-white p-1 shadow-sm overflow-hidden">
                                                    {persona.master_identity_url ? (
                                                        <img src={persona.master_identity_url} alt={persona.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full bg-nimbus/20 flex items-center justify-center">
                                                            <User className="w-8 h-8 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-[9px] text-center mt-2 font-bold uppercase tracking-widest text-muted-foreground truncate">{persona.name}</p>
                                                {persona.is_default && (
                                                    <Badge className="absolute top-1 left-1 bg-primary text-primary-foreground border-0 rounded-none text-[7px] uppercase tracking-widest px-1 py-0">Default</Badge>
                                                )}
                                                {/* Delete button on hover */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePersona(persona.id) }}
                                                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </button>
                                        ))}

                                        {/* Add Persona Slot */}
                                        {personaSlots.length < 5 && (
                                            <Link href="/dashboard/onboard" className="flex-shrink-0 w-28 snap-start">
                                                <div className="aspect-[3/4] border-2 border-dashed border-nimbus flex items-center justify-center hover:border-primary transition-colors group cursor-pointer">
                                                    <Plus className="w-6 h-6 text-nimbus group-hover:text-primary transition-colors" />
                                                </div>
                                                <p className="text-[9px] text-center mt-2 font-bold uppercase tracking-widest text-muted-foreground">Add</p>
                                            </Link>
                                        )}
                                    </div>
                                </div>

                                {/* Step 2: Upload Clothing */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">02 / Garment</Label>
                                        <span className="text-[10px] text-muted-foreground italic font-serif">Upload flat-lay</span>
                                    </div>
                                    {renderUploadZone('garment', garmentPreview, garmentFileRef, Shirt, 'Upload Garment', 'High resolution flat-lay')}
                                </div>

                                {/* Try On Button */}
                                <div className="space-y-6 pt-8">
                                    <Button
                                        onClick={handleTryOn}
                                        disabled={!canTryOn}
                                        className={`w-full h-14 text-xs font-bold uppercase tracking-[0.2em] transition-all rounded-none ${canTryOn
                                            ? 'bg-foreground text-background hover:bg-primary shadow-xl hover:shadow-2xl'
                                            : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                            }`}
                                    >
                                        {tryOnLoading ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing Geometry...</>
                                        ) : (
                                            <>Generate Try-On <ArrowRight className="w-4 h-4 ml-2" /></>
                                        )}
                                    </Button>

                                    {tryOnError && (
                                        <div className="p-4 border-l-2 border-primary bg-primary/5">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Error</p>
                                            <p className="text-xs text-muted-foreground">{tryOnError}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Try-On Result */}
                                <AnimatePresence>
                                    {tryOnResult && (
                                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-12 border-t border-nimbus">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Result</Label>
                                                <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">Saved to Archive</Badge>
                                            </div>
                                            <div className="relative aspect-[3/4] bg-white p-4 shadow-2xl">
                                                <img src={tryOnResult} alt="Try-on result" className="w-full h-full object-contain" />
                                            </div>
                                            <Button
                                                onClick={() => {
                                                    setActiveTab('video')
                                                    const item = mediaLibrary.find(m => m.image_url === tryOnResult)
                                                    if (item) setSelectedMediaItem(item)
                                                }}
                                                className="w-full h-12 bg-white text-foreground border border-nimbus hover:bg-foreground hover:text-white rounded-none text-xs uppercase tracking-widest transition-colors"
                                            >
                                                Motion Process →
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            /* ---- VIDEO TAB ---- */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-12">
                                {/* Step 1: Pick from Media Library */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">01 / Select Asset</Label>
                                    </div>
                                    {mediaLibrary.length === 0 ? (
                                        <div className="py-20 text-center border border-dashed border-nimbus">
                                            <ImageIcon className="w-6 h-6 text-nimbus mx-auto mb-4" />
                                            <p className="text-xs text-muted-foreground font-serif italic">Archive empty.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-4">
                                            {mediaLibrary.map(item => (
                                                <button key={item.id}
                                                    onClick={() => setSelectedMediaItem(item)}
                                                    className={`relative aspect-[3/4] transition-all bg-white p-2 shadow-sm hover:shadow-md ${selectedMediaItem?.id === item.id
                                                        ? 'ring-1 ring-primary shadow-lg scale-[1.02]'
                                                        : 'opacity-70 hover:opacity-100'
                                                        }`}
                                                >
                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Select Preset */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">02 / Motion Grade</Label>
                                    </div>
                                    <PresetGrid selectedPresetId={selectedPreset?.id || null} onSelect={setSelectedPreset} />
                                </div>

                                {/* Step 3: Format & Generate */}
                                <div className="space-y-8 pb-12">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">03 / Output</Label>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest w-24">Aspect Ratio</span>
                                        <div className="flex gap-2">
                                            {(['9:16', '16:9', '1:1'] as const).map(ratio => (
                                                <button key={ratio} onClick={() => setAspectRatio(ratio)}
                                                    className={`text-[10px] border px-4 py-2 uppercase tracking-widest transition-all ${aspectRatio === ratio ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-nimbus hover:border-foreground'
                                                        }`}>
                                                    {ratio}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {videoLoading ? (
                                        <StatusPill status="rendering" />
                                    ) : (
                                        <Button onClick={handleGenerateVideo} disabled={!canGenerateVideo}
                                            className={`w-full h-14 text-xs font-bold uppercase tracking-[0.2em] transition-all rounded-none ${canGenerateVideo
                                                ? 'bg-foreground text-background hover:bg-primary shadow-xl hover:shadow-2xl'
                                                : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                                }`}>
                                            Generate Motion <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </section>

                {/* ===== RIGHT: Archive (Gallery Masonry) ===== */}
                <aside className="col-span-12 lg:col-span-7 bg-[#FBFBFB] flex flex-col overflow-hidden relative">
                    {/* Background Detail */}
                    <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                        <h2 className="text-[120px] font-serif text-primary leading-none">
                            {activeTab === 'try-on' ? 'ARCHIVE' : 'CINEMA'}
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-12 lg:p-16 relative z-10">

                        {/* Asymmetrical Masonry Grid */}
                        <div className="columns-1 md:columns-2 gap-8 space-y-8 [&>div]:break-inside-avoid">

                            {/* Empty State */}
                            {((activeTab === 'try-on' && mediaLibrary.length === 0) || (activeTab === 'video' && videoJobs.length === 0)) && (
                                <div className="h-full flex flex-col items-center justify-center py-32 text-center opacity-40">
                                    <div className="text-6xl mb-4 font-serif italic text-nimbus">Empty</div>
                                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Begin creation to populate archive</p>
                                </div>
                            )}

                            {activeTab === 'try-on' ? (
                                /* Try-on Masonry */
                                mediaLibrary.map((item, i) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className={`relative group bg-white p-3 shadow-sm hover:shadow-xl transition-all duration-500
                                            ${i % 3 === 0 ? 'mt-12' : ''} /* Asymmetrical Stagger */
                                            ${i % 2 === 0 ? 'rotate-1' : '-rotate-1 hover:rotate-0'}
                                        `}
                                    >
                                        <div className="relative overflow-hidden aspect-[3/4] bg-[#f9f9f9]">
                                            <img src={item.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />

                                            {/* Hover HUD */}
                                            <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                <Button variant="outline" size="sm"
                                                    onClick={() => { setActiveTab('video'); setSelectedMediaItem(item) }}
                                                    className="h-10 text-[10px] uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-white rounded-none">
                                                    Create Video
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="pt-3 flex justify-between items-center opacity-60">
                                            <span className="text-[9px] font-mono uppercase tracking-widest">NO. {item.id.slice(0, 4)}</span>
                                            <span className="text-[9px] font-serif italic">{new Date(item.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                /* Video Masonry */
                                videoJobs.map((job, i) => (
                                    <motion.div
                                        key={job.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className={`relative group bg-white shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden
                                            ${i % 3 === 0 ? 'mb-12' : 'mb-0'} /* Asymmetrical Spacing */
                                        `}
                                    >
                                        <div className="relative aspect-video bg-[#000]">
                                            {job.output_url ? (
                                                <video src={job.output_url} controls className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="text-center space-y-4">
                                                        <div className="w-8 h-8 rounded-none border-2 border-white/20 border-t-white animate-spin mx-auto" />
                                                        <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold animate-pulse">
                                                            {job.status === 'failed' ? 'Rendering Failed' : 'Rendering Cinema...'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-white border-t border-nimbus/20">
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge variant="outline" className={`text-[9px] h-5 border-0 rounded-none uppercase tracking-widest ${job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'}`}>
                                                    {job.status}
                                                </Badge>
                                                <span className="text-[9px] text-muted-foreground font-mono">ID: {job.id.slice(0, 6)}</span>
                                            </div>

                                            {job.status === 'completed' && job.output_url && (
                                                <div className="mt-4 pt-4 border-t border-nimbus/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="sm"
                                                        className="w-full h-8 text-[10px] uppercase tracking-widest hover:bg-nimbus/20 rounded-none border border-nimbus"
                                                        onClick={() => {
                                                            setExtensionJob(job)
                                                            setExtensionDialogOpen(true)
                                                        }}>
                                                        Extend Scene +7s
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </aside>
            </main>

            {/* Extension Dialog */}
            <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-none border-primary bg-background p-8">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl text-primary">Extend Sequence</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="uppercase tracking-widest text-[10px] font-bold text-muted-foreground">Current Scene</Label>
                            <div className="aspect-video bg-black overflow-hidden relative">
                                {extensionJob && <video src={extensionJob.output_url!} className="w-full h-full object-cover opacity-50" />}
                            </div>
                        </div>
                        <BespokeInput
                            value={extensionPrompt}
                            onChange={(e) => setExtensionPrompt(e.target.value)}
                            label="Narrative Continuation (Prompt)"
                            placeholder="Describe what happens next..."
                        />
                    </div>
                    <DialogFooter className="sm:justify-between items-center gap-4">
                        <Button variant="ghost" onClick={() => setExtensionDialogOpen(false)} className="text-xs uppercase tracking-widest rounded-none">Cancel</Button>
                        <Button onClick={handleExtendVideo} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-widest rounded-none px-8 h-10">Run Extension</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </div>
    )
}
