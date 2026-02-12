"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Shot } from "@/lib/types"
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
    Box
} from "lucide-react"
import { ModelSelector } from "@/components/model-selector"
import { StoryboardPanel } from "@/components/storyboard-panel"
import { MODELS, calculateCredits } from "@/lib/models"
import { saveProjectState, loadProjectState } from "@/app/actions"

export default function StudioPage() {
    // Mode & State
    const [mode, setMode] = useState<'draft' | 'storyboard'>('storyboard')
    const [shots, setShots] = useState<Shot[]>([{ id: "s1", prompt: "", duration: 5, cameraMove: "static" }])
    const [prompt, setPrompt] = useState("")
    const [anchorStyle, setAnchorStyle] = useState("")
    const [selectedModelId, setSelectedModelId] = useState<string>("veo-3.1-fast")
    const [is4k, setIs4k] = useState<boolean>(false)
    const [loading, setLoading] = useState(false)

    const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0]
    const supabase = createClient()

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

    return (
        <div className="h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
            {/* Header / Credit Gauge */}
            <header className="h-14 border-b bg-card/50 backdrop-blur-md flex items-center justify-between px-6 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Box className="w-6 h-6 text-primary" />
                        <h1 className="font-bold text-lg tracking-tight">Antigravity<span className="text-primary font-light">Studio</span></h1>
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

            {/* 3-Column Layout */}
            <main className="flex-1 grid grid-cols-12 overflow-hidden">

                {/* 1. The Director's Console (Left) */}
                <aside className="col-span-3 border-r bg-card/30 backdrop-blur-sm p-4 overflow-y-auto space-y-6">
                    <div>
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Settings className="w-3 h-3" /> Production Settings
                        </h2>

                        {/* Anchor */}
                        <Card className="mb-4 bg-secondary/20 border-border/50 shadow-none">
                            <CardHeader className="p-3 pb-0">
                                <CardTitle className="text-xs font-medium flex items-center gap-2">
                                    <Layers className="w-3 h-3 text-primary" /> Style Anchor
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-3 space-y-3">
                                <Input
                                    className="h-8 text-xs bg-background/50 border-border/50 focus:border-primary/50"
                                    placeholder="Global style prompt..."
                                    value={anchorStyle}
                                    onChange={(e) => setAnchorStyle(e.target.value)}
                                />
                                <div className="h-20 border border-dashed border-border rounded-md flex items-center justify-center text-xs text-muted-foreground hover:bg-secondary/50 cursor-pointer transition-colors">
                                    Upload Reference
                                </div>
                            </CardContent>
                        </Card>

                        {/* Formatting */}
                        <div className="space-y-4 px-1">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">UHD 4K Upscale</Label>
                                <Switch checked={is4k} onCheckedChange={setIs4k} className="scale-75 origin-right" />
                            </div>
                            <Separator className="bg-border/50" />
                        </div>
                    </div>

                    {/* Model Registry */}
                    <div className="flex-1">
                        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Box className="w-3 h-3" /> Model Registry
                        </h2>
                        <ModelSelector
                            selectedModelId={selectedModelId}
                            onSelect={setSelectedModelId}
                            duration={5}
                            is4k={is4k}
                            compact={true} // New prop needed for compact view
                        />
                    </div>
                </aside>

                {/* 2. The Canvas (Center) */}
                <section className="col-span-6 bg-background relative flex flex-col">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />

                    <div className="flex-1 overflow-y-auto p-8 relative z-10 w-full max-w-3xl mx-auto">
                        {mode === 'draft' ? (
                            <div className="mt-20 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center space-y-2">
                                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Quick Draft</Badge>
                                    <h2 className="text-3xl font-bold tracking-tight">What are you creating?</h2>
                                    <p className="text-muted-foreground">Describe your vision for a rapid 5s generation.</p>
                                </div>
                                <div className="relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                    <Textarea
                                        placeholder="A futuristic city with flying cars..."
                                        className="relative min-h-[160px] text-lg p-6 bg-card border-border/50 focus:border-primary resize-none shadow-2xl"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                    />
                                    <div className="absolute bottom-4 right-4">
                                        <Button size="sm" onClick={handleGenerate} disabled={loading} className="gap-2 shadow-lg shadow-primary/20">
                                            <Wand2 className="w-4 h-4" /> {loading ? "Dreaming..." : "Generate"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 pb-32">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-semibold flex items-center gap-2">
                                        <Film className="w-5 h-5 text-primary" /> Timeline
                                    </h2>
                                    <Button size="sm" onClick={handleGenerate} disabled={loading} className="gap-2">
                                        <Wand2 className="w-4 h-4" /> {loading ? "Rendering..." : "Render All Shots"}
                                    </Button>
                                </div>

                                <div className="space-y-0 relative">
                                    {/* Continuous Line */}
                                    <div className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-border to-transparent" />

                                    {shots.map((shot, idx) => (
                                        <div key={shot.id} className="relative pl-14 py-4 group">
                                            {/* Node */}
                                            <div className="absolute left-[1.15rem] top-10 w-4 h-4 rounded-full border-2 border-primary bg-background z-10 group-hover:scale-110 transition-transform shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                            <div className="absolute left-[2.9rem] top-[2.6rem] text-[10px] font-mono text-muted-foreground">
                                                {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                                            </div>

                                            <StoryboardPanel
                                                index={idx}
                                                shot={shot}
                                                onUpdate={updateShot}
                                                onRemove={removeShot}
                                            />
                                        </div>
                                    ))}

                                    <div className="pl-14 pt-4">
                                        <Button variant="outline" onClick={addShot} className="w-full border-dashed border-border/50 hover:bg-secondary/50 hover:border-primary/50 h-10 gap-2 text-muted-foreground">
                                            <Plus className="w-4 h-4" /> Add Next Shot
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* 3. The Archive (Right) */}
                <aside className="col-span-3 border-l bg-card/30 backdrop-blur-sm p-4 flex flex-col">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                        <History className="w-3 h-3" /> Recent Jobs
                    </h2>

                    <ScrollArea className="flex-1 -mx-4 px-4">
                        <div className="space-y-3">
                            {/* Placeholder Items */}
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="group relative aspect-video bg-muted rounded-md overflow-hidden border border-border/50 hover:border-primary/50 transition-colors cursor-pointer">
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <PlayCircle className="w-8 h-8 text-white drop-shadow-lg" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                        <p className="text-[10px] text-white font-medium truncate">Futuristic City {i}</p>
                                        <p className="text-[9px] text-white/70">Veo 3.1 • 5s</p>
                                    </div>
                                </div>
                            ))}
                            <div className="p-4 text-center">
                                <p className="text-xs text-muted-foreground">View Full Archive</p>
                            </div>
                        </div>
                    </ScrollArea>
                </aside>

            </main>
        </div>
    )
}
