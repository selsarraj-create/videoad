"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { VideoJob, Shot } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Wand2, Play, AlertCircle, CheckCircle2, Clock, Zap, Plus, Layers, Film } from "lucide-react"
import { ModelSelector } from "@/components/model-selector"
import { StoryboardPanel } from "@/components/storyboard-panel"
import { MODELS, calculateCredits } from "@/lib/models"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { saveProjectState, loadProjectState } from "@/app/actions"

export default function StudioPage() {
    // Workspace Mode: 'draft' | 'storyboard'
    const [mode, setMode] = useState<'draft' | 'storyboard'>('storyboard')

    const [activeTab, setActiveTab] = useState("storyboard")
    const [shots, setShots] = useState<Shot[]>([
        { id: "s1", prompt: "", duration: 5, cameraMove: "static" }
    ])
    const [prompt, setPrompt] = useState("") // Single prompt for Draft Mode

    // Anchor Shot state
    const [anchorStyle, setAnchorStyle] = useState("")

    // Model Selection
    const [selectedModelId, setSelectedModelId] = useState<string>("veo-3.1-fast")
    const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0]
    const [is4k, setIs4k] = useState<boolean>(false)

    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Calculate total project credits
    const totalCredits = mode === 'draft'
        ? calculateCredits(selectedModel.baseCredits, 5, is4k) // Draft is fixed 5s for now
        : shots.reduce((acc, shot) => acc + calculateCredits(selectedModel.baseCredits, shot.duration, is4k), 0)

    // Auto-save logic
    useEffect(() => {
        const timer = setTimeout(() => {
            // Mock project ID for now. In a real app, this would be from params.
            const projectId = "default-project-id"
            saveProjectState(projectId, {
                mode,
                shots,
                anchorStyle,
                selectedModelId,
                is4k,
                prompt: mode === 'draft' ? prompt : undefined
            })
        }, 3000) // Debounce 3s
        return () => clearTimeout(timer)
    }, [mode, shots, anchorStyle, selectedModelId, is4k, prompt])

    // Load initial state
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

    const addShot = () => {
        const newShot: Shot = {
            id: `s${Math.random().toString(36).substr(2, 9)}`,
            prompt: "",
            duration: 5,
            cameraMove: "static"
        }
        setShots([...shots, newShot])
    }

    const updateShot = (id: string, updates: Partial<Shot>) => {
        setShots(shots.map(s => s.id === id ? { ...s, ...updates } : s))
    }

    const removeShot = (id: string) => {
        if (shots.length > 1) {
            setShots(shots.filter(s => s.id !== id))
        }
    }

    const handleGenerate = async () => {
        setLoading(true)
        const payload = mode === 'draft'
            ? { prompt, model: selectedModelId, is4k, workspace_id: "def" }
            : { shots, model: selectedModelId, anchorStyle, is4k, workspace_id: "def" }

        console.log(`Generating in ${mode} mode:`, payload)

        try {
            await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
        } catch (e) {
            console.error(e)
        }

        setTimeout(() => setLoading(false), 2000)
    }

    const handleGenerateAnimatic = async () => {
        handleGenerate()
    }

    return (
        <div className="grid gap-6 h-[calc(100vh-100px)] grid-rows-[auto_1fr]">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Studio</h1>
                        <p className="text-xs text-muted-foreground">Ai-Powered Video Production</p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex items-center p-1 bg-muted rounded-lg border">
                        <Button
                            variant={mode === 'draft' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setMode('draft')}
                            className="text-xs h-7 transition-all"
                        >
                            Quick Draft
                        </Button>
                        <Button
                            variant={mode === 'storyboard' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setMode('storyboard')}
                            className="text-xs h-7 transition-all"
                        >
                            Storyboard
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-muted px-3 py-1 text-sm flex items-center gap-2 border">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="font-bold">{totalCredits} Credits</span>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-12 lg:grid-cols-12 h-full overflow-hidden">
                {/* Left Sidebar: Ingredients & Tools (Persists across modes) */}
                <div className="col-span-12 md:col-span-3 space-y-4 overflow-y-auto pr-2 pb-10">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Model & Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Resolution</Label>
                                <div className="flex items-center space-x-2">
                                    <Switch checked={is4k} onCheckedChange={setIs4k} id="res-mode" />
                                    <Label htmlFor="res-mode" className="text-xs">{is4k ? '4K (Ultra)' : '720p (HD)'}</Label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">Active Model</Label>
                                <div className="text-xs font-medium p-2 bg-muted rounded border">
                                    {selectedModel.name}
                                </div>
                                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setActiveTab("models")}>
                                    Change Model
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Ingredients only relevant for Storyboard usually, but anchors can help drafts too ideally. Keeping for both for now. */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Global Style (Anchor)</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs">Art Direction / Style Prompt</Label>
                                <Input
                                    placeholder="e.g. Cinematic lighting, teal and orange..."
                                    value={anchorStyle}
                                    onChange={(e) => setAnchorStyle(e.target.value)}
                                    className="text-xs"
                                />
                            </div>
                            <div className="border-2 border-dashed rounded-md p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer">
                                <div className="text-xs text-muted-foreground flex flex-col items-center gap-2">
                                    <Layers className="w-6 h-6" />
                                    <span>Upload Anchor Image</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Content Area */}
                <div className="col-span-12 md:col-span-9 flex flex-col gap-4 h-full overflow-hidden">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <TabsList>
                                <TabsTrigger value="storyboard" className="gap-2">
                                    <Film className="w-4 h-4" />
                                    {mode === 'draft' ? 'Active Prompt' : 'Timeline'}
                                </TabsTrigger>
                                <TabsTrigger value="models" className="gap-2"><SettingsIcon className="w-4 h-4" /> Registry</TabsTrigger>
                            </TabsList>

                            <Button onClick={handleGenerate} disabled={loading}>
                                {loading ? "Generating..." : (
                                    <>
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        {mode === 'draft' ? 'Generate Draft' : 'Render All Shots'}
                                    </>
                                )}
                            </Button>
                        </div>

                        <TabsContent value="storyboard" className="flex-grow overflow-y-auto pb-20 pr-2">
                            {mode === 'draft' ? (
                                // Quick Draft View
                                <div className="max-w-2xl mx-auto mt-10 space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-lg">What do you want to create?</Label>
                                        <Textarea
                                            placeholder="Describe your video idea in detail..."
                                            className="h-40 text-base"
                                            value={prompt}
                                            onChange={(e) => setPrompt(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-4 p-4 bg-muted/50 rounded-lg border border-dashed">
                                        <div className="flex-1 text-sm text-muted-foreground">
                                            <p className="font-semibold text-foreground mb-1">Quick Draft Mode</p>
                                            Generates a single 5s clip using the selected model. Great for testing ideas quickly.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Storyboard Mode - Vertical Timeline
                                <div className="space-y-4 max-w-3xl mx-auto">
                                    {shots.map((shot, idx) => (
                                        <div key={shot.id} className="flex gap-4 relative">
                                            {/* Timeline Connector */}
                                            {idx !== shots.length - 1 && (
                                                <div className="absolute left-[19px] top-10 bottom-[-20px] w-0.5 bg-border -z-10" />
                                            )}

                                            {/* Index Bubble */}
                                            <div className="flex flex-col items-center pt-2">
                                                <div className="w-10 h-10 rounded-full bg-muted border flex items-center justify-center font-bold text-sm shrink-0">
                                                    {idx + 1}
                                                </div>
                                            </div>

                                            {/* Shot Panel */}
                                            <div className="flex-grow">
                                                <StoryboardPanel
                                                    index={idx}
                                                    shot={shot}
                                                    onUpdate={updateShot}
                                                    onRemove={removeShot}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    <div className="pl-14">
                                        <Button variant="outline" onClick={addShot} className="w-full border-dashed h-12">
                                            <Plus className="w-4 h-4 mr-2" /> Add Next Shot
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="models" className="overflow-y-auto h-full pb-20">
                            <ModelSelector
                                selectedModelId={selectedModelId}
                                onSelect={(id) => { setSelectedModelId(id); setActiveTab("storyboard"); }}
                                duration={5}
                                is4k={is4k}
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}

function SettingsIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}
