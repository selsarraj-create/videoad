"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, RefreshCw, User, ShoppingBag, Sparkles, ShieldCheck, Play, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { createClient } from '@/lib/supabase/client'
import { generateCompositeId, appendTrackingToUrl } from '@/lib/viral-link-generator'

interface ShowcaseItem {
    id: string
    signed_video_url: string | null
    thumbnail_url?: string | null
    user_id: string
    hearts: number
    garment_metadata: any[]
    ai_labeled: boolean
    created_at: string
    allow_remix: boolean
    original_creator_id?: string | null
}

interface FeedResponse {
    data: ShowcaseItem[]
    nextCursor: string | null
}

// ── Video Card (Thumbnail → Lazy Video) ──────────────────────────────────────

function VideoCard({ item, onLike, onRemix }: {
    item: ShowcaseItem
    onLike: () => void
    onRemix?: (data: any) => void
}) {
    const [playing, setPlaying] = useState(false)
    const videoRef = useRef<HTMLVideoElement>(null)

    const handlePlay = () => {
        if (!item.signed_video_url) return
        setPlaying(true)
    }

    useEffect(() => {
        if (playing && videoRef.current) {
            videoRef.current.play().catch(() => { })
        }
    }, [playing])

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-white border border-nimbus/40 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500"
        >
            {/* Video / Thumbnail */}
            <div className="relative aspect-[9/16] bg-black">
                {playing && item.signed_video_url ? (
                    <video
                        ref={videoRef}
                        src={item.signed_video_url}
                        className="w-full h-full object-cover"
                        loop
                        muted
                        playsInline
                        autoPlay
                    />
                ) : (
                    <div
                        className="w-full h-full cursor-pointer relative"
                        onClick={handlePlay}
                    >
                        {item.thumbnail_url ? (
                            <img
                                src={item.thumbnail_url}
                                alt="Video thumbnail"
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800" />
                        )}
                        {/* Play button overlay */}
                        {item.signed_video_url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Play className="w-7 h-7 text-white ml-1" fill="white" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Bottom gradient overlay */}
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-3 pointer-events-none">
                    <div className="flex items-center justify-between pointer-events-auto">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                                <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-[10px] text-white/80 tracking-widest uppercase truncate max-w-[100px]">Creator</span>
                        </div>
                        <button
                            onClick={onLike}
                            className="flex items-center gap-1.5 px-3 py-1 transparent-glass rounded-full hover:bg-white/20 transition-colors"
                        >
                            <Heart className={`w-3.5 h-3.5 ${item.hearts > 0 ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                            <span className="text-[10px] text-white font-bold">{item.hearts}</span>
                        </button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 pointer-events-auto">
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

                {/* AI compliance badge */}
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
    )
}

// ── Showcase Grid with Infinite Scroll ───────────────────────────────────────

export function ShowcaseGrid({ onRemix }: { onRemix?: (data: any) => void }) {
    const [items, setItems] = useState<ShowcaseItem[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(true)
    const sentinelRef = useRef<HTMLDivElement>(null)
    const supabase = createClient()

    // Fetch a page of items
    const fetchPage = useCallback(async (cursor: string | null, append: boolean) => {
        if (append) {
            setLoadingMore(true)
        } else {
            setLoading(true)
        }

        try {
            const params = new URLSearchParams()
            if (cursor) params.set('cursor', cursor)
            params.set('limit', '10')

            const res = await fetch(`/api/showcase-feed?${params.toString()}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)

            const { data, nextCursor: nc }: FeedResponse = await res.json()

            if (append) {
                setItems(prev => [...prev, ...data])
            } else {
                setItems(data)
            }

            setNextCursor(nc)
            setHasMore(nc !== null)
        } catch (err) {
            console.error('Showcase feed error:', err)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [])

    // Initial load
    useEffect(() => {
        fetchPage(null, false)
    }, [fetchPage])

    // Infinite scroll via IntersectionObserver
    useEffect(() => {
        if (!sentinelRef.current || !hasMore) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !loadingMore && nextCursor) {
                    fetchPage(nextCursor, true)
                }
            },
            { rootMargin: '400px' }
        )

        observer.observe(sentinelRef.current)
        return () => observer.disconnect()
    }, [hasMore, loadingMore, nextCursor, fetchPage])

    // Like handler (optimistic + DB update)
    const handleLike = async (id: string, currentHearts: number) => {
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

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-40 text-center">
                <Sparkles className="w-12 h-12 text-primary/20 mb-4" />
                <h3 className="font-serif text-2xl mb-2">No Showcases Yet</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                    Be the first to publish a look to the community showcase.
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
                <AnimatePresence>
                    {items.map((item) => (
                        <VideoCard
                            key={item.id}
                            item={item}
                            onLike={() => handleLike(item.id, item.hearts)}
                            onRemix={onRemix}
                        />
                    ))}
                </AnimatePresence>
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />

            {loadingMore && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
            )}

            {!hasMore && items.length > 0 && (
                <p className="text-center text-muted-foreground text-xs py-8 tracking-widest uppercase">
                    End of Feed
                </p>
            )}
        </>
    )
}
