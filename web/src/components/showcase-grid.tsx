"use client"

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, RefreshCw, User, ShoppingBag, Sparkles, ShieldCheck } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { createClient } from '@/lib/supabase/client'
import { generateCompositeId, appendTrackingToUrl } from '@/lib/viral-link-generator'

interface ShowcaseItem {
    id: string
    video_url: string
    user_id: string
    hearts: number
    garment_metadata: any[]
    ai_labeled: boolean
    created_at: string
    allow_remix: boolean
    original_creator_id?: string | null
}

export function ShowcaseGrid({ onRemix }: { onRemix?: (data: any) => void }) {
    const [items, setItems] = useState<ShowcaseItem[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        fetchShowcase()
    }, [])

    const fetchShowcase = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('public_showcase')
            .select('*')
            .order('hearts', { ascending: false })
            .limit(20)
        if (data) setItems(data as ShowcaseItem[])
        setLoading(false)
    }

    const handleLike = async (id: string, currentHearts: number) => {
        // Optimistic UI
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, hearts: item.hearts + 1 } : item
        ))

        await supabase
            .from('public_showcase')
            .update({ hearts: currentHearts + 1 })
            .eq('id', id)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            <AnimatePresence>
                {items.map((item, idx) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="group relative bg-white border border-nimbus/40 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500"
                    >
                        {/* Video Feed */}
                        <div className="relative aspect-[9/16] bg-black">
                            <video
                                src={item.video_url}
                                className="w-full h-full object-cover"
                                loop
                                muted
                                playsInline
                                onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                                onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
                            />

                            {/* Overlay info */}
                            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                                            <User className="w-4 h-4 text-white" />
                                        </div>
                                        <span className="text-[10px] text-white/80 tracking-widest uppercase truncate max-w-[100px]">Creator</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleLike(item.id, item.hearts)}
                                            className="flex items-center gap-1.5 px-3 py-1 transparent-glass rounded-full hover:bg-white/20 transition-colors"
                                        >
                                            <Heart className={`w-3.5 h-3.5 ${item.hearts > 0 ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                                            <span className="text-[10px] text-white font-bold">{item.hearts}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2">
                                    {item.allow_remix !== false && (
                                        <Button
                                            onClick={() => onRemix?.(item)}
                                            className="w-full h-10 bg-white text-black hover:bg-foreground hover:text-white border-0 rounded-none text-[10px] uppercase tracking-[0.2em] font-bold"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                            Remix Look
                                        </Button>
                                    )}

                                    {item.garment_metadata?.[0]?.affiliateUrl && (
                                        <Button
                                            onClick={() => {
                                                const compositeId = generateCompositeId({
                                                    userId: item.user_id,
                                                    originalCreatorId: item.original_creator_id
                                                });
                                                const source = item.garment_metadata[0].id?.startsWith('skim') ? 'skimlinks' : 'ebay';
                                                const viralUrl = appendTrackingToUrl(item.garment_metadata[0].affiliateUrl, compositeId, source);
                                                window.open(viralUrl, '_blank');
                                            }}
                                            className="w-full h-10 bg-primary text-white hover:bg-primary/90 border-0 rounded-none text-[10px] uppercase tracking-[0.2em] font-bold shadow-xl"
                                        >
                                            <ShoppingBag className="w-3.5 h-3.5 mr-2" />
                                            Shop This Look
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Compliance Badge */}
                            {item.ai_labeled && (
                                <div className="absolute top-4 left-4">
                                    <Badge className="bg-black/40 backdrop-blur-md border-white/20 text-white/60 rounded-none text-[8px] uppercase tracking-tighter">
                                        <ShieldCheck className="w-3 h-3 mr-1" />
                                        AI Generated
                                    </Badge>
                                </div>
                            )}
                        </div>

                        {/* Garment Preview Bar */}
                        <div className="p-4 bg-white border-t border-nimbus/20 flex items-center justify-between">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest leading-none">Featured Item</span>
                                <span className="text-[11px] font-bold truncate max-w-[180px]">
                                    {item.garment_metadata?.[0]?.title || 'Designer Piece'}
                                </span>
                            </div>
                            <ShoppingBag className="w-4 h-4 text-primary opacity-40" />
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}
