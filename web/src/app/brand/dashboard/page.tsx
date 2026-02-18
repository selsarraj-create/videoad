"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import {
    Megaphone, PoundSterling, Clock, FileCheck, Plus,
    Loader2, Sparkles, Calendar, AlertCircle, ChevronRight,
    Eye, Users, X, Upload
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ── Types ──────────────────────────────────────────────────────

interface Bounty {
    id: string
    title: string
    description: string | null
    budget_gbp: number
    deadline: string | null
    status: string
    created_at: string
    submission_count?: number
}

interface BrandStats {
    activeCampaigns: number
    totalSpend: number
    pendingReviews: number
}

// ── Brand Dashboard Page ───────────────────────────────────────

export default function BrandDashboardPage() {
    const [bounties, setBounties] = useState<Bounty[]>([])
    const [stats, setStats] = useState<BrandStats>({ activeCampaigns: 0, totalSpend: 0, pendingReviews: 0 })
    const [loading, setLoading] = useState(true)
    const [showCreateForm, setShowCreateForm] = useState(false)
    const supabase = createClient()

    const fetchDashboard = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/bounties')
            if (res.ok) {
                const { data, stats: s } = await res.json()
                setBounties(data || [])
                if (s) setStats(s)
            }
        } catch (err) {
            console.error('Failed to load dashboard:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDashboard()
    }, [fetchDashboard])

    const statCards = [
        { label: "Active Campaigns", value: stats.activeCampaigns, icon: Megaphone, color: "text-primary" },
        { label: "Total Spend", value: `£${stats.totalSpend.toLocaleString()}`, icon: PoundSterling, color: "text-emerald-600" },
        { label: "Pending Reviews", value: stats.pendingReviews, icon: Clock, color: "text-amber-600" },
    ]

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h1 className="font-serif text-3xl tracking-tight">Brand Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your campaigns and review creator submissions.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((card, idx) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white border border-nimbus/40 p-6 flex items-start justify-between"
                    >
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</p>
                            <p className="text-3xl font-black font-mono mt-2">{card.value}</p>
                        </div>
                        <div className="w-10 h-10 bg-nimbus/20 flex items-center justify-center">
                            <card.icon className={`w-5 h-5 ${card.color}`} />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Create Campaign CTA */}
            <Button
                onClick={() => setShowCreateForm(true)}
                className="w-full h-14 bg-white border-2 border-foreground text-foreground hover:bg-nimbus/30 rounded-none text-xs uppercase tracking-[0.2em] font-bold transition-colors"
            >
                <Plus className="w-5 h-5 mr-2" />
                Create Campaign
            </Button>

            {/* Campaigns List */}
            <div className="space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Campaigns</h2>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                    </div>
                ) : bounties.length === 0 ? (
                    <div className="bg-white border border-nimbus/40 p-12 text-center">
                        <Megaphone className="w-12 h-12 text-primary/20 mx-auto mb-4" />
                        <h3 className="font-serif text-xl mb-2">No campaigns yet — create your first one!</h3>
                        <p className="text-sm text-muted-foreground mb-6">Create your first bounty to start receiving creator submissions.</p>
                        <Button
                            onClick={() => setShowCreateForm(true)}
                            className="h-10 bg-foreground text-white rounded-none text-xs uppercase tracking-[0.15em] font-bold px-6"
                        >
                            <Plus className="w-3.5 h-3.5 mr-2" /> Create First Campaign
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {bounties.map((bounty, idx) => (
                            <motion.div
                                key={bounty.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white border border-nimbus/40 p-6 flex items-center gap-6 hover:shadow-lg transition-shadow cursor-pointer group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-bold text-sm truncate">{bounty.title}</h3>
                                        <StatusBadge status={bounty.status} />
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate max-w-md">
                                        {bounty.description || "No description"}
                                    </p>
                                </div>

                                <div className="flex items-center gap-6 shrink-0">
                                    <div className="text-right">
                                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Budget</p>
                                        <p className="text-sm font-bold font-mono">£{bounty.budget_gbp}</p>
                                    </div>
                                    {bounty.deadline && (
                                        <div className="text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Deadline</p>
                                            <p className="text-sm font-mono">{new Date(bounty.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                                        </div>
                                    )}
                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Bounty Modal */}
            <AnimatePresence>
                {showCreateForm && (
                    <CreateBountyModal
                        onClose={() => setShowCreateForm(false)}
                        onCreated={() => { setShowCreateForm(false); fetchDashboard() }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Status Badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        draft: "bg-nimbus/20 text-muted-foreground",
        active: "bg-emerald-50 text-emerald-700 border-emerald-200",
        closed: "bg-red-50 text-red-600 border-red-200",
    }

    return (
        <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 border ${styles[status] || styles.draft}`}>
            {status}
        </span>
    )
}

// ── Create Bounty Modal ────────────────────────────────────────

function CreateBountyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [budget, setBudget] = useState("")
    const [paymentPerVideo, setPaymentPerVideo] = useState("")
    const [deadline, setDeadline] = useState("")
    const [productImage, setProductImage] = useState<File | null>(null)
    const [productImagePreview, setProductImagePreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [dragOver, setDragOver] = useState(false)

    const maxVideos = budget && paymentPerVideo && parseInt(paymentPerVideo, 10) > 0
        ? Math.floor(parseInt(budget, 10) / parseInt(paymentPerVideo, 10))
        : null

    const handleImageSelect = (file: File) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowed.includes(file.type)) {
            setError('Invalid file type. Allowed: JPEG, PNG, WebP, GIF')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Image too large. Max 5MB')
            return
        }
        setProductImage(file)
        setProductImagePreview(URL.createObjectURL(file))
        setError("")
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) handleImageSelect(file)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim() || !budget) return

        setSubmitting(true)
        setError("")

        try {
            let productImageUrl: string | null = null

            // Upload product image first if one was selected
            if (productImage) {
                setUploading(true)
                const formData = new FormData()
                formData.append('file', productImage)

                const uploadRes = await fetch('/api/upload/product-image', {
                    method: 'POST',
                    body: formData,
                })

                if (!uploadRes.ok) {
                    const data = await uploadRes.json()
                    throw new Error(data.error || 'Image upload failed')
                }

                const { url } = await uploadRes.json()
                productImageUrl = url
                setUploading(false)
            }

            // Create the bounty
            const res = await fetch('/api/bounties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description.trim() || null,
                    budget_gbp: parseInt(budget, 10),
                    payment_per_video: paymentPerVideo ? parseInt(paymentPerVideo, 10) : 0,
                    product_image_url: productImageUrl,
                    deadline: deadline || null,
                    status: 'active',
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to create campaign')
            }

            onCreated()
        } catch (err: any) {
            setError(err.message)
            setUploading(false)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-x-4 top-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50 max-h-[90vh] overflow-y-auto"
            >
                <form onSubmit={handleSubmit} className="bg-white border border-nimbus/40 shadow-2xl">
                    <div className="p-6 border-b border-nimbus/20 flex items-center justify-between sticky top-0 bg-white z-10">
                        <h2 className="font-serif text-xl tracking-tight">Create Campaign</h2>
                        <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-nimbus/20 rounded-full transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-6 space-y-5">
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        {/* Campaign Title */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Campaign Title *</label>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Summer Collection Video Ads"
                                className="w-full h-11 px-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Brief / Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What are you looking for? Describe the style, requirements, and deliverables..."
                                rows={3}
                                className="w-full px-4 py-3 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors resize-none"
                            />
                        </div>

                        {/* Product Image Upload */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product Image</label>
                            {productImagePreview ? (
                                <div className="relative group">
                                    <img
                                        src={productImagePreview}
                                        alt="Product preview"
                                        className="w-full h-48 object-cover border border-nimbus/30"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setProductImage(null); setProductImagePreview(null) }}
                                        className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById('product-image-input')?.click()}
                                    className={`w-full h-36 border-2 border-dashed cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-nimbus/40 hover:border-primary/40 hover:bg-nimbus/5'
                                        }`}
                                >
                                    <Upload className="w-6 h-6 text-muted-foreground/40" />
                                    <span className="text-xs text-muted-foreground">Drop image here or click to upload</span>
                                    <span className="text-[9px] text-muted-foreground/50">JPEG, PNG, WebP · Max 5MB</span>
                                </div>
                            )}
                            <input
                                id="product-image-input"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleImageSelect(file)
                                }}
                            />
                        </div>

                        {/* Payment Per Video + Total Budget */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Per Video (£) *</label>
                                <div className="relative">
                                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="number"
                                        value={paymentPerVideo}
                                        onChange={(e) => setPaymentPerVideo(e.target.value)}
                                        placeholder="50"
                                        min="1"
                                        className="w-full h-11 pl-9 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Budget (£) *</label>
                                <div className="relative">
                                    <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="number"
                                        value={budget}
                                        onChange={(e) => setBudget(e.target.value)}
                                        placeholder="500"
                                        min="1"
                                        className="w-full h-11 pl-9 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Max Videos Indicator */}
                        {maxVideos !== null && (
                            <div className="flex items-center gap-2 px-4 py-3 bg-primary/5 border border-primary/10">
                                <FileCheck className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-xs text-primary font-medium">
                                    This budget covers up to <strong className="font-black">{maxVideos} video{maxVideos !== 1 ? 's' : ''}</strong> at £{paymentPerVideo} each
                                </span>
                            </div>
                        )}

                        {/* Deadline */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deadline</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className="w-full h-11 pl-9 pr-4 border border-nimbus/30 bg-white text-sm focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 pt-0">
                        <Button
                            type="submit"
                            disabled={submitting || uploading || !title.trim() || !budget || !paymentPerVideo}
                            className="w-full h-12 bg-primary text-white hover:bg-primary/90 rounded-none text-xs uppercase tracking-[0.2em] font-bold disabled:opacity-50"
                        >
                            {uploading ? (
                                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading Image...</>
                            ) : submitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <><Megaphone className="w-4 h-4 mr-2" /> Launch Campaign</>
                            )}
                        </Button>
                    </div>
                </form>
            </motion.div>
        </>
    )
}
