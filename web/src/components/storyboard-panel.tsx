"use client"

import { useState, useRef, useEffect } from "react"
import { Shot } from "@/lib/types"
import { MODELS } from "@/lib/models"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Trash2, Image as ImageIcon, Video, Move, Pencil, X, Upload, Loader2, User } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { MotionBrush } from "@/components/motion-brush"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CameraControls } from "@/components/camera-controls"
import { LivePreview } from "@/components/live-preview"
import { createClient } from "@/lib/supabase/client"

interface StoryboardPanelProps {
    shot: Shot
    index: number
    selectedModelId: string
    onUpdate: (id: string, updates: Partial<Shot>) => void
    onRemove: (id: string) => void
}

export function StoryboardPanel({ shot, index, selectedModelId, onUpdate, onRemove }: StoryboardPanelProps) {
    const [isMotionBrushOpen, setIsMotionBrushOpen] = useState(false)
    const selectedModel = MODELS.find(m => m.id === selectedModelId) || MODELS[0]
    const durations = selectedModel.supportedDurations

    // Auto-set duration to first supported value if current isn't supported
    useEffect(() => {
        if (!durations.includes(shot.duration)) {
            onUpdate(shot.id, { duration: durations[0] })
        }
    }, [selectedModelId])

    const handleCameraChange = (vals: any) => {
        onUpdate(shot.id, { cameraControls: vals })
    }

    const handleSaveMotion = (dataUrl: string) => {
        onUpdate(shot.id, { motionSketch: dataUrl })
        setIsMotionBrushOpen(false)
    }

    // ... (inside component)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const identityInputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [isUploadingIdentity, setIsUploadingIdentity] = useState(false)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `motion_refs/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('raw_assets')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: signedData, error: signError } = await supabase.storage
                .from('raw_assets')
                .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 year

            if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to get signed URL')

            onUpdate(shot.id, { motionVideoRef: signedData.signedUrl })
        } catch (error) {
            console.error('Error uploading motion ref:', error)
            alert('Failed to upload video')
        } finally {
            setIsUploading(false)
        }
    }

    const handleMotionVideoUpload = () => {
        fileInputRef.current?.click()
    }

    const handleIdentityImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploadingIdentity(true)
        try {
            const supabase = createClient()
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `identity_refs/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('raw_assets')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: signedData, error: signError } = await supabase.storage
                .from('raw_assets')
                .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 year

            if (signError || !signedData?.signedUrl) throw signError || new Error('Failed to get signed URL')

            onUpdate(shot.id, { identityRef: signedData.signedUrl })
        } catch (error) {
            console.error('Error uploading identity ref:', error)
            alert('Failed to upload image')
        } finally {
            setIsUploadingIdentity(false)
        }
    }

    return (
        <Card className="relative group bg-[#1E1E1E] border-white/5 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:-translate-y-1 overflow-hidden">
            {/* 3D Depth Border Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-primary transition-colors" />
                    Shot {index + 1}
                </CardTitle>
                <div className="flex items-center gap-2">
                    {/* Live Status Indicators */}
                    <div className="flex gap-1" title="AI Verification">
                        <div className={`w-1.5 h-1.5 rounded-full ${shot.prompt ? 'bg-green-500/50' : 'bg-red-500/50'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${shot.motionSketch ? 'bg-blue-500/50' : 'bg-zinc-800'}`} />
                        <div className={`w-1.5 h-1.5 rounded-full ${shot.identityRef ? 'bg-purple-500/50' : 'bg-zinc-800'}`} title="Identity Ref" />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        onClick={() => onRemove(shot.id)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-1">
                <Tabs defaultValue="visuals" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-black/20 h-7 p-0.5 mb-2">
                        <TabsTrigger value="visuals" className="text-[10px] h-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200">Visuals</TabsTrigger>
                        <TabsTrigger value="director" className="text-[10px] h-6 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-200">Director</TabsTrigger>
                    </TabsList>

                    <TabsContent value="visuals" className="space-y-4">
                        {/* Visual Prompt */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor={`prompt-${shot.id}`} className="text-[10px] uppercase font-bold text-zinc-600">Visuals</Label>
                                <Textarea
                                    id={`prompt-${shot.id}`}
                                    placeholder="Cybernetic forest..."
                                    className="resize-none h-14 text-xs bg-black/40 border-white/5 focus:border-primary/50 focus:bg-black/60 transition-all font-light"
                                    value={shot.prompt}
                                    onChange={(e) => onUpdate(shot.id, { prompt: e.target.value })}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor={`action-${shot.id}`} className="text-[10px] uppercase font-bold text-zinc-600">Action</Label>
                                <Textarea
                                    id={`action-${shot.id}`}
                                    placeholder="Robot walking..."
                                    className="resize-none h-14 text-xs bg-black/40 border-white/5 focus:border-primary/50 focus:bg-black/60 transition-all font-light"
                                    value={shot.action || ""}
                                    onChange={(e) => onUpdate(shot.id, { action: e.target.value })}
                                />
                            </div>

                            {/* Live Preview */}
                            <div className="space-y-1.5 pt-2">
                                <Label className="text-[10px] uppercase font-bold text-zinc-600">Live Preview</Label>
                                <LivePreview shot={shot} />
                            </div>
                        </div>

                        {/* Duration */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-zinc-600 flex items-center gap-1">
                                <Video className="w-3 h-3" /> Time (s)
                                {durations.length === 1 && <span className="text-zinc-700 normal-case font-normal ml-1">— fixed</span>}
                            </Label>
                            <Select
                                value={shot.duration.toString()}
                                onValueChange={(v) => onUpdate(shot.id, { duration: parseInt(v) })}
                                disabled={durations.length === 1}
                            >
                                <SelectTrigger className="h-8 text-xs text-zinc-200 bg-zinc-800/50 border-white/5 hover:border-white/10 hover:bg-zinc-800">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10 text-zinc-200">
                                    {durations.map(d => (
                                        <SelectItem key={d} value={d.toString()} className="text-zinc-200 focus:bg-zinc-800 focus:text-white">{d}s</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </TabsContent>

                    <TabsContent value="director" className="space-y-4 animate-in slide-in-from-right-2 duration-300">
                        {/* Camera Controls */}
                        <CameraControls
                            values={shot.cameraControls || { pan: { x: 0, y: 0 }, zoom: 0, tilt: 0, roll: 0 }}
                            onChange={handleCameraChange}
                        />

                        {/* Identity Reference Image */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-zinc-600 flex items-center gap-1">
                                <User className="w-3 h-3" /> Identity Reference
                            </Label>
                            <input
                                type="file"
                                ref={identityInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleIdentityImageChange}
                            />
                            <div
                                onClick={() => identityInputRef.current?.click()}
                                className={cn(
                                    "h-20 border border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all group/identity relative overflow-hidden",
                                    isUploadingIdentity ? "opacity-50 pointer-events-none" : "hover:bg-zinc-800/50 hover:border-zinc-500"
                                )}
                            >
                                {isUploadingIdentity && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    </div>
                                )}
                                {shot.identityRef ? (
                                    <div className="flex items-center gap-3 px-3">
                                        <img
                                            src={shot.identityRef}
                                            alt="Identity ref"
                                            className="w-12 h-12 rounded-lg object-cover border border-zinc-700"
                                        />
                                        <div className="flex-1">
                                            <span className="text-[10px] font-mono text-green-500">Identity Added</span>
                                            <p className="text-[9px] text-zinc-600 mt-0.5">Character reference for consistency</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 hover:bg-red-500/20 hover:text-red-400"
                                            onClick={(e) => { e.stopPropagation(); onUpdate(shot.id, { identityRef: undefined }) }}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <User className="w-4 h-4 text-zinc-500 group-hover/identity:text-zinc-300 mb-1" />
                                        <span className="text-[9px] text-zinc-600 group-hover/identity:text-zinc-400">Upload Identity Image</span>
                                        <span className="text-[8px] text-zinc-700">Face / character reference</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Motion Driving Video */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-zinc-600">Motion Driver</Label>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="video/*"
                                onChange={handleFileChange}
                            />
                            <div
                                onClick={handleMotionVideoUpload}
                                className={cn(
                                    "h-16 border border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all group/upload relative overflow-hidden",
                                    isUploading ? "opacity-50 pointer-events-none" : "hover:bg-zinc-800/50 hover:border-zinc-500"
                                )}
                            >
                                {isUploading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    </div>
                                )}
                                {shot.motionVideoRef ? (
                                    <div className="flex items-center gap-2 text-green-500">
                                        <Video className="w-4 h-4" />
                                        <span className="text-[10px] font-mono">Reference Added</span>
                                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-2 hover:bg-red-500/20 hover:text-red-400" onClick={(e) => { e.stopPropagation(); onUpdate(shot.id, { motionVideoRef: undefined }) }}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 text-zinc-500 group-hover/upload:text-zinc-300 mb-1" />
                                        <span className="text-[9px] text-zinc-600 group-hover/upload:text-zinc-400">Upload Video Ref</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Motion Brush Trigger */}
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-bold text-zinc-600">Motion Path</Label>
                            <div className="flex gap-2">
                                <Dialog open={isMotionBrushOpen} onOpenChange={setIsMotionBrushOpen}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant={shot.motionSketch ? "secondary" : "outline"}
                                            size="sm"
                                            className={cn(
                                                "w-full text-[10px] h-8 border-dashed transition-colors",
                                                shot.motionSketch
                                                    ? "bg-primary/20 border-primary text-primary"
                                                    : "bg-transparent border-zinc-700 hover:border-primary/50 hover:text-primary"
                                            )}
                                        >
                                            <Pencil className="w-3 h-3 mr-2" />
                                            {shot.motionSketch ? "Edit Motion Path" : "Draw Motion Path"}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-[425px] bg-zinc-950 border-white/10">
                                        <DialogHeader>
                                            <DialogTitle className="text-zinc-200">Draw Motion Path</DialogTitle>
                                        </DialogHeader>
                                        <div className="py-4 flex justify-center">
                                            <MotionBrush
                                                onSave={handleSaveMotion}
                                                initialData={shot.motionSketch}
                                            />
                                        </div>
                                    </DialogContent>
                                </Dialog>
                                {shot.motionSketch && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-500 hover:text-red-400"
                                        onClick={() => onUpdate(shot.id, { motionSketch: undefined })}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    )
}
