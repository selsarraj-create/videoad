"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { type Preset } from "@/lib/presets"
import { motion, AnimatePresence } from "framer-motion"

interface Job {
    id: string
    created_at: string
    input_params: Record<string, unknown>
    status: 'pending' | 'processing' | 'completed' | 'failed'
    output_url: string | null
    model: string
    tier: string
    project_id: string
    error_message: string | null
    provider_metadata?: {
        compute_savings?: string | number;
        [key: string]: any;
    }
}

interface MediaItem {
    id: string
    job_id: string
    image_url: string
    person_image_url: string | null
    garment_image_url: string | null
    label: string
    created_at: string
}

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
    Upload, Loader2, Sparkles, Image as ImageIcon,
    FastForward, Library, ExternalLink, Camera,
    Video, User, Shirt, Check, Plus, ArrowRight, Trash2, X, LogOut,
    Pencil, Star, ChevronDown, UserCircle, Menu, ShoppingBag, Award as AwardIcon, FolderOpen, Eye
} from "lucide-react"
import { PresetGrid } from "@/components/preset-grid"
import { getOrCreateDefaultProject } from "@/app/actions"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { BespokeInput } from "@/components/ui/bespoke-input"
import { ParticleSilhouette } from "@/components/ui/particle-silhouette"
import { StatusPill } from "@/components/ui/status-pill"
import { RevenueChart } from "@/components/revenue-chart"
import { LookOfTheDay } from "@/components/look-of-the-day"
import { ShowcaseGrid } from "@/components/showcase-grid"
import { CreditShop } from "@/components/credit-shop"
import { BountyFeed } from "@/components/bounty-feed"
import { ProjectsGrid } from "@/components/projects-grid"
import { DollarSign, TrendingUp, Clock, Award, Bell, Globe, Lock, Zap, CreditCard, Settings, ShieldAlert, AlertTriangle } from "lucide-react"
import type { SubscriptionTier } from "@/lib/tier-config"
import type { AccountStatus } from "@/lib/moderation"

type Tab = 'identities' | 'try-on' | 'video' | 'marketplace' | 'showcase' | 'bounties' | 'projects'

interface MarketplaceItem {
    id: string;
    source: 'oxylabs' | 'ebay' | 'library' | 'trending';
    title: string;
    price: string;
    currency: string;
    imageUrl: string;
    affiliateUrl: string;
    brand?: string;
    category?: string;
    merchant?: string;
    authenticityGuaranteed?: boolean;
    isTrending?: boolean;
    trendKeyword?: string;
}

interface TrendKeyword {
    keyword: string;
    trafficVolume: string;
    isRising: boolean;
}

interface PersonaSlot {
    id: string
    name: string
    master_identity_url: string | null
    is_default: boolean
    status: string
    created_at: string
}

export default function StudioPage() {
    const [activeTab, setActiveTab] = useState<Tab>('try-on')
    const [dashMenuOpen, setDashMenuOpen] = useState(false)

    // Persona state
    const [personaSlots, setPersonaSlots] = useState<PersonaSlot[]>([])
    const [allPersonaSlots, setAllPersonaSlots] = useState<PersonaSlot[]>([])
    const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null)
    const [personaLoading, setPersonaLoading] = useState(true)
    const [renamingId, setRenamingId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [identityMessage, setIdentityMessage] = useState<string | null>(null)

    // Try-On state
    const [garmentImageUrl, setGarmentImageUrl] = useState("")
    const [garmentPreview, setGarmentPreview] = useState<string | null>(null)
    const [tryOnLoading, setTryOnLoading] = useState(false)
    const [tryOnResult, setTryOnResult] = useState<string | null>(null)
    const [tryOnError, setTryOnError] = useState<string | null>(null)

    // Video state
    const [selectedMediaItem, setSelectedMediaItem] = useState<MediaItem | null>(null)
    const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null)
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16')
    const [videoLoading, setVideoLoading] = useState(false)

    // Extension Dialog State
    const [extensionDialogOpen, setExtensionDialogOpen] = useState(false)
    const [extensionJob, setExtensionJob] = useState<Job | null>(null)
    const [extensionPrompt, setExtensionPrompt] = useState("")

    // Marketplace state
    const [marketplaceQuery, setMarketplaceQuery] = useState("")
    const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([])
    const [marketplaceLoading, setMarketplaceLoading] = useState(false)
    const [marketplaceCategory, setMarketplaceCategory] = useState("All")
    const [marketplaceBrand, setMarketplaceBrand] = useState("All")
    const [trendKeywords, setTrendKeywords] = useState<TrendKeyword[]>([])
    const [trendsLoading, setTrendsLoading] = useState(false)
    const [vtoLoadingId, setVtoLoadingId] = useState<string | null>(null)
    const [wardrobeAddingId, setWardrobeAddingId] = useState<string | null>(null)
    const [wardrobeAddedIds, setWardrobeAddedIds] = useState<Set<string>>(new Set())

    // Revenue state
    const [revenueData, setRevenueData] = useState<any[]>([])
    const [ledger, setLedger] = useState<any[]>([])
    const [stats, setStats] = useState({ total: 0, cleared: 0, pending: 0 })
    const [payoutLoading, setPayoutLoading] = useState(false)
    const [payoutStatus, setPayoutStatus] = useState<string | null>(null)

    // Trend state
    const [currentTrend, setCurrentTrend] = useState<any>(null)

    // Compliance state
    const [disclosureOpen, setDisclosureOpen] = useState(false)
    const [disclosureAccepted, setDisclosureAccepted] = useState(false)

    // Shared state
    const [jobs, setJobs] = useState<Job[]>([])
    const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([])
    const [projectId, setProjectId] = useState<string | null>(null)
    const [user, setUser] = useState<any>(null)

    // Viral Showcase state
    const [originalCreatorId, setOriginalCreatorId] = useState<string | null>(null)
    const [originalShowcaseId, setOriginalShowcaseId] = useState<string | null>(null)
    const [remixEnabled, setRemixEnabled] = useState(true)
    const [adoptionMetrics, setAdoptionMetrics] = useState({ remixCount: 0, bonusEarned: 0 })

    // Credit & Tier state
    const [creditBalance, setCreditBalance] = useState(0)
    const [userTier, setUserTier] = useState<SubscriptionTier>('starter')
    const [effectiveTier, setEffectiveTier] = useState<SubscriptionTier>('starter')
    const [trialActive, setTrialActive] = useState(false)
    const [creditModalOpen, setCreditModalOpen] = useState(false)
    const [creditModalContext, setCreditModalContext] = useState<{ required: number; balance: number } | null>(null)
    const [creditShopOpen, setCreditShopOpen] = useState(false)
    const [upgradeNudge, setUpgradeNudge] = useState<string | null>(null)

    // Moderation state
    const [accountStatus, setAccountStatus] = useState<AccountStatus>('active')
    const [strikeCount, setStrikeCount] = useState(0)
    const [cooldownUntil, setCooldownUntil] = useState<string | null>(null)
    const [safetyWarningOpen, setSafetyWarningOpen] = useState(false)
    const [safetyWarningMsg, setSafetyWarningMsg] = useState('')


    const garmentFileRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    // Derived: get selected persona's image URL
    const selectedPersona = personaSlots.find(p => p.id === selectedPersonaId)
    const masterIdentityUrl = selectedPersona?.master_identity_url || null

    // Fetch persona slots (ready only for tryon selector)
    const fetchPersonas = useCallback(async () => {
        try {
            const [readyRes, allRes] = await Promise.all([
                fetch('/api/personas'),
                fetch('/api/personas?all=true'),
            ])
            const readyData = await readyRes.json()
            const allData = await allRes.json()
            if (readyData.personas) {
                setPersonaSlots(readyData.personas)
                // Auto-select default or first
                if (!selectedPersonaId || !readyData.personas.find((p: PersonaSlot) => p.id === selectedPersonaId)) {
                    const defaultP = readyData.personas.find((p: PersonaSlot) => p.is_default) || readyData.personas[0]
                    if (defaultP) setSelectedPersonaId(defaultP.id)
                }
            }
            if (allData.personas) {
                setAllPersonaSlots(allData.personas)
            }
        } catch (err) {
            console.error('Failed to fetch personas:', err)
        } finally {
            setPersonaLoading(false)
        }
    }, [selectedPersonaId])

    // Fetch credit & tier info
    const fetchCredits = useCallback(async () => {
        try {
            const res = await fetch('/api/credits')
            if (res.ok) {
                const data = await res.json()
                setCreditBalance(data.balance ?? 0)
                setUserTier(data.tier ?? 'starter')
                setEffectiveTier(data.effectiveTier ?? 'starter')
                setTrialActive(data.trialActive ?? false)
            }
        } catch (err) {
            console.error('Failed to fetch credits:', err)
        }
    }, [])

    // Initialize
    useEffect(() => {
        getOrCreateDefaultProject().then(({ projectId: pid }) => {
            if (pid) setProjectId(pid)
        })
        supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
        fetchPersonas()
        fetchCredits()
        // Fetch moderation status
        fetch('/api/moderation').then(r => r.json()).then(data => {
            setAccountStatus(data.account_status || 'active')
            setStrikeCount(data.strike_count || 0)
            setCooldownUntil(data.cooldown_until || null)
        }).catch(() => { })
    }, [])

    // Poll jobs + media library (filtered by user_id)
    useEffect(() => {
        if (!user?.id) return
        const uid = user.id

        const fetchData = async () => {
            const { data: jobData } = await supabase.from('jobs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30)
            if (jobData) setJobs(jobData as Job[])

            const { data: mediaData } = await supabase.from('media_library').select('*').eq('user_id', uid).order('created_at', { ascending: false })
            if (mediaData) setMediaLibrary(mediaData as MediaItem[])

            // Fetch Revenue Ledger
            const { data: ledgerData } = await supabase.from('revenue_ledger').select('*').eq('user_id', uid).order('created_at', { ascending: false })
            if (ledgerData) {
                setLedger(ledgerData)
                const total = ledgerData.reduce((sum, item) => sum + Number(item.user_share), 0)
                const cleared = ledgerData.filter(i => i.status === 'cleared').reduce((sum, item) => sum + Number(item.user_share), 0)
                const pending = ledgerData.filter(i => i.status === 'pending').reduce((sum, item) => sum + Number(item.user_share), 0)
                setStats({ total, cleared, pending })

                // Mock trendline from ledger
                const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date()
                    date.setDate(date.getDate() - (6 - i))
                    const dateStr = date.toISOString().split('T')[0]
                    const dayTotal = ledgerData
                        .filter(l => l.created_at?.startsWith(dateStr))
                        .reduce((sum, item) => sum + Number(item.user_share), 0)
                    return { date: dateStr, amount: dayTotal || Math.random() * 5 } // Random for demo if empty
                })
                setRevenueData(last7Days)

                // Fetch Adoption Metrics (wrapped in try/catch in case migration not yet applied)
                try {
                    const { count: remixes } = await supabase.from('public_showcase').select('*', { count: 'exact', head: true }).eq('original_creator_id', uid)
                    const bonusTotal = ledgerData.filter(l => (l.metadata as Record<string, any>)?.role === 'original_creator').reduce((sum, item) => sum + Number(item.user_share), 0)
                    setAdoptionMetrics({ remixCount: remixes || 0, bonusEarned: bonusTotal })
                } catch (adoptionErr) {
                    console.log('[Dashboard] Adoption metrics not available yet:', adoptionErr)
                }
            }

            // Fetch Today's Trend
            const today = new Date().toISOString().split('T')[0]
            const { data: trendData } = await supabase.from('trends').select('*').eq('look_of_the_day_date', today).maybeSingle()
            if (trendData) setCurrentTrend(trendData)
        }
        fetchData()
        const interval = setInterval(fetchData, 4000)
        return () => clearInterval(interval)
    }, [user?.id])

    // Check for completed try-on jobs and auto-save to media library
    const savingJobIds = useRef(new Set<string>())
    useEffect(() => {
        const tryOnJobs = jobs.filter(j => j.tier === 'try_on' && j.status === 'completed' && j.output_url)
        for (const job of tryOnJobs) {
            const alreadySaved = mediaLibrary.some(m => m.job_id === job.id)
            if (!alreadySaved && !savingJobIds.current.has(job.id)) {
                savingJobIds.current.add(job.id)
                supabase.from('media_library').upsert({
                    job_id: job.id,
                    user_id: user?.id || '',
                    image_url: job.output_url || '',
                    person_image_url: (job.input_params as Record<string, string>)?.person_image_url || null,
                    garment_image_url: (job.input_params as Record<string, string>)?.garment_image_url || null,
                    label: ''
                } as any, { onConflict: 'job_id' }).then(() => {
                    // Refresh media library
                    supabase.from('media_library').select('*').order('created_at', { ascending: false })
                        .then(({ data }) => {
                            if (data) setMediaLibrary(data as MediaItem[])
                            savingJobIds.current.delete(job.id)
                        })
                })
            }
        }
    }, [jobs])

    // Delete persona handler
    const handleDeletePersona = async (id: string) => {
        try {
            await fetch(`/api/personas?id=${id}`, { method: 'DELETE' })
            await fetchPersonas()
        } catch (err) {
            console.error('Failed to delete persona:', err)
        }
    }

    // Rename persona handler
    const handleRenamePersona = async (id: string, newName: string) => {
        try {
            await fetch('/api/personas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name: newName }),
            })
            setRenamingId(null)
            await fetchPersonas()
        } catch (err) {
            console.error('Failed to rename persona:', err)
        }
    }

    // Set default persona handler
    const handleSetDefault = async (id: string) => {
        try {
            await fetch('/api/personas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_default: true }),
            })
            await fetchPersonas()
        } catch (err) {
            console.error('Failed to set default persona:', err)
        }
    }

    // Zero-identity redirect: if user switches to try-on and has no ready identities
    useEffect(() => {
        if (activeTab === 'try-on' && !personaLoading && personaSlots.length === 0) {
            setActiveTab('identities')
            setIdentityMessage('Build your first identity to start creating')
        }
    }, [activeTab, personaLoading, personaSlots.length])

    // File upload handler (garments only — person uses Master Identity)
    const uploadFile = async (file: File) => {
        // Show preview and set a temporary data URL immediately
        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            setGarmentPreview(dataUrl)
            setGarmentImageUrl(dataUrl) // Use data URL as fallback
        }
        reader.readAsDataURL(file)

        // Try uploading to Supabase storage — upgrade to public URL on success
        try {
            const fileName = `garments/${Date.now()}_${file.name}`
            const { error } = await supabase.storage.from('raw_assets').upload(fileName, file)
            if (!error) {
                const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
                setGarmentImageUrl(urlData.publicUrl)
            } else {
                console.warn('Storage upload failed, using data URL:', error.message)
            }
        } catch (err) {
            console.warn('Storage not available, using data URL fallback')
        }
    }

    // Try-On handler
    const handleTryOn = async () => {
        if (!masterIdentityUrl) {
            setTryOnError('No Master Identity found. Complete onboarding first.')
            return
        }
        if (!garmentImageUrl) {
            setTryOnError('Upload a garment image first.')
            return
        }
        setTryOnLoading(true)
        setTryOnResult(null)
        setTryOnError(null)
        try {
            const res = await fetch('/api/try-on', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity_id: selectedPersonaId,
                    person_image_url: masterIdentityUrl,
                    garment_image_url: garmentImageUrl
                })
            })
            const data = await res.json()

            if (!res.ok) {
                setTryOnError(data.error || `Server error (${res.status})`)
                setTryOnLoading(false)
                return
            }

            if (data.job?.id) {
                // Poll for result
                const pollInterval = setInterval(async () => {
                    const { data: job } = await supabase.from('jobs').select('*').eq('id', data.job.id).single()
                    if (job?.status === 'completed' && job.output_url) {
                        setTryOnResult(job.output_url)
                        setTryOnLoading(false)
                        clearInterval(pollInterval)
                    } else if (job?.status === 'failed') {
                        setTryOnError(job.error_message || 'Try-on failed. Please try again.')
                        setTryOnLoading(false)
                        clearInterval(pollInterval)
                    }
                }, 3000)
            } else {
                setTryOnError('No job created — unexpected response.')
                setTryOnLoading(false)
            }
        } catch (e) {
            console.error(e)
            setTryOnError('Network error — check your connection.')
            setTryOnLoading(false)
        }
    }

    // Video generation handler
    const handleGenerateVideo = async () => {
        if (!selectedMediaItem || !selectedPreset) return
        setVideoLoading(true)
        try {
            await fetch('/api/fashion-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    garment_image_url: selectedMediaItem.image_url,
                    preset_id: selectedPreset.id,
                    aspect_ratio: aspectRatio,
                    identity_id: selectedPersonaId || ''
                })
            })
        } catch (e) { console.error(e) }
        setTimeout(() => setVideoLoading(false), 2000)
    }

    // Extension Handler
    const handleExtendVideo = async () => {
        if (!extensionJob || !extensionPrompt) return;

        try {
            await fetch('/api/extend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: extensionJob.id, prompt: extensionPrompt })
            })
            setExtensionDialogOpen(false)
            setExtensionPrompt("")
            setExtensionJob(null)
        } catch (e) {
            console.error(e)
        }
    }

    // Marketplace Search
    const handleMarketplaceSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!marketplaceQuery && marketplaceCategory === 'All' && marketplaceBrand === 'All') return

        setMarketplaceLoading(true)
        try {
            const params = new URLSearchParams()
            if (marketplaceQuery) params.set('q', marketplaceQuery)
            if (marketplaceCategory !== 'All') params.set('category', marketplaceCategory)
            if (marketplaceBrand !== 'All') params.set('brand', marketplaceBrand)

            const res = await fetch(`/api/marketplace?${params.toString()}`)
            const data = await res.json()
            if (data.items) setMarketplaceItems(data.items)
        } catch (err) {
            console.error('Marketplace search failed:', err)
        } finally {
            setMarketplaceLoading(false)
        }
    }

    // Load trends
    const loadTrends = async () => {
        setTrendsLoading(true)
        try {
            const res = await fetch('/api/trends')
            const data = await res.json()
            if (data.keywords) setTrendKeywords(data.keywords)
        } catch (err) {
            console.error('Trends load failed:', err)
        } finally {
            setTrendsLoading(false)
        }
    }

    // Search by trend keyword
    const searchByTrend = (keyword: string) => {
        setMarketplaceQuery(keyword)
        setMarketplaceCategory('All')
        setMarketplaceBrand('All')
        setTimeout(() => handleMarketplaceSearch(), 100)
    }

    // Category click → trigger search
    const handleCategoryClick = (cat: string) => {
        setMarketplaceCategory(cat)
        if (cat !== 'All') {
            setMarketplaceQuery('')
            setMarketplaceBrand('All')
        }
    }

    // Auto-search on filter change
    useEffect(() => {
        if (activeTab === 'marketplace') {
            handleMarketplaceSearch()
        }
    }, [marketplaceCategory, marketplaceBrand])

    // Load trends when marketplace tab opens
    useEffect(() => {
        if (activeTab === 'marketplace' && trendKeywords.length === 0) {
            loadTrends()
        }
    }, [activeTab])

    // Revenue Payouts
    const handlePayoutAction = async (action: 'onboard' | 'payout') => {
        setPayoutLoading(true)
        setPayoutStatus(null)
        try {
            const res = await fetch('/api/payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            })
            const data = await res.json()
            if (data.url) {
                window.location.href = data.url
            } else if (data.success) {
                setPayoutStatus('Payout initiated successfully.')
            } else {
                setPayoutStatus(data.error || 'Action failed.')
            }
        } catch (err) {
            setPayoutStatus('Network error.')
        } finally {
            setPayoutLoading(false)
        }
    }

    const handleApplyTrend = (imageUrl: string) => {
        setGarmentImageUrl(imageUrl)
        setGarmentPreview(imageUrl)
        // Scroll to garment section if needed, though it's visible
    }

    const canTryOn = masterIdentityUrl && garmentImageUrl && !tryOnLoading
    const canGenerateVideo = selectedMediaItem && selectedPreset && !videoLoading
    const videoJobs = jobs.filter(j => j.tier !== 'try_on')

    // Render an upload drop zone inline
    const renderUploadZone = (
        type: 'person' | 'garment',
        preview: string | null,
        fileRef: React.RefObject<HTMLInputElement | null>,
        IconComp: typeof User,
        label: string,
        sublabel: string
    ) => (
        <div
            onClick={() => fileRef.current?.click()}
            className={`relative border-b border-nimbus transition-all duration-300 cursor-pointer overflow-hidden group py-10
                ${preview ? 'bg-white' : 'bg-transparent hover:bg-white/40'}`}
        >
            {preview ? (
                <div className="relative aspect-[3/4] max-h-[300px] mx-auto">
                    <img src={preview} alt={label} className="w-full h-full object-contain p-4 mix-blend-multiply" />
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setGarmentPreview(null); setGarmentImageUrl('')
                            }}
                            className="bg-stretch-limo text-white w-6 h-6 flex items-center justify-center rounded-none text-[10px]"
                        >×</button>
                    </div>
                    <Badge className="absolute bottom-4 left-4 bg-stretch-limo text-white border-0 rounded-none text-[9px] uppercase tracking-widest">
                        ✓ {label}
                    </Badge>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-12 h-12 flex items-center justify-center border border-nimbus rounded-none group-hover:border-stretch-limo transition-colors">
                        <IconComp className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{label}</p>
                        <p className="text-[10px] text-muted-foreground italic font-serif">{sublabel}</p>
                    </div>
                </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f) }} />
        </div>
    )

    return (
        <div className="min-h-screen bg-paper text-foreground flex flex-col font-sans overflow-hidden selection:bg-primary/20">
            {/* Header */}
            <header className="h-16 lg:h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 z-50 sticky top-0">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <h1 className="font-serif text-xl tracking-tight text-foreground mix-blend-difference">
                            LOOK<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">MAISON</span>
                        </h1>
                    </div>

                    {/* Tab Switcher - Desktop Only */}
                    <div className="hidden lg:flex items-center gap-8 ml-12 overflow-x-auto scrollbar-none pb-1">
                        <button onClick={() => setActiveTab('identities')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2 
                                ${activeTab === 'identities' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Identities
                            {activeTab === 'identities' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('try-on')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2 
                                ${activeTab === 'try-on' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Try On
                            {activeTab === 'try-on' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('video')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2
                                ${activeTab === 'video' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Create Video
                            {activeTab === 'video' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('marketplace')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2
                                ${activeTab === 'marketplace' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Marketplace
                            {activeTab === 'marketplace' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('showcase')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2
                                ${activeTab === 'showcase' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Showcase
                            {activeTab === 'showcase' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('bounties')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2
                                ${activeTab === 'bounties' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Bounties
                            {activeTab === 'bounties' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                        <button onClick={() => setActiveTab('projects')}
                            className={`text-xs uppercase tracking-[0.2em] font-bold transition-all relative py-2
                                ${activeTab === 'projects' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}>
                            Projects
                            {activeTab === 'projects' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-[1px] bg-foreground" />}
                        </button>
                    </div>
                </div>

                {/* Desktop utility links */}
                <div className="hidden lg:flex items-center gap-6">
                    <Link href="/dashboard/content"
                        className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                        <Library className="w-3.5 h-3.5" /> Content Vault
                    </Link>
                    <Link href="/dashboard/settings"
                        className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5" /> Settings
                    </Link>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut()
                            window.location.href = '/login'
                        }}
                        className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-2"
                    >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>

                    {/* Credit Balance Badge */}
                    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-nimbus/30">
                        <button onClick={() => setCreditShopOpen(true)} className="flex items-center gap-2 bg-foreground/5 border border-nimbus/20 px-3 py-1.5 hover:bg-primary/5 hover:border-primary/30 transition-colors cursor-pointer">
                            <Zap className="w-3 h-3 text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">{creditBalance} CR</span>
                        </button>
                        <div className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest
                            ${userTier === 'high_octane' ? 'bg-amber-500/10 text-amber-600 border border-amber-200'
                                : userTier === 'pro' || trialActive ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-foreground/5 text-muted-foreground border border-nimbus/20'}`}>
                            {trialActive ? 'Trial' : userTier === 'high_octane' ? 'High-Octane' : userTier === 'pro' ? 'Pro' : 'Starter'}
                        </div>
                    </div>
                </div>

                {/* Mobile: Credit badge + hamburger */}
                <div className="flex lg:hidden items-center gap-3">
                    <button onClick={() => setCreditShopOpen(true)} className="flex items-center gap-1.5 bg-foreground/5 border border-nimbus/20 px-2.5 py-1.5">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{creditBalance}</span>
                    </button>
                    <button
                        onClick={() => setDashMenuOpen(!dashMenuOpen)}
                        className="w-10 h-10 flex items-center justify-center"
                        aria-label="Toggle menu"
                    >
                        <AnimatePresence mode="wait">
                            {dashMenuOpen ? (
                                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                                    <X className="w-5 h-5" />
                                </motion.div>
                            ) : (
                                <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                                    <Menu className="w-5 h-5" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </header>

            {/* ===== MOBILE DRAWER ===== */}
            <AnimatePresence>
                {dashMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            onClick={() => setDashMenuOpen(false)}
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed top-0 right-0 bottom-0 w-[300px] bg-background/95 backdrop-blur-xl z-50 lg:hidden shadow-2xl overflow-y-auto"
                        >
                            <div className="pt-20 px-6 pb-8 space-y-6">
                                {/* Tabs */}
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 px-3">Navigation</p>
                                    {[
                                        { id: 'identities' as Tab, label: 'Identities', icon: UserCircle },
                                        { id: 'try-on' as Tab, label: 'Try On', icon: Shirt },
                                        { id: 'video' as Tab, label: 'Create Video', icon: Video },
                                        { id: 'marketplace' as Tab, label: 'Marketplace', icon: ShoppingBag },
                                        { id: 'showcase' as Tab, label: 'Showcase', icon: Eye },
                                        { id: 'bounties' as Tab, label: 'Bounties', icon: AwardIcon },
                                        { id: 'projects' as Tab, label: 'Projects', icon: FolderOpen },
                                    ].map(({ id, label, icon: Icon }) => (
                                        <button
                                            key={id}
                                            onClick={() => { setActiveTab(id); setDashMenuOpen(false) }}
                                            className={`w-full flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-[0.15em] transition-all
                                                ${activeTab === id ? 'text-foreground bg-foreground/5' : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]'}`}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {label}
                                            {activeTab === id && <div className="ml-auto w-1.5 h-1.5 bg-primary rounded-full" />}
                                        </button>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-nimbus/30" />

                                {/* Utility Links */}
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 px-3">More</p>
                                    <Link href="/dashboard/content" onClick={() => setDashMenuOpen(false)}
                                        className="flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors">
                                        <Library className="w-4 h-4" /> Content Vault
                                    </Link>
                                    <Link href="/dashboard/settings" onClick={() => setDashMenuOpen(false)}
                                        className="flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors">
                                        <Settings className="w-4 h-4" /> Settings
                                    </Link>
                                    <button
                                        onClick={async () => {
                                            await supabase.auth.signOut()
                                            window.location.href = '/login'
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-3 text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-red-500 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" /> Sign Out
                                    </button>
                                </div>

                                {/* Tier Badge */}
                                <div className="px-3 pt-2">
                                    <div className={`inline-block px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest
                                        ${userTier === 'high_octane' ? 'bg-amber-500/10 text-amber-600 border border-amber-200'
                                            : userTier === 'pro' || trialActive ? 'bg-primary/10 text-primary border border-primary/20'
                                                : 'bg-foreground/5 text-muted-foreground border border-nimbus/20'}`}>
                                        {trialActive ? 'Trial' : userTier === 'high_octane' ? 'High-Octane' : userTier === 'pro' ? 'Pro' : 'Starter'}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <main className="flex-1 grid grid-cols-12 overflow-hidden pb-[72px] lg:pb-0">

                {/* ===== LEFT PANEL ===== */}
                <section className={`flex flex-col overflow-y-auto glass-panel z-20 relative transition-all duration-500
                    ${(activeTab === 'identities' || activeTab === 'marketplace' || activeTab === 'showcase' || activeTab === 'bounties' || activeTab === 'projects') ? 'col-span-12' : 'col-span-12 lg:col-span-5'}`}>
                    <div className={`flex-1 p-8 lg:p-12 w-full space-y-12 transition-all
                        ${(activeTab === 'identities' || activeTab === 'marketplace' || activeTab === 'showcase' || activeTab === 'bounties' || activeTab === 'projects') ? 'max-w-6xl mx-auto' : 'max-w-xl mx-auto'}`}>

                        {activeTab === 'showcase' ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                                <div className="space-y-2 border-b border-nimbus pb-8">
                                    <h2 className="font-serif text-3xl tracking-tight">Community Showcase</h2>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">Trending looks and community creations</p>
                                </div>
                                <ShowcaseGrid onRemix={(item) => {
                                    // Handle Remix look
                                    if (item.garment_metadata?.[0]) {
                                        setGarmentImageUrl(item.garment_metadata[0].imageUrl)
                                        setGarmentPreview(item.garment_metadata[0].imageUrl)
                                        if (item.persona_id) setSelectedPersonaId(item.persona_id)
                                        setOriginalCreatorId(item.user_id)
                                        setOriginalShowcaseId(item.id)
                                        setActiveTab('try-on')
                                    }
                                }} />
                            </motion.div>
                        ) : activeTab === 'identities' ? (
                            /* ---- IDENTITIES TAB ---- */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-10">
                                <div className="space-y-2 border-b border-nimbus pb-8">
                                    <h2 className="font-serif text-3xl tracking-tight">Your Identities</h2>
                                    <p className="text-xs text-muted-foreground uppercase tracking-widest">
                                        Create up to 5 unique personas · {allPersonaSlots.length} of 5 used
                                    </p>
                                </div>

                                {/* Redirect message */}
                                {identityMessage && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-5 border-l-2 border-primary bg-primary/5"
                                    >
                                        <p className="text-xs text-foreground font-bold uppercase tracking-widest">{identityMessage}</p>
                                        <button onClick={() => setIdentityMessage(null)} className="text-[10px] text-muted-foreground hover:text-foreground mt-1">Dismiss</button>
                                    </motion.div>
                                )}

                                {/* Identity Cards Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {allPersonaSlots.map((persona) => (
                                        <div
                                            key={persona.id}
                                            className={`group relative bg-white border transition-all duration-300 hover:shadow-xl overflow-hidden
                                                ${persona.is_default ? 'border-primary shadow-md' : 'border-nimbus hover:border-primary/40'}`}
                                        >
                                            {/* Thumbnail */}
                                            <div className="aspect-[3/4] bg-nimbus/10 overflow-hidden">
                                                {persona.master_identity_url ? (
                                                    <img src={persona.master_identity_url} alt={persona.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                                                        <UserCircle className="w-16 h-16 text-nimbus" />
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                                            {persona.status === 'pending' ? 'Processing...' : persona.status === 'generating' ? 'Generating...' : 'No Image'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info Bar */}
                                            <div className="p-4 space-y-3">
                                                {/* Name (inline editable) */}
                                                {renamingId === persona.id ? (
                                                    <form onSubmit={(e) => { e.preventDefault(); handleRenamePersona(persona.id, renameValue) }} className="flex gap-2">
                                                        <input
                                                            autoFocus
                                                            value={renameValue}
                                                            onChange={(e) => setRenameValue(e.target.value)}
                                                            className="flex-1 h-8 px-2 text-sm border border-nimbus bg-white focus:border-primary focus:outline-none"
                                                            onBlur={() => setRenamingId(null)}
                                                        />
                                                        <button type="submit" className="h-8 px-3 bg-foreground text-background text-[10px] uppercase tracking-widest font-bold hover:bg-primary transition-colors">
                                                            Save
                                                        </button>
                                                    </form>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="font-bold text-sm uppercase tracking-widest truncate">{persona.name}</h3>
                                                        <button
                                                            onClick={() => { setRenamingId(persona.id); setRenameValue(persona.name) }}
                                                            className="p-1 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Status + Default */}
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`rounded-none border-0 text-[8px] uppercase tracking-widest px-2 py-0.5
                                                        ${persona.status === 'ready' ? 'bg-green-500/10 text-green-600'
                                                            : persona.status === 'generating' ? 'bg-amber-500/10 text-amber-600'
                                                                : persona.status === 'failed' ? 'bg-red-500/10 text-red-600'
                                                                    : 'bg-foreground/5 text-muted-foreground'}`}>
                                                        {persona.status}
                                                    </Badge>
                                                    {persona.is_default && (
                                                        <Badge className="rounded-none border-0 bg-primary/10 text-primary text-[8px] uppercase tracking-widest px-2 py-0.5">
                                                            <Star className="w-2.5 h-2.5 mr-1" /> Default
                                                        </Badge>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-2 pt-2 border-t border-nimbus/50">
                                                    {!persona.is_default && persona.status === 'ready' && (
                                                        <button
                                                            onClick={() => handleSetDefault(persona.id)}
                                                            className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                                                        >
                                                            <Star className="w-3 h-3" /> Set Default
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeletePersona(persona.id)}
                                                        className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground hover:text-red-500 transition-colors flex items-center gap-1 ml-auto"
                                                    >
                                                        <Trash2 className="w-3 h-3" /> Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* New Identity Card */}
                                    {allPersonaSlots.length < 5 && (
                                        <Link href="/dashboard/onboard" className="block">
                                            <div className="border-2 border-dashed border-nimbus hover:border-primary transition-all duration-300 group cursor-pointer h-full min-h-[300px] flex flex-col items-center justify-center gap-4">
                                                <div className="w-16 h-16 border-2 border-dashed border-nimbus group-hover:border-primary flex items-center justify-center transition-colors">
                                                    <Plus className="w-7 h-7 text-nimbus group-hover:text-primary transition-colors" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">New Identity</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1">AI-Director or manual upload</p>
                                                </div>
                                            </div>
                                        </Link>
                                    )}
                                </div>
                            </motion.div>

                        ) : activeTab === 'try-on' ? (
                            /* ---- TRY ON TAB ---- */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-12">

                                {/* Identity Selector (compact dropdown) */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">01 / Identity</Label>
                                        <button
                                            onClick={() => setActiveTab('identities')}
                                            className="text-[10px] text-primary hover:text-foreground font-bold uppercase tracking-widest transition-colors"
                                        >
                                            Manage Identities
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                                        <select
                                            value={selectedPersonaId || ''}
                                            onChange={(e) => setSelectedPersonaId(e.target.value)}
                                            className="w-full h-12 pl-10 pr-10 bg-white/60 border border-nimbus text-foreground appearance-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm font-bold uppercase tracking-widest cursor-pointer"
                                        >
                                            {personaSlots.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name}{p.is_default ? ' (Default)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
                                    </div>
                                </div>

                                {/* Trend Alert Notification */}
                                {currentTrend && (
                                    <div className="mb-12">
                                        <LookOfTheDay trend={currentTrend} onApplyTrend={handleApplyTrend} />
                                    </div>
                                )}

                                {/* Step 2: Upload Clothing */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">02 / Garment</Label>
                                        <span className="text-[10px] text-muted-foreground italic font-serif">Upload flat-lay</span>
                                    </div>
                                    {renderUploadZone('garment', garmentPreview, garmentFileRef, Shirt, 'Upload Garment', 'High resolution flat-lay')}
                                </div>

                                {/* Try On Button */}
                                <div className="space-y-6 pt-8">
                                    <Button
                                        onClick={handleTryOn}
                                        disabled={!canTryOn}
                                        className={`w-full h-14 text-xs font-bold uppercase tracking-[0.2em] transition-all rounded-none ${canTryOn
                                            ? 'bg-foreground text-background hover:bg-primary shadow-xl hover:shadow-2xl'
                                            : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                            }`}
                                    >
                                        {tryOnLoading ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing Geometry...</>
                                        ) : (
                                            <>Generate Try-On <ArrowRight className="w-4 h-4 ml-2" /></>
                                        )}
                                    </Button>

                                    {tryOnError && (
                                        <div className="p-4 border-l-2 border-primary bg-primary/5">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Error</p>
                                            <p className="text-xs text-muted-foreground">{tryOnError}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Try-On Result */}
                                <AnimatePresence>
                                    {tryOnResult && (
                                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-12 border-t border-nimbus">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Result</Label>
                                                <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">Saved to Archive</Badge>
                                            </div>
                                            <div className="relative aspect-[3/4] bg-white p-4 shadow-2xl">
                                                <img src={tryOnResult} alt="Try-on result" className="w-full h-full object-contain" />
                                            </div>
                                            <Button
                                                onClick={() => {
                                                    setActiveTab('video')
                                                    const item = mediaLibrary.find(m => m.image_url === tryOnResult)
                                                    if (item) setSelectedMediaItem(item)
                                                }}
                                                className="w-full h-12 bg-white text-foreground border border-nimbus hover:bg-foreground hover:text-white rounded-none text-xs uppercase tracking-widest transition-colors"
                                            >
                                                Motion Process →
                                            </Button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        ) : activeTab === 'marketplace' ? (
                            /* ---- MARKETPLACE TAB ---- */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-12">
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">01 / Shopping</Label>
                                        <span className="text-[10px] text-muted-foreground italic font-serif">Powered by Oxylabs</span>
                                    </div>

                                    {/* Search Bar */}
                                    <form onSubmit={handleMarketplaceSearch} className="flex gap-2">
                                        <BespokeInput
                                            value={marketplaceQuery}
                                            onChange={(e) => setMarketplaceQuery(e.target.value)}
                                            placeholder="Search for Gucci, Prada, Hermès..."
                                            className="flex-1"
                                        />
                                        <Button type="submit" disabled={marketplaceLoading} className="h-10 rounded-none bg-foreground text-background">
                                            {marketplaceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                                        </Button>
                                    </form>

                                    {/* Wardrobe Categories Grid */}
                                    <div>
                                        <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-3 font-bold">Wardrobe Categories</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {[
                                                { slug: 'Shirts', icon: '👔' },
                                                { slug: 'Outerwear', icon: '🧥' },
                                                { slug: 'Dresses', icon: '👗' },
                                                { slug: 'Activewear', icon: '🏃' },
                                                { slug: 'Bags', icon: '👜' },
                                                { slug: 'Shoes', icon: '👟' },
                                                { slug: 'Accessories', icon: '⌚' },
                                                { slug: 'Swimwear', icon: '🩱' },
                                                { slug: 'Suits', icon: '🤵' },
                                                { slug: 'Knitwear', icon: '🧶' },
                                            ].map((cat) => (
                                                <button
                                                    key={cat.slug}
                                                    onClick={() => handleCategoryClick(cat.slug)}
                                                    className={`flex flex-col items-center gap-1.5 p-3 border transition-all hover:shadow-md
                                                        ${marketplaceCategory === cat.slug
                                                            ? 'bg-foreground text-background border-foreground shadow-lg'
                                                            : 'bg-white text-foreground border-nimbus hover:border-foreground'}`}
                                                >
                                                    <span className="text-lg">{cat.icon}</span>
                                                    <span className="text-[8px] uppercase tracking-widest font-bold">{cat.slug}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Trending Now Pills */}
                                    <div className="border-t border-nimbus/20 pt-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold">🔥 Trending Now</span>
                                            {trendsLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {trendKeywords.map((trend) => (
                                                <button
                                                    key={trend.keyword}
                                                    onClick={() => searchByTrend(trend.keyword)}
                                                    className="group flex items-center gap-1.5 px-3 py-1.5 bg-white border border-nimbus hover:border-foreground hover:shadow-sm transition-all"
                                                >
                                                    {trend.isRising && <span className="text-[10px]">📈</span>}
                                                    <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground group-hover:text-foreground">
                                                        {trend.keyword}
                                                    </span>
                                                    <span className="text-[8px] text-muted-foreground/60 font-mono">{trend.trafficVolume}</span>
                                                </button>
                                            ))}
                                            {trendKeywords.length === 0 && !trendsLoading && (
                                                <span className="text-[9px] text-muted-foreground italic font-serif">Loading trend data...</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Brand Quick Links */}
                                    <div className="flex items-center gap-4 border-t border-nimbus/20 pt-4 overflow-x-auto no-scrollbar">
                                        <span className="text-[9px] uppercase tracking-tighter text-muted-foreground whitespace-nowrap">Top Brands:</span>
                                        {['All', 'Hermès', 'Theory', 'Vince', 'Prada', 'Gucci'].map((brand) => (
                                            <button
                                                key={brand}
                                                onClick={() => setMarketplaceBrand(brand)}
                                                className={`text-[9px] uppercase tracking-[0.1em] whitespace-nowrap transition-colors
                                                    ${marketplaceBrand === brand ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                {brand}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Product Results Grid */}
                                <div className="space-y-6 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin">
                                    {marketplaceItems.length === 0 && !marketplaceLoading && (
                                        <div className="py-20 text-center border border-dashed border-nimbus">
                                            <Shirt className="w-6 h-6 text-nimbus mx-auto mb-4" />
                                            <p className="text-xs text-muted-foreground font-serif italic">Select a category or search to discover products.</p>
                                        </div>
                                    )}

                                    {marketplaceLoading && (
                                        <div className="py-20 text-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-4" />
                                            <p className="text-xs text-muted-foreground font-serif italic">Searching across retailers...</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        {marketplaceItems.map(item => (
                                            <div key={item.id} className="group relative bg-white border border-nimbus p-4 transition-all hover:shadow-xl">
                                                <div className="aspect-[3/4] overflow-hidden mb-4 relative bg-nimbus/5">
                                                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain" />
                                                    {item.authenticityGuaranteed && (
                                                        <Badge className="absolute top-2 left-2 bg-blue-500 text-white border-0 text-[8px] uppercase tracking-tighter">
                                                            <Check className="w-3 h-3 mr-1" /> Verified
                                                        </Badge>
                                                    )}
                                                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                                                        <Badge className="bg-stretch-limo text-white border-0 text-[8px] uppercase tracking-tighter">
                                                            {item.source === 'oxylabs' ? 'Shopping' : item.source}
                                                        </Badge>
                                                        {item.merchant && (
                                                            <Badge className="bg-white/90 text-foreground border border-nimbus/30 text-[7px] uppercase tracking-tighter">
                                                                {item.merchant}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="space-y-1 mb-4">
                                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest truncate">{item.brand || 'Luxury Item'}</p>
                                                    <p className="text-xs font-serif italic truncate">{item.title}</p>
                                                    <p className="text-xs font-bold font-mono">{item.currency} {item.price}</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <Button
                                                        onClick={async () => {
                                                            setVtoLoadingId(item.id)
                                                            try {
                                                                const res = await fetch('/api/marketplace-vto', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        image_url: item.imageUrl,
                                                                        product_url: item.affiliateUrl,
                                                                        title: item.title,
                                                                        brand: item.brand,
                                                                        price: item.price,
                                                                        currency: item.currency,
                                                                        category: item.category,
                                                                        trend_keyword: item.trendKeyword,
                                                                        is_trending: item.isTrending,
                                                                    }),
                                                                })
                                                                const data = await res.json()
                                                                if (data.primary_url) {
                                                                    setGarmentImageUrl(data.primary_url)
                                                                    setGarmentPreview(data.primary_url)
                                                                } else {
                                                                    setGarmentImageUrl(item.imageUrl)
                                                                    setGarmentPreview(item.imageUrl)
                                                                }
                                                                setActiveTab('try-on')
                                                            } catch {
                                                                setGarmentImageUrl(item.imageUrl)
                                                                setGarmentPreview(item.imageUrl)
                                                                setActiveTab('try-on')
                                                            } finally {
                                                                setVtoLoadingId(null)
                                                            }
                                                        }}
                                                        disabled={vtoLoadingId === item.id}
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full rounded-none text-[10px] uppercase tracking-widest h-8"
                                                    >
                                                        {vtoLoadingId === item.id ? (
                                                            <><Loader2 className="w-3 h-3 animate-spin mr-1" /> VTO...</>
                                                        ) : <><Shirt className="w-3 h-3 mr-1" /> Try On</>}
                                                    </Button>
                                                    <Button
                                                        onClick={async () => {
                                                            if (wardrobeAddedIds.has(item.id)) return
                                                            setWardrobeAddingId(item.id)
                                                            try {
                                                                const res = await fetch('/api/wardrobe', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        image_url: item.imageUrl,
                                                                        title: item.title,
                                                                        source: 'marketplace',
                                                                        affiliate_url: item.affiliateUrl,
                                                                    }),
                                                                })
                                                                if (res.ok) {
                                                                    setWardrobeAddedIds(prev => new Set(prev).add(item.id))
                                                                } else {
                                                                    const err = await res.json()
                                                                    alert(err.error || 'Failed to add to wardrobe')
                                                                }
                                                            } catch {
                                                                alert('Failed to add to wardrobe')
                                                            } finally {
                                                                setWardrobeAddingId(null)
                                                            }
                                                        }}
                                                        disabled={wardrobeAddingId === item.id || wardrobeAddedIds.has(item.id)}
                                                        variant="outline"
                                                        size="sm"
                                                        className={`w-full rounded-none text-[10px] uppercase tracking-widest h-8 ${wardrobeAddedIds.has(item.id)
                                                            ? 'bg-green-50 border-green-200 text-green-700'
                                                            : ''
                                                            }`}
                                                    >
                                                        {wardrobeAddedIds.has(item.id) ? (
                                                            <><Check className="w-3 h-3 mr-1" /> Saved</>
                                                        ) : wardrobeAddingId === item.id ? (
                                                            <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Adding...</>
                                                        ) : <><Plus className="w-3 h-3 mr-1" /> Wardrobe</>}
                                                    </Button>
                                                </div>
                                                <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                                                    <Button variant="ghost" size="sm" className="w-full rounded-none text-[10px] uppercase tracking-widest h-8 border border-nimbus hover:bg-nimbus/20">
                                                        View Original <ExternalLink className="w-3 h-3 ml-2" />
                                                    </Button>
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            /* ---- VIDEO TAB ---- */
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-12">
                                {/* Step 1: Pick from Media Library */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">01 / Select Asset</Label>
                                    </div>
                                    {mediaLibrary.length === 0 ? (
                                        <div className="py-20 text-center border border-dashed border-nimbus">
                                            <ImageIcon className="w-6 h-6 text-nimbus mx-auto mb-4" />
                                            <p className="text-xs text-muted-foreground font-serif italic">Archive empty.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 gap-4">
                                            {mediaLibrary.map(item => (
                                                <button key={item.id}
                                                    onClick={() => setSelectedMediaItem(item)}
                                                    className={`relative aspect-[3/4] transition-all bg-white p-2 shadow-sm hover:shadow-md ${selectedMediaItem?.id === item.id
                                                        ? 'ring-1 ring-primary shadow-lg scale-[1.02]'
                                                        : 'opacity-70 hover:opacity-100'
                                                        }`}
                                                >
                                                    <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Select Preset */}
                                <div className="space-y-6">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">02 / Motion Grade</Label>
                                    </div>
                                    <PresetGrid selectedPresetId={selectedPreset?.id || null} onSelect={setSelectedPreset} />
                                </div>

                                {/* Step 3: Format & Generate */}
                                <div className="space-y-8 pb-12">
                                    <div className="flex items-baseline justify-between border-b border-nimbus pb-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">03 / Output</Label>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest w-24">Aspect Ratio</span>
                                        <div className="flex gap-2">
                                            {(['9:16', '16:9', '1:1'] as const).map(ratio => (
                                                <button key={ratio} onClick={() => setAspectRatio(ratio)}
                                                    className={`text-[10px] border px-4 py-2 uppercase tracking-widest transition-all ${aspectRatio === ratio ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent text-muted-foreground border-nimbus hover:border-foreground'
                                                        }`}>
                                                    {ratio}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {videoLoading ? (
                                        <StatusPill status="rendering" />
                                    ) : (
                                        <Button onClick={handleGenerateVideo} disabled={!canGenerateVideo}
                                            className={`w-full h-14 text-xs font-bold uppercase tracking-[0.2em] transition-all rounded-none ${canGenerateVideo
                                                ? 'bg-foreground text-background hover:bg-primary shadow-xl hover:shadow-2xl'
                                                : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                                }`}>
                                            Generate Motion <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        )}


                        {activeTab === 'bounties' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-8">
                                <div className="space-y-2 border-b border-nimbus pb-8">
                                    <h2 className="font-serif text-3xl tracking-tight">Browse Bounties</h2>
                                    <p className="text-sm text-muted-foreground">Apply to brand campaigns and earn money creating content.</p>
                                </div>
                                <BountyFeed />
                            </motion.div>
                        )}

                        {activeTab === 'projects' && (
                            <ProjectsGrid />
                        )}
                    </div>
                </section>

                {/* ===== RIGHT: Archive (Gallery Masonry) ===== */}
                {activeTab !== 'marketplace' && activeTab !== 'showcase' && activeTab !== 'bounties' && activeTab !== 'projects' && (
                    <aside className="col-span-12 lg:col-span-7 bg-[#FBFBFB] flex flex-col overflow-hidden relative">
                        {/* Background Detail */}
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <h2 className="text-[120px] font-serif text-primary leading-none">
                                {activeTab === 'try-on' ? 'ARCHIVE' : 'CINEMA'}
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-12 lg:p-16 relative z-10">

                            {/* Asymmetrical Masonry Grid */}
                            <div className="columns-1 md:columns-2 gap-8 space-y-8 [&>div]:break-inside-avoid">

                                {/* Empty State */}
                                {((activeTab === 'try-on' && mediaLibrary.length === 0) || (activeTab === 'video' && videoJobs.length === 0)) && (
                                    <div className="h-full flex flex-col items-center justify-center py-32 text-center opacity-40">
                                        <div className="text-6xl mb-4 font-serif italic text-nimbus">Empty</div>
                                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Begin creation to populate archive</p>
                                    </div>
                                )}

                                {activeTab === 'try-on' ? (
                                    /* Try-on Masonry */
                                    mediaLibrary.map((item, i) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`relative group bg-white p-3 shadow-sm hover:shadow-xl transition-all duration-500
                                                ${i % 3 === 0 ? 'mt-12' : ''} /* Asymmetrical Stagger */
                                                ${i % 2 === 0 ? 'rotate-1' : '-rotate-1 hover:rotate-0'}
                                            `}
                                        >
                                            <div className="relative overflow-hidden aspect-[3/4] bg-[#f9f9f9]">
                                                <img src={item.image_url} alt="" className="w-full h-full object-contain mix-blend-multiply" />

                                                {/* Hover HUD */}
                                                <div className="absolute inset-0 bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                                    <Button variant="outline" size="sm"
                                                        onClick={() => { setActiveTab('video'); setSelectedMediaItem(item) }}
                                                        className="h-10 text-[10px] uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-white rounded-none">
                                                        Create Video
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="pt-3 flex justify-between items-center opacity-60">
                                                <span className="text-[9px] font-mono uppercase tracking-widest">NO. {item.id.slice(0, 4)}</span>
                                                <span className="text-[9px] font-serif italic">{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    /* Video Masonry */
                                    videoJobs.map((job, i) => (
                                        <motion.div
                                            key={job.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`relative group bg-white shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden
                                                ${i % 3 === 0 ? 'mb-12' : 'mb-0'} /* Asymmetrical Spacing */
                                            `}
                                        >
                                            <div className="relative aspect-video bg-[#000]">
                                                {job.output_url ? (
                                                    <video src={job.output_url} controls className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="text-center space-y-4">
                                                            <div className="w-8 h-8 rounded-none border-2 border-white/20 border-t-white animate-spin mx-auto" />
                                                            <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold animate-pulse">
                                                                {job.status === 'failed' ? 'Rendering Failed' : 'Rendering Cinema...'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-4 bg-white border-t border-nimbus/20">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Badge variant="outline" className={`text-[9px] h-5 border-0 rounded-none uppercase tracking-widest ${job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                        job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                            'bg-yellow-100 text-yellow-700'}`}>
                                                        {job.status}
                                                    </Badge>
                                                    <span className="text-[9px] text-muted-foreground font-mono">ID: {job.id.slice(0, 6)}</span>
                                                </div>

                                                {job.provider_metadata?.compute_savings && (
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 rounded-none text-[8px] uppercase tracking-tighter hover:bg-blue-50">
                                                            ⚡ {String(job.provider_metadata.compute_savings)} Saved
                                                        </Badge>
                                                    </div>
                                                )}

                                                {job.status === 'completed' && job.output_url && (
                                                    <div className="mt-4 pt-4 border-t border-nimbus/20 space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="flex items-center justify-between p-2 bg-primary/5 border border-primary/20">
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-bold uppercase tracking-widest text-primary">Enable Remixing</span>
                                                                <span className="text-[7px] text-muted-foreground uppercase leading-tight">Earn 5% bonus on adoption</span>
                                                            </div>
                                                            <button
                                                                onClick={() => setRemixEnabled(!remixEnabled)}
                                                                className={`w-8 h-4 rounded-full transition-colors relative ${remixEnabled ? 'bg-primary' : 'bg-nimbus'}`}
                                                            >
                                                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${remixEnabled ? 'right-0.5' : 'left-0.5'}`} />
                                                            </button>
                                                        </div>
                                                        <Button variant="ghost" size="sm"
                                                            className="w-full h-8 text-[10px] uppercase tracking-widest hover:bg-nimbus/20 rounded-none border border-nimbus"
                                                            onClick={async () => {
                                                                if (confirm("Publish to Community Showcase? This will share your look and video publicly.")) {
                                                                    // Core fields that always exist
                                                                    const insertData: any = {
                                                                        user_id: user?.id,
                                                                        video_url: job.output_url,
                                                                        persona_id: selectedPersonaId,
                                                                        garment_metadata: [{
                                                                            title: selectedMediaItem?.label || 'Designer Piece',
                                                                            imageUrl: selectedMediaItem?.garment_image_url || selectedMediaItem?.image_url
                                                                        }],
                                                                        ai_labeled: true,
                                                                    };
                                                                    // Viral columns (may not exist if migration not applied)
                                                                    if (remixEnabled !== undefined) insertData.allow_remix = remixEnabled;
                                                                    if (originalCreatorId) insertData.original_creator_id = originalCreatorId;
                                                                    if (originalShowcaseId) insertData.original_showcase_id = originalShowcaseId;

                                                                    let { error } = await supabase.from('public_showcase').insert(insertData);
                                                                    // If viral columns don't exist yet, retry without them
                                                                    if (error?.code === '42703') {
                                                                        console.log('[Dashboard] Viral columns not yet migrated, publishing without remix fields.');
                                                                        const { error: fallbackErr } = await supabase.from('public_showcase').insert({
                                                                            user_id: user?.id,
                                                                            video_url: job.output_url,
                                                                            persona_id: selectedPersonaId,
                                                                            garment_metadata: [{
                                                                                title: selectedMediaItem?.label || 'Designer Piece',
                                                                                imageUrl: selectedMediaItem?.garment_image_url || selectedMediaItem?.image_url
                                                                            }],
                                                                            ai_labeled: true,
                                                                        } as any);
                                                                        error = fallbackErr;
                                                                    }
                                                                    if (!error) alert("Published to Showcase!");
                                                                    else console.error('[Dashboard] Publish Error:', error);
                                                                }
                                                            }}>
                                                            <Globe className="w-3 h-3 mr-2" /> Publish to Showcase
                                                        </Button>
                                                        <Button variant="ghost" size="sm"
                                                            className="w-full h-8 text-[10px] uppercase tracking-widest hover:bg-nimbus/20 rounded-none border border-nimbus"
                                                            onClick={() => {
                                                                setExtensionJob(job)
                                                                setExtensionDialogOpen(true)
                                                            }}>
                                                            Extend Scene +7s
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </div>
                    </aside>
                )}
            </main>

            {/* Extension Dialog */}
            <Dialog open={extensionDialogOpen} onOpenChange={setExtensionDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-none border-primary bg-background p-8">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl text-primary">Extend Sequence</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="uppercase tracking-widest text-[10px] font-bold text-muted-foreground">Current Scene</Label>
                            <div className="aspect-video bg-black overflow-hidden relative">
                                {extensionJob && <video src={extensionJob.output_url!} className="w-full h-full object-cover opacity-50" />}
                            </div>
                        </div>
                        <BespokeInput
                            value={extensionPrompt}
                            onChange={(e) => setExtensionPrompt(e.target.value)}
                            label="Narrative Continuation (Prompt)"
                            placeholder="Describe what happens next..."
                        />
                    </div>
                    <DialogFooter className="sm:justify-between items-center gap-4">
                        <Button variant="ghost" onClick={() => setExtensionDialogOpen(false)} className="text-xs uppercase tracking-widest rounded-none">Cancel</Button>
                        <Button onClick={handleExtendVideo} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-widest rounded-none px-8 h-10">Run Extension</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Disclosure Modal (2026 Legal Shield) */}
            <Dialog open={disclosureOpen} onOpenChange={setDisclosureOpen}>
                <DialogContent className="sm:max-w-md rounded-none border-primary bg-background p-8">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl text-primary uppercase tracking-tighter">Legal Disclosure</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="p-4 bg-primary/5 border border-primary/20 space-y-4">
                            <p className="text-xs text-foreground leading-relaxed">
                                To comply with the 2026 EU AI Act and eBay/Skimlinks transient processing rules, you must acknowledge the following before downloading or sharing:
                            </p>
                            <ul className="text-[10px] space-y-2 list-disc pl-4 text-muted-foreground uppercase tracking-widest">
                                <li>I will include <span className="text-primary font-bold">#ad</span> in all captions.</li>
                                <li>I will include <span className="text-primary font-bold">#MadeWithAI</span> when posting these items.</li>
                                <li>I acknowledge this content is AI-simulated for virtual try-on.</li>
                            </ul>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => {
                                setDisclosureAccepted(true)
                                setDisclosureOpen(false)
                                alert("Disclosure accepted. Accessing 4K Lossless Vault...")
                            }}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs uppercase tracking-[0.2em] h-14 rounded-none shadow-xl"
                        >
                            I Acknowledge & Accept
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Credit Guardrail Modal — opens CreditShop when insufficient */}
            <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
                <DialogContent className="bg-paper border-nimbus/30 rounded-none shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl tracking-tight">Credits Required</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-red-700">Insufficient Balance</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    This generation requires <strong>{creditModalContext?.required ?? 0} credit(s)</strong> but you have <strong>{creditModalContext?.balance ?? 0}</strong>.
                                </p>
                            </div>
                            <CreditCard className="w-8 h-8 text-red-400 flex-shrink-0" />
                        </div>
                        <Button
                            onClick={() => { setCreditModalOpen(false); setCreditShopOpen(true) }}
                            className="w-full h-12 bg-primary text-white hover:bg-primary/90 rounded-none text-xs uppercase tracking-[0.2em] font-bold"
                        >
                            <Zap className="w-4 h-4 mr-2" /> Buy Credits
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Credit Shop (Stripe Checkout) */}
            <CreditShop
                open={creditShopOpen}
                onClose={() => setCreditShopOpen(false)}
                currentBalance={creditBalance}
            />

            {/* ── Safety Warning Dialog (Strike 1-2) ── */}
            <Dialog open={safetyWarningOpen} onOpenChange={setSafetyWarningOpen}>
                <DialogContent className="bg-paper border-nimbus shadow-2xl max-w-md">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-amber-100 border border-amber-200 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <DialogTitle className="font-serif text-xl">Safety Filter Triggered</DialogTitle>
                        </div>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {safetyWarningMsg || 'Your content was flagged by our safety filters. Please review our content guidelines before generating again.'}
                        </p>
                        <div className="p-3 bg-amber-50 border border-amber-200">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Strike Count</span>
                                <span className="text-sm font-bold text-amber-700">{strikeCount} / 3</span>
                            </div>
                            <div className="mt-2 h-1.5 bg-amber-100 overflow-hidden">
                                <div className="h-full bg-amber-500 transition-all" style={{ width: `${(strikeCount / 3) * 100}%` }} />
                            </div>
                            <p className="text-[10px] text-amber-600 mt-2">
                                {strikeCount === 1 ? 'First warning — please be mindful of content guidelines.' :
                                    strikeCount === 2 ? 'Second warning — one more strike will result in a 24-hour Cool-Down.' :
                                        'Review your content to avoid further escalation.'}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => setSafetyWarningOpen(false)}
                            className="w-full h-10 bg-foreground text-background hover:bg-primary text-[10px] uppercase tracking-widest font-bold rounded-none"
                        >
                            I Understand
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Cooldown Overlay (Strike 3 — 24h Ban) ── */}
            {
                accountStatus === 'cooldown' && cooldownUntil && new Date(cooldownUntil) > new Date() && (
                    <div className="fixed inset-0 z-[100] bg-paper/95 backdrop-blur-xl flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-md w-full text-center space-y-6"
                        >
                            <div className="w-16 h-16 bg-orange-100 border-2 border-orange-300 flex items-center justify-center mx-auto">
                                <ShieldAlert className="w-8 h-8 text-orange-600" />
                            </div>
                            <h2 className="font-serif text-3xl tracking-tight">Cool-Down Mode</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Your account has entered a 24-hour Cool-Down period due to repeated safety filter triggers.
                                All generation features are temporarily disabled.
                            </p>
                            <div className="p-5 bg-orange-50 border border-orange-200 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-orange-700 block">Generates re-enabled</span>
                                <span className="text-2xl font-serif text-orange-700">
                                    {new Date(cooldownUntil).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                If you believe this was an error, contact support
                            </p>
                        </motion.div>
                    </div>
                )
            }

            {/* ── Suspension Screen (Permanent Lock) ── */}
            {
                accountStatus === 'suspended' && (
                    <div className="fixed inset-0 z-[100] bg-paper/98 backdrop-blur-xl flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-md w-full text-center space-y-6"
                        >
                            <div className="w-16 h-16 bg-red-100 border-2 border-red-300 flex items-center justify-center mx-auto">
                                <ShieldAlert className="w-8 h-8 text-red-600" />
                            </div>
                            <h2 className="font-serif text-3xl tracking-tight text-red-800">Account Suspended</h2>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Your account has been permanently suspended due to repeated safety violations.
                                Any remaining credits have been refunded to your payment method.
                            </p>
                            <div className="p-4 bg-red-50 border border-red-200">
                                <p className="text-xs text-red-700">
                                    If you believe this was a mistake, please contact our support team for review.
                                </p>
                            </div>
                            <Button
                                onClick={async () => {
                                    await supabase.auth.signOut()
                                    window.location.href = '/login'
                                }}
                                className="h-10 bg-foreground text-background hover:bg-red-600 text-[10px] uppercase tracking-widest font-bold rounded-none"
                            >
                                Sign Out
                            </Button>
                        </motion.div>
                    </div>
                )
            }
            {/* ===== MOBILE BOTTOM TAB BAR ===== */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-xl border-t border-nimbus/50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
                <div className="flex items-center justify-around h-[64px]">
                    {[
                        { id: 'identities' as Tab, label: 'Identities', icon: UserCircle },
                        { id: 'try-on' as Tab, label: 'Try On', icon: Shirt },
                        { id: 'video' as Tab, label: 'Video', icon: Video },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors
                                ${activeTab === id ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">{label}</span>
                            {activeTab === id && <motion.div layoutId="mobileTab" className="absolute bottom-0 w-10 h-[2px] bg-primary" />}
                        </button>
                    ))}
                    <button
                        onClick={() => setDashMenuOpen(true)}
                        className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors
                            ${!['identities', 'try-on', 'video'].includes(activeTab) ? 'text-foreground' : 'text-muted-foreground'}`}
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-[9px] font-bold uppercase tracking-widest">More</span>
                        {!['identities', 'try-on', 'video'].includes(activeTab) && <motion.div layoutId="mobileTab" className="absolute bottom-0 w-10 h-[2px] bg-primary" />}
                    </button>
                </div>
            </nav>
        </div >
    )
}
