"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { VideoJob } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Wand2, Play, AlertCircle, CheckCircle2, Clock } from "lucide-react"

export default function StudioPage() {
    const [jobs, setJobs] = useState<VideoJob[]>([])
    const [prompt, setPrompt] = useState("")
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
                output_url: "#",
                created_at: new Date().toISOString()
            },
            {
                id: "2",
                project_id: "def",
                status: "processing",
                input_params: { prompt: "Cyberpunk street scene with neon lights" },
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
            created_at: new Date().toISOString()
        }

        setJobs([newJob, ...jobs])
        setPrompt("")

        // 2. Trigger webhook/backend (mock)
        // await fetch('/api/generate', { ... })

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
                                Generate a video ad using Veo 3.1. Describe your vision below.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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
                            {/* Ingredients / Image Upload would go here */}
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
                                            <span className="text-xs text-muted-foreground">{new Date(job.created_at).toLocaleTimeString()}</span>
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
                                                <Button size="sm" variant="ghost">
                                                    <Play className="h-4 w-4" />
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
