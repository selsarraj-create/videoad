"use client"

import { useState } from "react"
import { Shot } from "@/lib/types"
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
        <Card className="relative group hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Shot {index + 1}
                    </CardTitle>
                    <div className="flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onRemove(shot.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Visual Prompt */}
                <div className="space-y-1">
                    <Label htmlFor={`prompt-${shot.id}`} className="text-xs">Visual Description</Label>
                    <Textarea
                        id={`prompt-${shot.id}`}
                        placeholder="Describe the action..."
                        className="resize-none h-20 text-sm"
                        value={shot.prompt}
                        onChange={(e) => onUpdate(shot.id, { prompt: e.target.value })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {/* Camera Move */}
                    <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                            <Move className="w-3 h-3" /> Camera
                        </Label>
                        <Select
                            value={shot.cameraMove || 'static'}
                            onValueChange={(v: any) => onUpdate(shot.id, { cameraMove: v })}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="pan_left">Pan Left</SelectItem>
                                <SelectItem value="pan_right">Pan Right</SelectItem>
                                <SelectItem value="zoom_in">Zoom In</SelectItem>
                                <SelectItem value="zoom_out">Zoom Out</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                            <Video className="w-3 h-3" /> Duration
                        </Label>
                        <Select
                            value={shot.duration.toString()}
                            onValueChange={(v) => onUpdate(shot.id, { duration: parseInt(v) })}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3s</SelectItem>
                                <SelectItem value="5">5s (Std)</SelectItem>
                                <SelectItem value="8">8s</SelectItem>
                                <SelectItem value="10">10s</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Motion Brush / Image Ref */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed">
                    <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-2">
                        <ImageIcon className="w-3 h-3" /> Img Ref
                    </Button>

                    <Dialog open={isMotionBrushOpen} onOpenChange={setIsMotionBrushOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant={shot.motionSketch ? "secondary" : "outline"}
                                size="sm"
                                className="w-full text-xs h-8 gap-2"
                            >
                                <Pencil className="w-3 h-3" />
                                {shot.motionSketch ? "Edit Motion" : "Motion Brush"}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Draw Motion Path</DialogTitle>
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
                    <div className="relative border rounded overflow-hidden h-10 w-full bg-slate-100 flex items-center justify-center group/preview">
                        <span className="text-[10px] text-muted-foreground">Motion Sketch Active</span>
                        <img src={shot.motionSketch} alt="motion" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                        <Button
                            variant="destructive"
                            size="icon"
                            className="absolute right-1 top-1 h-4 w-4 opacity-0 group-hover/preview:opacity-100 transition-opacity"
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
