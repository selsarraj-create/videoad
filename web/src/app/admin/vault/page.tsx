"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Package, Upload, Loader2, CheckCircle2, XCircle, Clock,
    Cog, RefreshCcw, Trash2, Filter, ArrowUpFromLine, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "framer-motion"

// ── Types ────────────────────────────────────────────────────────────────────

interface ClothesItem {
    id: string
    name: string
    category: string
    raw_image_url: string
    processed_3d_url: string | null
    glb_url: string | null
    build_status: 'pending' | 'processing' | 'ready' | 'failed'
    error_message: string | null
    created_at: string
    updated_at: string
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'ready' | 'failed'

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
    pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, label: 'Pending' },
    processing: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Cog, label: 'Processing' },
    ready: { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2, label: 'Ready' },
    failed: { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Failed' },
}

const CATEGORIES = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories']

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminVaultPage() {
    const [items, setItems] = useState<ClothesItem[]>([])
    const [filter, setFilter] = useState<StatusFilter>('all')
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({ total: 0, done: 0 })
    const [triggering, setTriggering] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    // ── Fetch Items ───────────────────────────────────────────────────────

    const fetchItems = useCallback(async () => {
        setLoading(true)
        let query = supabase.from('clothes').select('*').order('created_at', { ascending: false })
        if (filter !== 'all') {
            query = query.eq('build_status', filter)
        }
        const { data, error } = await query
        if (error) console.error('Fetch error:', error)
        setItems(data || [])
        setLoading(false)
    }, [filter, supabase])

    useEffect(() => { fetchItems() }, [fetchItems])

    // ── Status Counts ─────────────────────────────────────────────────────

    const [counts, setCounts] = useState({ all: 0, pending: 0, processing: 0, ready: 0, failed: 0 })

    const fetchCounts = useCallback(async () => {
        const { data } = await supabase.from('clothes').select('build_status')
        if (!data) return
        setCounts({
            all: data.length,
            pending: data.filter(d => d.build_status === 'pending').length,
            processing: data.filter(d => d.build_status === 'processing').length,
            ready: data.filter(d => d.build_status === 'ready').length,
            failed: data.filter(d => d.build_status === 'failed').length,
        })
    }, [supabase])

    useEffect(() => { fetchCounts() }, [fetchCounts, items])

    // ── Bulk Upload ───────────────────────────────────────────────────────

    const handleFiles = async (files: FileList | File[]) => {
        const fileArr = Array.from(files).filter(f => f.type.startsWith('image/'))
        if (fileArr.length === 0) return

        setUploading(true)
        setUploadProgress({ total: fileArr.length, done: 0 })

        for (const file of fileArr) {
            try {
                const fileName = `wardrobe-raw/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
                const { error: upErr } = await supabase.storage
                    .from('wardrobe-assets')
                    .upload(fileName, file, { contentType: file.type, upsert: true })

                if (upErr) {
                    // Try raw_assets bucket as fallback
                    await supabase.storage
                        .from('raw_assets')
                        .upload(fileName, file, { contentType: file.type, upsert: true })
                }

                const bucket = upErr ? 'raw_assets' : 'wardrobe-assets'
                const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)

                // Derive name from filename
                const prettyName = file.name
                    .replace(/\.[^.]+$/, '')
                    .replace(/[_-]/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase())

                await supabase.from('clothes').insert({
                    name: prettyName,
                    category: 'tops',
                    raw_image_url: urlData.publicUrl,
                    build_status: 'pending',
                })

                setUploadProgress(prev => ({ ...prev, done: prev.done + 1 }))
            } catch (err) {
                console.error(`Upload failed for ${file.name}:`, err)
            }
        }

        setUploading(false)
        fetchItems()
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        handleFiles(e.dataTransfer.files)
    }

    // ── Process Queue ─────────────────────────────────────────────────────

    const handleProcessQueue = async () => {
        setTriggering(true)
        // Mark all pending items as "processing" to signal Mac Mini
        const { error } = await supabase
            .from('clothes')
            .update({ build_status: 'processing', updated_at: new Date().toISOString() })
            .eq('build_status', 'pending')

        if (error) console.error('Queue trigger error:', error)
        await fetchItems()
        setTriggering(false)
    }

    // ── Delete Item ───────────────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        await supabase.from('clothes').delete().eq('id', id)
        setItems(prev => prev.filter(i => i.id !== id))
    }

    // ── Retry Failed ──────────────────────────────────────────────────────

    const handleRetry = async (id: string) => {
        await supabase.from('clothes')
            .update({ build_status: 'pending', error_message: null, updated_at: new Date().toISOString() })
            .eq('id', id)
        fetchItems()
    }

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-paper text-foreground font-sans">
            {/* Header */}
            <header className="h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="font-serif text-xl tracking-tight text-foreground">
                        ADMIN<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">VAULT</span>
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">
                        {counts.all} Garments
                    </Badge>
                    <Button
                        onClick={fetchItems}
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-none border-nimbus text-xs uppercase tracking-wider"
                    >
                        <RefreshCcw className="w-3 h-3 mr-1" /> Refresh
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-8 py-12 space-y-12">

                {/* ─── BULK UPLOAD ZONE ─────────────────────────────────── */}
                <section className="space-y-4">
                    <h2 className="font-serif text-3xl text-primary">Bulk Upload</h2>
                    <p className="text-sm text-muted-foreground">
                        Drop retailer garment photos below. Each file creates a new entry in the processing queue.
                    </p>

                    <div
                        className={`relative border-2 border-dashed rounded-none p-16 text-center transition-all duration-300 cursor-pointer ${dragOver
                                ? 'border-primary bg-primary/5 scale-[1.01]'
                                : 'border-nimbus hover:border-primary/50 bg-white'
                            }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        />

                        {uploading ? (
                            <div className="space-y-4">
                                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                                <p className="text-sm font-bold uppercase tracking-widest text-primary">
                                    Uploading {uploadProgress.done}/{uploadProgress.total}
                                </p>
                                <div className="w-64 mx-auto h-1 bg-nimbus/30 overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all duration-500"
                                        style={{ width: `${(uploadProgress.done / Math.max(uploadProgress.total, 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <ArrowUpFromLine className="w-10 h-10 text-muted-foreground mx-auto" />
                                <div>
                                    <p className="font-bold text-sm uppercase tracking-widest text-foreground">
                                        Drop garment images here
                                    </p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">
                                        JPG, PNG, WebP — up to 50+ files at once
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* ─── STATUS BOARD ─────────────────────────────────────── */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="font-serif text-3xl text-primary">Status Board</h2>
                        <div className="flex items-center gap-2">
                            {/* Process Queue Button */}
                            {counts.pending > 0 && (
                                <Button
                                    onClick={handleProcessQueue}
                                    disabled={triggering}
                                    className="h-10 px-6 rounded-none bg-foreground text-background hover:bg-primary hover:text-white text-xs uppercase tracking-widest font-bold"
                                >
                                    {triggering ? (
                                        <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Triggering...</>
                                    ) : (
                                        <><Cog className="w-3 h-3 mr-2" /> Process Queue ({counts.pending})</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 border-b border-nimbus pb-4">
                        {(['all', 'pending', 'processing', 'ready', 'failed'] as StatusFilter[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 text-[10px] uppercase tracking-widest font-bold transition-all ${filter === f
                                        ? 'bg-foreground text-background'
                                        : 'bg-white text-muted-foreground hover:bg-nimbus/20 border border-nimbus'
                                    }`}
                            >
                                {f} ({counts[f]})
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="text-center py-16">
                            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Loading garments...</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-16 bg-white border border-nimbus">
                            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">No garments found. Upload some above.</p>
                        </div>
                    ) : (
                        <div className="border border-nimbus bg-white overflow-hidden">
                            {/* Table Header */}
                            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-background border-b border-nimbus text-[9px] uppercase tracking-widest font-bold text-muted-foreground">
                                <div className="col-span-1">Preview</div>
                                <div className="col-span-3">Name</div>
                                <div className="col-span-2">Category</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-2">Updated</div>
                                <div className="col-span-2 text-right">Actions</div>
                            </div>

                            {/* Table Body */}
                            <AnimatePresence>
                                {items.map(item => {
                                    const status = STATUS_CONFIG[item.build_status]
                                    const StatusIcon = status.icon
                                    return (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-nimbus/50 items-center hover:bg-background/50 transition-colors"
                                        >
                                            {/* Preview */}
                                            <div className="col-span-1">
                                                <div className="w-10 h-14 bg-nimbus/20 overflow-hidden border border-nimbus">
                                                    <img src={item.raw_image_url} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            </div>

                                            {/* Name */}
                                            <div className="col-span-3">
                                                <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                                                <p className="text-[9px] text-muted-foreground font-mono mt-1 truncate">{item.id.slice(0, 8)}</p>
                                            </div>

                                            {/* Category */}
                                            <div className="col-span-2">
                                                <Badge className="bg-background border-nimbus rounded-none text-[9px] uppercase tracking-widest">
                                                    {item.category}
                                                </Badge>
                                            </div>

                                            {/* Status */}
                                            <div className="col-span-2">
                                                <Badge className={`${status.color} border rounded-none text-[9px] uppercase tracking-widest`}>
                                                    <StatusIcon className="w-3 h-3 mr-1" /> {status.label}
                                                </Badge>
                                                {item.error_message && (
                                                    <p className="text-[8px] text-red-500 mt-1 truncate">{item.error_message}</p>
                                                )}
                                            </div>

                                            {/* Updated */}
                                            <div className="col-span-2">
                                                <p className="text-[9px] text-muted-foreground font-mono">
                                                    {new Date(item.updated_at).toLocaleDateString('en-GB', {
                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </p>
                                            </div>

                                            {/* Actions */}
                                            <div className="col-span-2 flex justify-end gap-2">
                                                {item.build_status === 'failed' && (
                                                    <button
                                                        onClick={() => handleRetry(item.id)}
                                                        className="text-[9px] text-primary hover:text-foreground uppercase tracking-widest font-bold transition-colors"
                                                    >
                                                        <RefreshCcw className="w-3 h-3" />
                                                    </button>
                                                )}
                                                {item.build_status === 'ready' && item.processed_3d_url && (
                                                    <a
                                                        href={item.processed_3d_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[9px] text-primary hover:text-foreground uppercase tracking-widest font-bold"
                                                    >
                                                        View
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-[9px] text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </section>
            </div>
        </div>
    )
}
