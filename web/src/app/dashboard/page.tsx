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
import { Wand2, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react"

export default function StudioPage() {
    const [jobs, setJobs] = useState<VideoJob[]>([])
    const [prompt, setPrompt] = useState("")
    const [model, setModel] = useState<"veo-3.1-fast" | "sora-2" | "kling-2.6-quality" | "hailuo-2.3">("veo-3.1-fast")
    const [tier, setTier] = useState<"draft" | "production">("draft")
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Mock data for initial render
    useEffect(() => {
        // In real app: fetch from Supabase
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
            {
                id: "2",
                project_id: "def",
                status: "processing",
                input_params: { prompt: "Cyberpunk street scene with neon lights" },
                model: "kling-2.6-quality",
                tier: "production",
                created_at: new Date().toISOString()
            },
        ] as VideoJob[])

        // Real-time subscription setup
        const channel = supabase
            .channel('realtime-jobs')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, payload => {
                console.log('Change received!', payload)
                // Update local state based on payload
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
            input_params: { prompt },
            model,
            tier,
            created_at: new Date().toISOString()
        }

        setJobs([newJob, ...jobs])
        setPrompt("")

        // 2. Trigger webhook/backend (mock)
        try {
            await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model,
                    tier,
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
                                Generate a video ad. Toggle "Production" for high-fidelity WaveSpeed models.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Production Tier</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Use WaveSpeed Seedance & WAN 2.2 for 4K quality.
                                    </div>
                                </div>
                                <Switch
                                    checked={tier === "production"}
                                    onCheckedChange={(checked) => setTier(checked ? "production" : "draft")}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="model">Model</Label>
                                <Select value={model} onValueChange={(v: any) => setModel(v)}>
                                    <SelectTrigger id="model">
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="veo-3.1-fast">Veo 3.1 Fast</SelectItem>
                                        <SelectItem value="sora-2">Sora 2</SelectItem>
                                        <SelectItem value="kling-2.6-quality">Kling 2.6 Quality</SelectItem>
                                        <SelectItem value="hailuo-2.3">Hailuo 2.3</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="prompt">Prompt</Label>
                                <Input
                                    id="prompt"
                                    placeholder="Describe your video..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Aspect Ratio</Label>
                                <Select defaultValue="16:9">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select aspect ratio" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                                        <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                                        <SelectItem value="1:1">1:1 (Square)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {tier === "production" && (
                                <div className="space-y-2 rounded-md border border-dashed p-4">
                                    <Label>Motion Control (Reference Video)</Label>
                                    <Input type="file" accept="video/*" />
                                    <p className="text-xs text-muted-foreground">Upload a video to guide the motion (e.g., specific walk cycle).</p>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleGenerate} disabled={loading} className="w-full">
                                {loading ? "Submitting..." : (
                                    <>
                                        <Wand2 className="mr-2 h-4 w-4" />
                                        Generate Video
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
