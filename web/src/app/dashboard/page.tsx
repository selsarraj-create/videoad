"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Shot } from "@/lib/types"

interface Job {
    id: string;
    created_at: string;
    input_params: { prompt: string; style_ref?: string };
    status: 'pending' | 'processing' | 'completed' | 'failed';
    output_url: string | null;
    model: string;
    tier: string;
    project_id: string;
    error_message: string | null;
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
import { saveProjectState, loadProjectState, getOrCreateDefaultProject } from "@/app/actions"

import { CreditBadge } from "@/components/credit-badge"
import { useCreditCalculator } from "@/hooks/use-credit-calculator"

export default function StudioPage() {
    // Mode & State
    const [mode, setMode] = useState<'draft' | 'storyboard'>('storyboard')
    const [shots, setShots] = useState<Shot[]>([{ id: "s1", prompt: "", action: "", duration: 5, cameraMove: "static" }])
    const [prompt, setPrompt] = useState("")
    const [anchorStyle, setAnchorStyle] = useState("")
    const [selectedModelId, setSelectedModelId] = useState<string>("veo-3.1-fast")
    const [is4k, setIs4k] = useState<boolean>(false)
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9')
    const [loading, setLoading] = useState(false)
    const [jobs, setJobs] = useState<Job[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [projectId, setProjectId] = useState<string | null>(null)

    const supabase = createClient()
    const userBalance = 500 // Mock balance for now

    // Initialize: get or create default workspace + project
    useEffect(() => {
        getOrCreateDefaultProject().then(({ projectId: pid, error }) => {
            if (pid) setProjectId(pid)
            if (error) console.error('Project init error:', error)
        })
    }, [])

    // Real-time Credit Calculation
    const totalCredits = useCreditCalculator({
        mode,
        shots,
        selectedModelId,
        is4k
    })

    // Budget Guardrail
    const isOverBudget = totalCredits > userBalance

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

    // ... (Auto-Save logic remains same)
    // -------------------------------------------------------------------------
    // Auto-Save & Load Logic
    // -------------------------------------------------------------------------
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!projectId) return
            saveProjectState(projectId, {
                mode, shots, anchorStyle, selectedModelId, is4k,
                prompt: mode === 'draft' ? prompt : undefined
            })
        }, 3000)
        return () => clearTimeout(timer)
    }, [mode, shots, anchorStyle, selectedModelId, is4k, prompt, projectId])

    useEffect(() => {
        async function load() {
            if (!projectId) return
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
    }, [projectId])

    const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0]

    const addShot = () => {
        setShots([...shots, { id: `s${Math.random().toString(36).substr(2, 9)}`, prompt: "", duration: 5, cameraMove: "static" }])
    }
    const updateShot = (id: string, updates: Partial<Shot>) => setShots(shots.map(s => s.id === id ? { ...s, ...updates } : s))
    const removeShot = (id: string) => { if (shots.length > 1) setShots(shots.filter(s => s.id !== id)) }

    const handleGenerate = async () => {
        if (isOverBudget) return
        setLoading(true)
        try {
            await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mode === 'draft'
                    ? { prompt, model: selectedModelId, is4k, workspace_id: projectId, provider_metadata: { duration: 8, aspect_ratio: aspectRatio } }
                    : { shots, model: selectedModelId, anchorStyle, is4k, workspace_id: projectId, provider_metadata: { aspect_ratio: aspectRatio } }
                )
            })
        } catch (e) { console.error(e) }
        setTimeout(() => setLoading(false), 2000)
    }

    const modelSelectorDuration = shots[0]?.duration || 5;

    return (
        <div className="h-screen bg-[#121212] text-zinc-400 flex flex-col font-sans selection:bg-primary/30 overflow-hidden">
            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-[#121212]/80 backdrop-blur-xl flex items-center justify-between px-6 z-50 sticky top-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/10 group-hover:border-white/30 transition-colors">
                            <Box className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="font-bold text-xl tracking-tighter text-white/90">
                            CREATIVE<span className="font-light text-zinc-500">STUDIO</span>
                        </h1>
                    </div>
                    {/* Logout Button */}
                    <button
                        onClick={async () => {
                            const supabase = createClient()
                            await supabase.auth.signOut()
                            window.location.href = "/"
                        }}
                        className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors uppercase font-bold tracking-wider"
                    >
                        Logout
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    {/* Mode Switcher */}
                    <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-700 shadow-inner">
                        <button
                            onClick={() => setMode('draft')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wide transition-all duration-300 ${mode === 'draft' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/40 ring-1 ring-white/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <Zap className={`w-3.5 h-3.5 ${mode === 'draft' ? 'fill-white text-white' : ''}`} />
                            Quick Draft
                        </button>
                        <button
                            onClick={() => setMode('storyboard')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wide transition-all duration-300 ${mode === 'storyboard' ? 'bg-zinc-100 text-black shadow-lg shadow-white/10 ring-1 ring-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <Film className={`w-3.5 h-3.5 ${mode === 'storyboard' ? 'fill-black text-black' : ''}`} />
                            Storyboard
                        </button>
                    </div>

                    {/* Real-time Credit Estimator */}
                    <CreditBadge cost={totalCredits} balance={userBalance} />
                </div>
            </header>

            {/* 3-Column Studio Layout */}
            <main className="flex-1 grid grid-cols-12 overflow-hidden relative bg-[#121212]">

                {/* 1. REGISTRY (Left - 3 Cols) - Glassmorphism */}
                {mode === 'storyboard' && (
                    <aside className="col-span-3 border-r border-zinc-800 bg-zinc-900/40 backdrop-blur-md flex flex-col overflow-hidden animate-in slide-in-from-left duration-300">
                        <div className="p-4 border-b border-zinc-800 bg-transparent sticky top-0 z-30">
                            <h2 className="text-zinc-100/90 font-bold tracking-tight text-sm uppercase flex items-center gap-2">
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
                                    <Label className="text-zinc-500 text-xs font-medium">Quality</Label>
                                    <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                                        <button onClick={() => setIs4k(false)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${!is4k ? 'bg-zinc-800 text-zinc-200 shadow-sm' : 'text-zinc-600 hover:text-zinc-400'}`}>HD</button>
                                        <button onClick={() => setIs4k(true)} className={`px-3 py-1 rounded text-[10px] font-bold transition-all ${is4k ? 'bg-blue-900/40 text-blue-400 border border-blue-800' : 'text-zinc-600 hover:text-zinc-400'}`}>4K</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                )}

                {/* 2. TIMELINE / CANVAS */}
                <section className={`${mode === 'draft' ? 'col-span-9' : 'col-span-6'} bg-[#121212] relative flex flex-col border-r border-zinc-800 transition-all duration-300 min-h-0`}>

                    {/* Header */}
                    {mode === 'storyboard' && (
                        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-[#121212]/80 backdrop-blur-md sticky top-0 z-40">
                            <div className="flex items-center gap-4">
                                <h2 className="text-zinc-100/90 font-black tracking-tight text-lg">TIMELINE</h2>
                                <Badge variant="outline" className="bg-zinc-900/50 text-zinc-500 border-zinc-800 font-mono text-xs">
                                    {shots.length} SHOTS
                                </Badge>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-60 relative w-full h-full">
                        {/* Ambient Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-blue-900/5 rounded-full blur-[100px] pointer-events-none" />

                        {mode === 'draft' ? (
                            /* QUICK DRAFT MODE */
                            <div className="max-w-2xl mx-auto pt-10 pb-64 space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center space-y-4">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/10 text-blue-400 border border-blue-900/30 text-xs font-bold uppercase tracking-wider mb-4">
                                        <Zap className="w-3 h-3" /> Quick Mode
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white/90">
                                        Ignite Your Vision
                                    </h2>
                                    <p className="text-lg text-zinc-400 font-light max-w-lg mx-auto leading-relaxed">
                                        Generate a high-fidelity 8s preview instantly. Select a model and describe your scene.
                                    </p>
                                </div>

                                <Card className="bg-zinc-900/30 border-zinc-800 filter backdrop-blur-xl relative group">
                                    <CardContent className="p-6 space-y-6 relative z-10">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Model Selection</Label>
                                            <div className="bg-black/20 rounded-xl p-4 border border-zinc-800/50">
                                                <ModelSelector
                                                    selectedModelId={selectedModelId}
                                                    onSelect={setSelectedModelId}
                                                    duration={8}
                                                    is4k={is4k}
                                                    compact={true}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Prompt</Label>
                                            <Textarea
                                                placeholder="A cinematic shot of..."
                                                className="resize-none h-32 bg-black/40 border-zinc-800 focus:border-blue-500/50 text-lg p-4 transition-all text-zinc-200 placeholder:text-zinc-600"
                                                value={prompt}
                                                onChange={(e) => setPrompt(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setIs4k(!is4k)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${is4k ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-zinc-800 text-zinc-500'}`}>
                                                    {is4k ? '4K Ultra HD' : 'HD Standard'}
                                                </button>
                                                <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                                                    {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                                                        <button
                                                            key={ratio}
                                                            onClick={() => setAspectRatio(ratio)}
                                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${aspectRatio === ratio
                                                                    ? 'bg-blue-900/40 text-blue-400 shadow-sm'
                                                                    : 'text-zinc-500 hover:text-zinc-300'
                                                                }`}
                                                        >
                                                            {ratio}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <Button
                                                onClick={handleGenerate}
                                                disabled={loading || isOverBudget}
                                                size="lg"
                                                className={`font-bold px-8 transition-all ${isOverBudget
                                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]'
                                                    }`}
                                            >
                                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                                                {isOverBudget ? 'Over Limit' : 'Generate Preview'}
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

                    {/* Footer Actions */}
                    {mode === 'storyboard' && (
                        <div className="p-6 border-t border-zinc-800 bg-[#121212]/90 backdrop-blur-xl absolute bottom-0 w-full z-50">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="text-[10px] uppercase font-bold text-zinc-600">Aspect Ratio</span>
                                <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                                    {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                                        <button
                                            key={ratio}
                                            onClick={() => setAspectRatio(ratio)}
                                            className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all ${aspectRatio === ratio
                                                    ? 'bg-blue-900/40 text-blue-400 shadow-sm'
                                                    : 'text-zinc-500 hover:text-zinc-300'
                                                }`}
                                        >
                                            {ratio}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setIs4k(!is4k)} className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ml-auto ${is4k ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-zinc-800 text-zinc-500'}`}>
                                    {is4k ? '4K' : 'HD'}
                                </button>
                            </div>
                            <div className="flex gap-4">
                                <Button
                                    disabled={isGenerating || jobs.filter(j => j.status === 'completed').length < 2}
                                    onClick={async () => {
                                        const completedJobIds = jobs.filter(j => j.status === 'completed').map(j => j.id)
                                        try {
                                            await fetch('/api/stitch', { // simplified fetch
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ project_id: projectId, job_ids: completedJobIds })
                                            })
                                            alert("Started!")
                                        } catch (e) { console.error(e) }
                                    }}
                                    variant="secondary"
                                    className="flex-1 bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 h-12 text-sm font-medium"
                                >
                                    <Film className="w-4 h-4 mr-2" /> Export Animatic
                                </Button>
                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading || isOverBudget}
                                    className={`flex-[2] border-0 transition-all h-12 text-sm font-bold tracking-wide ${isOverBudget
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]'
                                        }`}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="w-4 h-4 mr-2" /> {isOverBudget ? 'INSUFFICIENT FUNDS' : 'GENERATE'}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </section>

                {/* 3. ARCHIVE (Right - 3 Cols) - Glassmorphism */}
                <aside className="col-span-3 bg-zinc-900/40 backdrop-blur-md flex flex-col overflow-hidden border-l border-zinc-800">
                    <div className="p-4 border-b border-zinc-800 bg-transparent sticky top-0 z-30 flex justify-between items-center">
                        <h2 className="text-zinc-100/90 font-bold tracking-tight text-sm uppercase flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-purple-600 rounded-sm" /> Archive
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        <div className="grid grid-cols-1 gap-4">
                            {jobs.map((job) => (
                                <div key={job.id} className="group relative rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all">
                                    <div className="aspect-video bg-zinc-950 relative">
                                        {job.output_url ? (
                                            <video src={job.output_url} controls className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="text-center space-y-2">
                                                    <div className="w-8 h-8 rounded-full border-2 border-zinc-800 border-t-blue-500 animate-spin mx-auto" />
                                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">{job.status === 'failed' ? 'Failed' : 'Processing'}</p>
                                                </div>
                                                {job.status !== 'failed' && <div className="absolute inset-0 bg-gradient-to-t from-blue-900/10 to-transparent animate-pulse" />}
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
                                        <p className="text-[10px] text-zinc-500 mt-2 line-clamp-1">{job.input_params?.prompt || 'No prompt'}</p>
                                        {job.error_message && <p className="text-[10px] text-red-400 mt-1 line-clamp-1">{job.error_message}</p>}
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
