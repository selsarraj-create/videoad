"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Shot } from "@/lib/types"

interface Job {
    id: string;
    created_at: string;
    prompt: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    video_url: string | null;
    model: string;
    is_4k: boolean;
    workspace_id: string;
}

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Wand2, Zap, Plus, Layers, Film, Settings,
    History, PlayCircle, MousePointer2, Camera,
    Box, Loader2
} from "lucide-react"
import { ModelSelector } from "@/components/model-selector"
import { StoryboardPanel } from "@/components/storyboard-panel"
import { MODELS, calculateCredits } from "@/lib/models"
import { saveProjectState, loadProjectState } from "@/app/actions"

export default function StudioPage() {
    // Mode & State
    const [mode, setMode] = useState<'draft' | 'storyboard'>('storyboard')
    const [shots, setShots] = useState<Shot[]>([{ id: "s1", prompt: "", action: "", duration: 5, cameraMove: "static" }])
    const [prompt, setPrompt] = useState("")
    const [anchorStyle, setAnchorStyle] = useState("")
    const [selectedModelId, setSelectedModelId] = useState<string>("veo-3.1-fast")
    const [is4k, setIs4k] = useState<boolean>(false)
    const [loading, setLoading] = useState(false)
    const [jobs, setJobs] = useState<Job[]>([])
    const [isGenerating, setIsGenerating] = useState(false) // Add isGenerating state

    const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0]
    const supabase = createClient()

    // Fetch Jobs Effect
    useEffect(() => {
        const fetchJobs = async () => {
            const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false })
            if (data) setJobs(data as Job[])
        }
        fetchJobs()
        const interval = setInterval(fetchJobs, 5000)
        return () => clearInterval(interval)
    }, [])

    // -------------------------------------------------------------------------
    // Auto-Save & Load Logic
    // -------------------------------------------------------------------------
    useEffect(() => {
        const timer = setTimeout(() => {
            const projectId = "default-project-id"
            saveProjectState(projectId, {
                mode, shots, anchorStyle, selectedModelId, is4k,
                prompt: mode === 'draft' ? prompt : undefined
            })
        }, 3000)
        return () => clearTimeout(timer)
    }, [mode, shots, anchorStyle, selectedModelId, is4k, prompt])

    useEffect(() => {
        async function load() {
            const projectId = "default-project-id"
            const result = await loadProjectState(projectId)
            if (result.data) {
                const d = result.data
                setMode(d.mode)
                setShots(d.shots || [])
                setAnchorStyle(d.anchorStyle || "")
                setSelectedModelId(d.selectedModelId || "veo-3.1-fast")
                setIs4k(d.is4k || false)
                if (d.prompt) setPrompt(d.prompt)
            }
        }
        load()
    }, [])

    // -------------------------------------------------------------------------
    // Calculators & Handlers
    // -------------------------------------------------------------------------
    const totalCredits = mode === 'draft'
        ? calculateCredits(selectedModel.baseCredits, 5, is4k)
        : shots.reduce((acc, shot) => acc + calculateCredits(selectedModel.baseCredits, shot.duration, is4k), 0)

    const addShot = () => {
        setShots([...shots, { id: `s${Math.random().toString(36).substr(2, 9)}`, prompt: "", duration: 5, cameraMove: "static" }])
    }
    const updateShot = (id: string, updates: Partial<Shot>) => setShots(shots.map(s => s.id === id ? { ...s, ...updates } : s))
    const removeShot = (id: string) => { if (shots.length > 1) setShots(shots.filter(s => s.id !== id)) }

    const handleGenerate = async () => {
        setLoading(true)
        // ... (API call logic same as before)
        try {
            await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mode === 'draft'
                    ? { prompt, model: selectedModelId, is4k, workspace_id: "def" }
                    : { shots, model: selectedModelId, anchorStyle, is4k, workspace_id: "def" }
                )
            })
        } catch (e) { console.error(e) }
        setTimeout(() => setLoading(false), 2000)
    }

    // Define a default duration for ModelSelector if not in storyboard mode, or use first shot's duration
    const modelSelectorDuration = shots[0]?.duration || 5;


    return (
        <div className="h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 overflow-hidden">
            {/* Header / Credit Gauge */}
            <header className="h-16 border-b border-white/5 bg-background/60 backdrop-blur-xl flex items-center justify-between px-6 z-50 sticky top-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-colors">
                            <Box className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="font-bold text-xl tracking-tighter text-white">
                            ANTIGRAVITY<span className="font-light text-zinc-400">STUDIO</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Mode Switcher */}
                    <div className="flex bg-secondary/50 p-1 rounded-lg border border-border/50">
                        <button
                            onClick={() => setMode('draft')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'draft' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Quick Draft
                        </button>
                        <button
                            onClick={() => setMode('storyboard')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'storyboard' ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Storyboard
                        </button>
                    </div>

                    {/* Credit Gauge */}
                    <div className="flex items-center gap-3 bg-secondary/30 px-3 py-1.5 rounded-full border border-border/50">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-[10px] text-muted-foreground uppercase font-semibold">Cost Est.</span>
                            <span className="text-sm font-bold font-mono text-primary">{totalCredits} CR</span>
                        </div>
                        <div className="h-8 w-[1px] bg-border/50" />
                        <Zap className={`w-4 h-4 ${is4k ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'}`} />
                    </div>
                </div>
            </header>

            {/* 3-Column Studio Layout */}
            <main className="flex-1 grid grid-cols-12 overflow-hidden relative bg-[#121212]">

                {/* 1. REGISTRY (Left - 3 Cols) - HIDDEN IN DRAFT MODE */}
                {mode === 'storyboard' && (
                    <aside className="col-span-3 border-r border-zinc-800 bg-[#121212] flex flex-col overflow-hidden animate-in slide-in-from-left duration-300">
                        <div className="p-4 border-b border-zinc-800 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-30">
                            <h2 className="text-zinc-100 font-bold tracking-tight text-sm uppercase flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-blue-600 rounded-sm" /> Model Registry
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <ModelSelector
                                selectedModelId={selectedModelId}
                                onSelect={setSelectedModelId}
                                duration={modelSelectorDuration}
                                is4k={is4k}
                                compact={true}
                            />
                            <div className="pt-6 border-t border-zinc-800 space-y-6">
                                <div className="flex items-center justify-between">
                                    <Label className="text-zinc-400 text-xs">Quality</Label>
                                    <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                                        <button onClick={() => setIs4k(false)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${!is4k ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>HD</button>
                                        <button onClick={() => setIs4k(true)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${is4k ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'text-zinc-500 hover:text-zinc-300'}`}>4K</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

                {/* 2. TIMELINE / CANVAS (Center - Expands to 9 Cols in Draft Mode) */}
                <section className={`${mode === 'draft' ? 'col-span-9' : 'col-span-6'} bg-[#121212] relative flex flex-col border-r border-zinc-800 transition-all duration-300`}>

                    {/* Header - Only visible in Storyboard Mode */}
                    {mode === 'storyboard' && (
                        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-40">
                            <div className="flex items-center gap-4">
                                <h2 className="text-zinc-100 font-black tracking-tight text-lg">TIMELINE</h2>
                                <Badge variant="outline" className="bg-zinc-900/50 text-zinc-500 border-zinc-800 font-mono text-xs">
                                    {shots.length} SHOTS
                                </Badge>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-6 pb-32 relative">
                        {/* Ambient Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-blue-900/5 rounded-full blur-[100px] pointer-events-none" />

                        {mode === 'draft' ? (
                            /* QUICK DRAFT MODE */
                            <div className="max-w-2xl mx-auto pt-20 pb-40 space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center space-y-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/20 text-blue-400 border border-blue-900/50 text-xs font-bold uppercase tracking-wider mb-4">
                                        <Zap className="w-3 h-3" /> Quick Mode
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                                        Ignite Your Vision
                                    </h2>
                                    <p className="text-lg text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
                                        Generate a high-fidelity 5s preview instantly. Select a model and describe your scene.
                                    </p>
                                </div>

                                <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                                    <CardContent className="p-6 space-y-6 relative z-10">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model Selection</Label>
                                            <div className="bg-black/20 rounded-xl p-4 border border-zinc-800/50">
                                                <ModelSelector
                                                    selectedModelId={selectedModelId}
                                                    onSelect={setSelectedModelId}
                                                    duration={5}
                                                    is4k={is4k}
                                                    compact={true}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Prompt</Label>
                                            <Textarea
                                                placeholder="A cinematic shot of..."
                                                className="resize-none h-32 bg-black/40 border-zinc-800 focus:border-blue-500/50 text-lg p-4 transition-all"
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setIs4k(!is4k)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${is4k ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-zinc-800 text-zinc-400'}`}>
                                                    {is4k ? '4K Ultra HD' : 'HD Standard'}
                                                </button>
                                                <span className="text-xs text-zinc-600 font-mono">
                                                    {calculateCredits(selectedModel.baseCredits, 5, is4k)} Credits
                                                </span>
                                            </div>
                                            <Button
                                                onClick={handleGenerate}
                                                disabled={loading}
                                                size="lg"
                                                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white font-bold px-8 shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all"
                                            >
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                                Generate Preview
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            /* STORYBOARD MODE */
                            <div className="space-y-6 relative z-10 animate-in fade-in duration-500">
                                {shots.map((shot, idx) => (
                                    <StoryboardPanel
                                        key={shot.id}
                                        index={idx}
                                        shot={shot}
                                        onUpdate={updateShot}
                                        onRemove={removeShot}
                                    />
                                ))}

                                <Button
                                    variant="outline"
                                    onClick={addShot}
                                    className="w-full h-16 border-dashed border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/50 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all uppercase tracking-widest text-xs font-bold"
                                >
                                    + Add Shot Card
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions - Only in Storyboard Mode */}
                    {mode === 'storyboard' && (
                        <div className="p-6 border-t border-zinc-800 bg-[#121212]/90 backdrop-blur-xl absolute bottom-0 w-full z-50">
                            <div className="flex gap-4">
                                <Button
                                    disabled={isGenerating || jobs.filter(j => j.status === 'completed').length < 2}
                                    onClick={async () => {
                                        const completedJobIds = jobs.filter(j => j.status === 'completed').map(j => j.id)
                                        try {
                                            const res = await fetch('/api/stitch', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ project_id: "def", job_ids: completedJobIds })
                                            })
                                            if (res.ok) alert("Started!")
                                        } catch (e) { console.error(e) }
                                    }}
                                    variant="secondary"
                                    className="flex-1 bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 h-12 text-sm font-medium"
                                >
                                    <Film className="w-4 h-4 mr-2" /> Export Animatic
                                </Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="flex-[2] bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white border-0 shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all h-12 text-sm font-bold tracking-wide"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" /> GENERATE
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                {/* 3. ARCHIVE (Right - 3 Cols) - ALWAYS VISIBLE */}
                <aside className="col-span-3 bg-[#121212] flex flex-col overflow-hidden border-l border-zinc-800">
                    <div className="p-4 border-b border-zinc-800 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-30 flex justify-between items-center">
                        <h2 className="text-zinc-100 font-bold tracking-tight text-sm uppercase flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-purple-600 rounded-sm" /> Archive
                        </h2>
                        {/* Floating Credit Gauge - Simplified */}
                        <div className="bg-zinc-900/80 px-3 py-1 rounded-full border border-zinc-800 flex items-center gap-2">
                            <span className="text-[10px] text-zinc-500 font-bold">CREDITS</span>
                            <span className="text-sm font-mono text-zinc-200">{totalCredits}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 gap-4">
                            {jobs.map((job) => (
                                <div key={job.id} className="group relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all">
                                    <div className="aspect-video bg-zinc-950 relative">
                                        {job.video_url ? (
                                            <video src={job.video_url} controls className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="text-center space-y-2">
                                                    <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-blue-500 animate-spin mx-auto" />
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Processing</p>
                                                </div>
                                                {/* Pulse Effect */}
                                                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 to-transparent animate-pulse" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-3">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline" className={`text-[10px] h-5 border-0 ${job.status === 'completed' ? 'bg-green-900/20 text-green-400' : 'bg-blue-900/20 text-blue-400'}`}>
                                                {job.status}
                                            </Badge>
                                            <span className="text-[10px] text-zinc-600 font-mono">
                                                {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-500 mt-2 line-clamp-1">{job.prompt}</p>
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
