"use client"

import { useState } from "react"
import { MODELS, CATEGORIES, ModelCategory, calculateCredits } from "@/lib/models"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Info, Sparkles, Zap, Film, ShoppingBag } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

export interface ModelSelectorProps {
    selectedModelId: string
    onSelect: (id: string) => void
    duration: number
    is4k: boolean
    compact?: boolean
}

export function ModelSelector({ selectedModelId, onSelect, duration, is4k, compact = false }: ModelSelectorProps) {
    const [activeCategory, setActiveCategory] = useState<ModelCategory>('Cinema')
    const activeTier = MODELS.find(m => m.id === selectedModelId)?.tier || 'production'

    const getCategoryIcon = (cat: ModelCategory) => {
        switch (cat) {
            case 'Cinema': return <Film className="w-4 h-4" />
            case 'Social': return <Zap className="w-4 h-4" />
            case 'Production': return <Sparkles className="w-4 h-4" />
            case 'Product': return <ShoppingBag className="w-4 h-4" />
        }
    }

    const getTierColor = (tier: string) => {
        switch (tier) {
            case 'Eco': return "bg-green-100 text-green-800 border-green-200"
            case 'Standard': return "bg-blue-100 text-blue-800 border-blue-200"
            case 'Premium': return "bg-amber-100 text-amber-800 border-amber-200"
            default: return "bg-gray-100 text-gray-800"
        }
    }

    if (compact) {
        return (
            <ScrollArea className="h-[400px] pr-4 -mr-4">
                <div className="space-y-3">
                    {MODELS.map((model) => (
                        <div
                            key={model.id}
                            onClick={() => onSelect(model.id)}
                            className={cn(
                                "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                                selectedModelId === model.id
                                    ? 'border-primary/50 ring-1 ring-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                    : 'border-white/5 bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-800/60'
                            )}
                        >
                            {/* Holographic Gradient Overlay */}
                            <div className={cn(
                                "absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none",
                                selectedModelId === model.id ? "opacity-20 bg-gradient-to-br from-primary via-purple-500 to-transparent" : "group-hover:opacity-10 bg-gradient-to-br from-white via-transparent to-transparent"
                            )} />

                            <div className="p-3 relative z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "text-xs font-bold tracking-wide transition-colors",
                                        selectedModelId === model.id ? "text-primary text-gradient" : "text-zinc-400 group-hover:text-zinc-200"
                                    )}>
                                        {model.name}
                                    </span>
                                    {selectedModelId === model.id && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_currentColor] animate-pulse" />
                                    )}
                                </div>

                                <p className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed mb-3 group-hover:text-zinc-400 transition-colors">
                                    {model.description}
                                </p>

                                <div className="flex items-center justify-between">
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] h-4 px-1.5 border-0 backdrop-blur-md uppercase tracking-wider font-bold",
                                        model.tier === 'Premium' ? "bg-amber-500/10 text-amber-500" :
                                            model.tier === 'Standard' ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
                                    )}>
                                        {model.tier}
                                    </Badge>
                                    <span className="text-[9px] font-mono text-zinc-600 group-hover:text-zinc-500">
                                        {calculateCredits(model.baseCredits, duration, is4k)} CR
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        )
    }

    return (
        <div className="space-y-4">
            <Tabs defaultValue="Cinema" onValueChange={(v: string) => setActiveCategory(v as ModelCategory)}>
                <TabsList className="grid w-full grid-cols-4 bg-zinc-900/50">
                    {CATEGORIES.map(cat => (
                        <TabsTrigger key={cat} value={cat} className="flex gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                            {getCategoryIcon(cat)}
                            <span className="hidden sm:inline">{cat}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>

                {CATEGORIES.map(category => (
                    <TabsContent key={category} value={category} className="space-y-4">
                        <RadioGroup value={selectedModelId} onValueChange={onSelect} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {MODELS.filter(m => m.category === category).map(model => (
                                <div key={model.id}>
                                    <RadioGroupItem value={model.id} id={model.id} className="peer sr-only" />
                                    <Label
                                        htmlFor={model.id}
                                        className="flex flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-semibold text-lg">{model.name}</div>
                                            <Badge variant="outline" className={cn("text-xs font-normal", getTierColor(model.tier))}>
                                                {model.tier}
                                            </Badge>
                                        </div>

                                        <p className="text-sm text-muted-foreground mb-4 flex-grow">
                                            {model.description}
                                        </p>

                                        <div className="flex justify-between items-center text-xs text-muted-foreground pt-4 border-t border-border">
                                            <span className="flex items-center gap-1">
                                                {model.provider}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <Zap className="w-3 h-3" />
                                                {calculateCredits(model.baseCredits, duration, is4k)} credits
                                            </div>
                                        </div>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
