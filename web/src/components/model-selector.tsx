"use client"

import { useState } from "react"
import { MODELS, CATEGORIES, ModelCategory, calculateCredits } from "@/lib/models"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Info, Sparkles, Zap, Film, ShoppingBag, Lock } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SubscriptionTier } from "@/lib/tier-config"

export interface ModelSelectorProps {
    selectedModelId: string
    onSelect: (id: string) => void
    duration: number
    is4k: boolean
    compact?: boolean
    userTier?: SubscriptionTier
}

export function ModelSelector({ selectedModelId, onSelect, duration, is4k, compact = false, userTier = 'starter' }: ModelSelectorProps) {
    const [activeCategory, setActiveCategory] = useState<ModelCategory>('Cinema')

    const isEngineLocked = (modelId: string) => {
        const model = MODELS.find(m => m.id === modelId)
        if (!model) return true
        if (model.requiresTier === 'starter') return false
        if (model.requiresTier === 'pro' && (userTier === 'pro' || userTier === 'high_octane')) return false
        if (model.requiresTier === 'high_octane' && userTier === 'high_octane') return false
        return true
    }

    const getTierLabel = (tier: SubscriptionTier): string => {
        switch (tier) {
            case 'high_octane': return 'High-Octane'
            case 'pro': return 'Pro'
            default: return ''
        }
    }

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
                    {MODELS.map((model) => {
                        const locked = isEngineLocked(model.id)
                        return (
                            <div
                                key={model.id}
                                onClick={() => {
                                    if (!locked) onSelect(model.id)
                                }}
                                className={cn(
                                    "group relative overflow-hidden rounded-xl border transition-all duration-300",
                                    locked
                                        ? 'border-white/5 bg-zinc-900/20 opacity-60 cursor-not-allowed'
                                        : 'cursor-pointer',
                                    !locked && selectedModelId === model.id
                                        ? 'border-primary/50 ring-1 ring-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                                        : !locked ? 'border-white/5 bg-zinc-900/40 hover:border-white/20 hover:bg-zinc-800/60' : ''
                                )}
                            >
                                {/* Holographic Gradient Overlay */}
                                <div className={cn(
                                    "absolute inset-0 opacity-0 transition-opacity duration-500 pointer-events-none",
                                    !locked && selectedModelId === model.id ? "opacity-20 bg-gradient-to-br from-primary via-purple-500 to-transparent" : "group-hover:opacity-10 bg-gradient-to-br from-white via-transparent to-transparent"
                                )} />

                                <div className="p-3 relative z-10">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-xs font-bold tracking-wide transition-colors",
                                                locked ? "text-zinc-600" :
                                                    selectedModelId === model.id ? "text-primary text-gradient" : "text-zinc-400 group-hover:text-zinc-200"
                                            )}>
                                                {model.name}
                                            </span>
                                            {locked && (
                                                <div className="flex items-center gap-1">
                                                    <Lock className="w-3 h-3 text-amber-500" />
                                                    <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500">
                                                        {getTierLabel(model.requiresTier)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {!locked && selectedModelId === model.id && (
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
                                            {model.userCredits} CR
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
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
                            {MODELS.filter(m => m.category === category).map(model => {
                                const locked = isEngineLocked(model.id)
                                return (
                                    <div key={model.id} className={locked ? 'opacity-60' : ''}>
                                        <RadioGroupItem value={model.id} id={model.id} className="peer sr-only" disabled={locked} />
                                        <Label
                                            htmlFor={model.id}
                                            className={cn(
                                                "flex flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary h-full transition-all",
                                                locked ? "cursor-not-allowed" : "cursor-pointer"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-semibold text-lg">{model.name}</div>
                                                    {locked && <Lock className="w-4 h-4 text-amber-500" />}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {locked && (
                                                        <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                                                            {getTierLabel(model.requiresTier)} Only
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className={cn("text-xs font-normal", getTierColor(model.tier))}>
                                                        {model.tier}
                                                    </Badge>
                                                </div>
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
                                                    {model.userCredits} CR per generation
                                                </div>
                                            </div>
                                        </Label>
                                    </div>
                                )
                            })}
                        </RadioGroup>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    )
}
