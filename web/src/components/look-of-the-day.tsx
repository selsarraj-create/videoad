"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Shirt, Briefcase } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface LOTDProps {
    trend: {
        id: string
        retail_item: {
            title: string
            price: string
            image_url: string
            brand: string
        }
        vintage_accessory: {
            title: string
            price: string
            image_url: string
        }
        vibe_category: string
        discovery_log: {
            headline: string
            justification: string
        }
    }
    onApplyTrend: (retailUrl: string) => void
}

export const LookOfTheDay: React.FC<LOTDProps> = ({ trend, onApplyTrend }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-white border border-nimbus p-6 space-y-6 shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden"
        >
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />

            <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[8px] uppercase tracking-widest px-2">
                            {trend.vibe_category}
                        </Badge>
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold font-sans">Look of the day</span>
                    </div>
                    <h3 className="text-xl font-serif italic text-foreground leading-tight">
                        {trend.discovery_log.headline}
                    </h3>
                </div>
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-4 relative z-10">
                {/* Retail Item */}
                <div className="space-y-3">
                    <div className="aspect-[3/4] bg-nimbus/5 border border-nimbus/50 p-2 overflow-hidden">
                        <img
                            src={trend.retail_item.image_url}
                            alt={trend.retail_item.title}
                            className="w-full h-full object-contain grayscale hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-105"
                        />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1">
                            <Shirt className="w-2 h-2" /> {trend.retail_item.brand}
                        </p>
                        <p className="text-xs font-serif italic line-clamp-1">{trend.retail_item.title}</p>
                    </div>
                </div>

                {/* Vintage Accessory */}
                <div className="space-y-3">
                    <div className="aspect-[3/4] bg-nimbus/5 border border-nimbus/50 p-2 overflow-hidden">
                        <img
                            src={trend.vintage_accessory.image_url}
                            alt={trend.vintage_accessory.title}
                            className="w-full h-full object-contain grayscale hover:grayscale-0 transition-all duration-700 scale-100 group-hover:scale-105"
                        />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1">
                            <Briefcase className="w-2 h-2" /> Vintage Rare
                        </p>
                        <p className="text-xs font-serif italic line-clamp-1">{trend.vintage_accessory.title}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                <p className="text-[10px] text-muted-foreground leading-relaxed font-sans border-l-2 border-nimbus pl-3 italic">
                    "{trend.discovery_log.justification}"
                </p>

                <Button
                    onClick={() => onApplyTrend(trend.retail_item.image_url)}
                    className="w-full h-12 bg-foreground text-background hover:bg-primary transition-all rounded-none text-[10px] uppercase tracking-[0.2em] font-bold group/btn"
                >
                    Apply Trend to Persona <ArrowRight className="w-3 h-3 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                </Button>
            </div>
        </motion.div>
    )
}
