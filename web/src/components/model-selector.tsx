"use client"

import { useState } from "react"
import { MODELS, CATEGORIES, ModelCategory, calculateCredits } from "@/lib/models"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Info, Sparkles, Zap, Film, ShoppingBag } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

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
            <div className="space-y-2">
                {MODELS.map((model) => (
                    <div
                        key={model.id}
                        onClick={() => onSelect(model.id)}
                        className={cn(
                            "p-2 rounded-md border cursor-pointer transition-all flex flex-col gap-1",
                            selectedModelId === model.id
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-card border-border/50 hover:bg-accent/50'
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">{model.name}</span>
                            {selectedModelId === model.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{model.tier}</Badge>
                            <span className="text-[10px] font-mono text-muted-foreground">
                                {calculateCredits(model.baseCredits, duration, is4k)} cr
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <Tabs defaultValue="Cinema" onValueChange={(v: string) => setActiveCategory(v as ModelCategory)}>
                <TabsList className="grid w-full grid-cols-4">
                    {CATEGORIES.map(cat => (
                        <TabsTrigger key={cat} value={cat} className="flex gap-2">
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
                                        className="flex flex-col justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer h-full"
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

                                        <div className="flex justify-between items-center text-xs text-muted-foreground pt-4 border-t">
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
