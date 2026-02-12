"use client"

import { useState } from "react"
import { Shot } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Trash2, Image as ImageIcon, Video, Move, Pencil, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { MotionBrush } from "@/components/motion-brush"

interface StoryboardPanelProps {
    shot: Shot
    index: number
    onUpdate: (id: string, updates: Partial<Shot>) => void
    onRemove: (id: string) => void
}

export function StoryboardPanel({ shot, index, onUpdate, onRemove }: StoryboardPanelProps) {
    const [isMotionBrushOpen, setIsMotionBrushOpen] = useState(false)

    const handleSaveMotion = (dataUrl: string) => {
        onUpdate(shot.id, { motionSketch: dataUrl })
        setIsMotionBrushOpen(false)
    }

    return (
        <Card className="relative group bg-zinc-900/80 border-white/5 backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:-translate-y-1 overflow-hidden">
            {/* 3D Depth Border Bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <CardHeader className="pb-2 pt-3 px-4 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-primary transition-colors" />
                    Shot {index + 1}
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    onClick={() => onRemove(shot.id)}
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-1">
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
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    {/* Camera Move */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-zinc-600 flex items-center gap-1">
                            <Move className="w-3 h-3" /> Cam
                        </Label>
                        <Select
                            value={shot.cameraMove || 'static'}
                            onValueChange={(v: any) => onUpdate(shot.id, { cameraMove: v })}
                        >
                            <SelectTrigger className="h-8 text-xs bg-zinc-800/50 border-white/5 hover:border-white/10 hover:bg-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="pan_left">Pan Left</SelectItem>
                                <SelectItem value="pan_right">Pan Right</SelectItem>
                                <SelectItem value="zoom_in">Zoom In</SelectItem>
                                <SelectItem value="zoom_out">Zoom Out</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-zinc-600 flex items-center gap-1">
                            <Video className="w-3 h-3" /> Time
                        </Label>
                        <Select
                            value={shot.duration.toString()}
                            onValueChange={(v) => onUpdate(shot.id, { duration: parseInt(v) })}
                        >
                            <SelectTrigger className="h-8 text-xs bg-zinc-800/50 border-white/5 hover:border-white/10 hover:bg-zinc-800">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-white/10">
                                <SelectItem value="3">3s</SelectItem>
                                <SelectItem value="5">5s</SelectItem>
                                <SelectItem value="8">8s</SelectItem>
                                <SelectItem value="10">10s</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Motion Brush / Image Ref */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
                    <Button variant="outline" size="sm" className="w-full text-[10px] h-7 bg-transparent border-dashed border-zinc-700 hover:border-primary/50 hover:text-primary transition-colors">
                        <ImageIcon className="w-3 h-3 mr-2" /> Ref
                    </Button>

                    <Dialog open={isMotionBrushOpen} onOpenChange={setIsMotionBrushOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant={shot.motionSketch ? "secondary" : "outline"}
                                size="sm"
                                className={cn(
                                    "w-full text-[10px] h-7 border-dashed transition-colors",
                                    shot.motionSketch
                                        ? "bg-primary/20 border-primary text-primary"
                                        : "bg-transparent border-zinc-700 hover:border-primary/50 hover:text-primary"
                                )}
                            >
                                <Pencil className="w-3 h-3 mr-2" />
                                {shot.motionSketch ? "Active" : "Motion"}
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
                </div>

                {shot.motionSketch && (
                    <div className="relative border border-primary/30 rounded overflow-hidden h-8 w-full bg-primary/5 flex items-center justify-center group/preview">
                        <span className="text-[9px] text-primary/70 font-mono">Motion Data</span>
                        <img src={shot.motionSketch} alt="motion" className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-screen" />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full w-8 text-primary hover:bg-primary/20 hover:text-primary-foreground opacity-0 group-hover/preview:opacity-100 transition-all rounded-none"
                            onClick={() => onUpdate(shot.id, { motionSketch: undefined })}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    </div>
                )}

            </CardContent>
        </Card>
    )
}
