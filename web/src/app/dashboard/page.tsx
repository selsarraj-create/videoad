"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { VideoJob } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Wand2, Play, AlertCircle, CheckCircle2, Clock, Zap } from "lucide-react"
import { ModelSelector } from "@/components/model-selector"
import { MODELS, calculateCredits } from "@/lib/models"

export default function StudioPage() {
    const [jobs, setJobs] = useState<VideoJob[]>([])
    const [prompt, setPrompt] = useState("")
    const [selectedModelId, setSelectedModelId] = useState<string>("veo-3.1-fast")
    // Derive tier and model details from selected ID
    const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0]

    // Duration/Resolution state
    const [duration, setDuration] = useState<number>(5)
    const [is4k, setIs4k] = useState<boolean>(false)

    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Calculate estimated credits
    const estimatedCredits = calculateCredits(selectedModel.baseCredits, duration, is4k)

    // Mock data for initial render
    useEffect(() => {
        // ... (keep existing mock data logic or fetch) ...
        setJobs([
            {
                id: "1",
                project_id: "def",
                status: "completed",
                input_params: { prompt: "Cinematic drone shot of a luxury villa" },
                model: "veo-3.1-fast",
                tier: "draft",
                output_url: "#",
                created_at: new Date().toISOString()
            },
        ] as VideoJob[])

        // ... (keep subscription logic) ...
        const channel = supabase
            .channel('realtime-jobs')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, payload => {
                console.log('Change received!', payload)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase])

    const handleGenerate = async () => {
        if (!prompt) return
        setLoading(true)

        // 1. Insert job into Supabase (mock)
        const newJob: VideoJob = {
            id: Math.random().toString(),
            project_id: "def",
            status: "pending",
            input_params: { prompt, duration },
            model: selectedModel.id as any,
            tier: selectedModel.tier === 'Premium' ? 'production' : 'draft', // Map credit tier to system tier
            created_at: new Date().toISOString()
        }

        setJobs([newJob, ...jobs])
        setPrompt("")

        // 2. Trigger webhook/backend
        try {
            await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: selectedModel.id,
                    tier: selectedModel.tier === 'Premium' ? 'production' : 'draft',
                    provider_metadata: {
                        credits_cost: estimatedCredits,
                        resolution: is4k ? '4k' : '720p',
                        duration: duration
                    },
                    workspace_id: "def"
                })
            })
        } catch (e) {
            console.error(e)
        }

        setTimeout(() => {
            setLoading(false)
        }, 1000)
    }

    const getStatusIcon = (status: string) => {
        // ... (keep existing icon logic) ...
        switch (status) {
            case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />
            case 'processing': return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
            case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />
            default: return <Clock className="h-4 w-4 text-gray-500" />
        }
    }

    return (
        <div className="grid gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create New Ad</CardTitle>
                            <CardDescription>
                                Select a model from the registry and customize your video.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            <ModelSelector
                                selectedModelId={selectedModelId}
                                onSelect={setSelectedModelId}
                                duration={duration}
                                is4k={is4k}
                            />

                            <div className="space-y-2">
                                <Label htmlFor="prompt">Prompt</Label>
                                <Input
                                    id="prompt"
                                    placeholder="Describe your video..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Duration</Label>
                                    <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5s (Base)</SelectItem>
                                            <SelectItem value="10">10s (2x)</SelectItem>
                                            <SelectItem value="25">25s (3x)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Resolution</Label>
                                    <div className="flex items-center space-x-2 pt-2">
                                        <Switch checked={is4k} onCheckedChange={setIs4k} id="res-mode" />
                                        <Label htmlFor="res-mode">{is4k ? '4K (Ultra)' : '720p (HD)'}</Label>
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Cost Display */}
                            <div className="rounded-lg bg-muted p-3 flex justify-between items-center text-sm">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> Estimated Impact:
                                </span>
                                <span className="font-bold">{estimatedCredits} Credits</span>
                            </div>

                            {selectedModel.category === 'Production' && (
                                <div className="space-y-2 rounded-md border border-dashed p-4">
                                    <Label>Motion Control (Reference Video)</Label>
                                    <Input type="file" accept="video/*" />
                                    <p className="text-xs text-muted-foreground">Upload a video to guide the motion.</p>
                                </div>
                            )}

                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleGenerate} disabled={loading} className="w-full">
                                {loading ? "Scouting..." : (
                                    <>
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        Generate with {selectedModel.provider}
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="col-span-4">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Recent Jobs</CardTitle>
                            <CardDescription>
                                Track the status of your video generation jobs.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {jobs.map((job) => (
                                    <div key={job.id} className="flex items-center justify-between rounded-lg border p-4">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium truncate max-w-[200px]">{job.input_params.prompt}</span>
                                            <div className="flex gap-2">
                                                <Badge variant="outline" className="text-xs">{job.model}</Badge>
                                                {job.tier === 'production' && <Badge className="text-xs bg-purple-500 hover:bg-purple-600">Pro</Badge>}
                                                <span className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="capitalize flex gap-2">
                                                {getStatusIcon(job.status)}
                                                {job.status}
                                            </Badge>
                                            {job.status === 'processing' && (
                                                <div className="w-24">
                                                    <Progress value={45} className="h-2" />
                                                </div>
                                            )}
                                            {job.status === 'completed' && job.output_url && (
                                                <Button size="sm" variant="ghost" asChild>
                                                    <a href={job.output_url} target="_blank">
                                                        <Play className="h-4 w-4" />
                                                    </a>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
