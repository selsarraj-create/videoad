"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Sparkles, ArrowLeft, User, Instagram, CreditCard, Zap,
    Check, Crown, Loader2, ExternalLink, LogOut, Save
} from "lucide-react"
import Link from "next/link"
import type { SubscriptionTier } from "@/lib/tier-config"

const TIER_DETAILS: Record<SubscriptionTier, {
    name: string
    price: string
    period: string
    features: string[]
    color: string
    bgColor: string
    borderColor: string
}> = {
    starter: {
        name: 'Starter',
        price: '$0',
        period: 'forever free',
        features: ['Virtual Try-On (3-pose)', '100% affiliate commission', 'Bring your own links', 'Basic video generation'],
        color: 'text-foreground',
        bgColor: 'bg-foreground/5',
        borderColor: 'border-foreground/20',
    },
    pro: {
        name: 'Pro Creator',
        price: '$10',
        period: '/month',
        features: ['Everything in Starter', 'Instagram DM automation', 'AI Sizing Bot', '7-day free trial'],
        color: 'text-primary',
        bgColor: 'bg-primary/5',
        borderColor: 'border-primary/20',
    },
    high_octane: {
        name: 'High-Octane',
        price: '$49',
        period: '/month',
        features: ['Everything in Pro', '20 credits/month', 'Priority rendering', 'Kling 3.0 Omni engine'],
        color: 'text-amber-600',
        bgColor: 'bg-amber-400/5',
        borderColor: 'border-amber-400/20',
    },
}

const TIER_ORDER: SubscriptionTier[] = ['starter', 'pro', 'high_octane']

export default function SettingsPage() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<string | null>(null)

    // Profile
    const [displayName, setDisplayName] = useState("")
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

    // Tier & Credits
    const [currentTier, setCurrentTier] = useState<SubscriptionTier>('starter')
    const [effectiveTier, setEffectiveTier] = useState<SubscriptionTier>('starter')
    const [trialActive, setTrialActive] = useState(false)
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
    const [creditBalance, setCreditBalance] = useState(0)
    const [monthlyGrant, setMonthlyGrant] = useState(0)

    // Instagram
    const [igConnected, setIgConnected] = useState(false)
    const [igUsername, setIgUsername] = useState<string | null>(null)

    const [activeSection, setActiveSection] = useState<'profile' | 'instagram' | 'billing'>('profile')

    const supabase = createClient()
    const router = useRouter()

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            // Get user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            setUser(user)

            // Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, avatar_url, subscription_status, trial_ends_at')
                .eq('id', user.id)
                .single()

            if (profile) {
                setDisplayName(profile.display_name || user.user_metadata?.full_name || '')
                setAvatarUrl(profile.avatar_url || user.user_metadata?.avatar_url || null)
                setCurrentTier((profile.subscription_status || 'starter') as SubscriptionTier)
            }

            // Credits
            const creditsRes = await fetch('/api/credits')
            if (creditsRes.ok) {
                const credits = await creditsRes.json()
                setEffectiveTier(credits.effectiveTier || 'starter')
                setTrialActive(credits.trialActive || false)
                setTrialEndsAt(credits.trialEndsAt || null)
                setCreditBalance(credits.balance || 0)
                setMonthlyGrant(credits.monthlyGrant || 0)
            }

            // Instagram
            const { data: igConn } = await supabase
                .from('instagram_connections')
                .select('ig_username')
                .eq('user_id', user.id)
                .single()

            if (igConn) {
                setIgConnected(true)
                setIgUsername(igConn.ig_username)
            }
        } catch (err) {
            console.error('Settings fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [router, supabase])

    useEffect(() => { fetchData() }, [])

    const handleSaveProfile = async () => {
        if (!user) return
        setSaving(true)
        setSaveStatus(null)

        const { error } = await supabase
            .from('profiles')
            .update({ display_name: displayName })
            .eq('id', user.id)

        if (error) {
            setSaveStatus('Failed to save')
        } else {
            setSaveStatus('Saved!')
            setTimeout(() => setSaveStatus(null), 2000)
        }
        setSaving(false)
    }

    const handleTierChange = async (newTier: SubscriptionTier) => {
        if (newTier === currentTier) return
        // In production, this would redirect to a Stripe checkout/portal
        // For now, update the profile directly
        if (!user) return
        setSaving(true)

        const now = new Date()
        const trialEnd = newTier === 'pro' && currentTier === 'starter'
            ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : null

        const { error } = await supabase
            .from('profiles')
            .update({
                subscription_status: newTier,
                trial_ends_at: trialEnd,
                monthly_credit_grant: newTier === 'high_octane' ? 20 : 0,
                render_priority: newTier === 'high_octane' ? 1 : newTier === 'pro' ? 2 : 3,
            })
            .eq('id', user.id)

        if (!error) {
            setCurrentTier(newTier)
            setSaveStatus(`Switched to ${TIER_DETAILS[newTier].name}!`)
            setTimeout(() => setSaveStatus(null), 3000)
            // Refetch credits
            const creditsRes = await fetch('/api/credits')
            if (creditsRes.ok) {
                const credits = await creditsRes.json()
                setEffectiveTier(credits.effectiveTier || newTier)
                setTrialActive(credits.trialActive || false)
                setCreditBalance(credits.balance || 0)
                setMonthlyGrant(credits.monthlyGrant || 0)
            }
        }
        setSaving(false)
    }

    const handleInstagramConnect = () => {
        // Redirect to Meta OAuth flow
        window.location.href = '/api/instagram/auth'
    }

    const sections = [
        { id: 'profile' as const, label: 'Profile', icon: User },
        { id: 'instagram' as const, label: 'Instagram', icon: Instagram },
        { id: 'billing' as const, label: 'Billing', icon: CreditCard },
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-paper text-foreground font-sans selection:bg-primary/20">
            {/* Header */}
            <header className="h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Back to Studio</span>
                    </Link>
                    <div className="h-5 w-px bg-nimbus/30" />
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <h1 className="font-serif text-xl tracking-tight">
                            Account<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">SETTINGS</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-foreground/5 border border-nimbus/20 px-3 py-1.5">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{creditBalance} CR</span>
                    </div>
                    <div className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest
                        ${currentTier === 'high_octane' ? 'bg-amber-500/10 text-amber-600 border border-amber-200'
                            : currentTier === 'pro' || trialActive ? 'bg-primary/10 text-primary border border-primary/20'
                                : 'bg-foreground/5 text-muted-foreground border border-nimbus/20'}`}>
                        {trialActive ? 'Trial' : TIER_DETAILS[currentTier].name}
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto p-8 lg:p-12">
                <div className="flex gap-12">
                    {/* Sidebar */}
                    <nav className="w-56 flex-shrink-0 space-y-1">
                        {sections.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                onClick={() => setActiveSection(id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200
                                    ${activeSection === id
                                        ? 'bg-foreground text-background font-bold'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="text-xs uppercase tracking-widest">{label}</span>
                            </button>
                        ))}

                        <div className="pt-6">
                            <button
                                onClick={async () => {
                                    await supabase.auth.signOut()
                                    router.push('/login')
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-red-500 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="text-xs uppercase tracking-widest">Sign Out</span>
                            </button>
                        </div>
                    </nav>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {/* ── PROFILE SECTION ── */}
                            {activeSection === 'profile' && (
                                <div className="space-y-8">
                                    <div className="border-b border-nimbus pb-4">
                                        <h2 className="font-serif text-2xl tracking-tight">Profile</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Manage your personal information</p>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Avatar */}
                                        <div className="flex items-center gap-6">
                                            <div className="w-20 h-20 bg-nimbus/30 border border-nimbus/20 flex items-center justify-center overflow-hidden">
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User className="w-8 h-8 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold">{displayName || 'No name set'}</p>
                                                <p className="text-xs text-muted-foreground">{user?.email}</p>
                                            </div>
                                        </div>

                                        {/* Name */}
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                                                Display Name
                                            </Label>
                                            <input
                                                type="text"
                                                value={displayName}
                                                onChange={e => setDisplayName(e.target.value)}
                                                placeholder="Your name"
                                                className="w-full max-w-md h-12 px-4 bg-white/60 border border-nimbus text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                                            />
                                        </div>

                                        {/* Email */}
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                                                Email
                                            </Label>
                                            <div className="flex items-center gap-3 max-w-md">
                                                <input
                                                    type="email"
                                                    value={user?.email || ''}
                                                    disabled
                                                    className="flex-1 h-12 px-4 bg-nimbus/10 border border-nimbus text-muted-foreground text-sm cursor-not-allowed"
                                                />
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">Contact support to change your email</p>
                                        </div>

                                        <div className="flex items-center gap-3 pt-4">
                                            <Button
                                                onClick={handleSaveProfile}
                                                disabled={saving}
                                                className="h-10 bg-foreground text-background hover:bg-primary text-[10px] uppercase tracking-widest font-bold rounded-none transition-all"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3 h-3 mr-2" /> Save Changes</>}
                                            </Button>
                                            {saveStatus && (
                                                <span className="text-[10px] text-primary font-bold uppercase tracking-widest animate-pulse">{saveStatus}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── INSTAGRAM SECTION ── */}
                            {activeSection === 'instagram' && (
                                <div className="space-y-8">
                                    <div className="border-b border-nimbus pb-4">
                                        <h2 className="font-serif text-2xl tracking-tight">Instagram Connection</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Link your Instagram account for DM automation</p>
                                    </div>

                                    <div className="space-y-6">
                                        {igConnected ? (
                                            <div className="p-6 border border-green-200 bg-green-50 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 bg-green-500 rounded-full" />
                                                    <span className="text-xs font-bold uppercase tracking-widest text-green-700">Connected</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Instagram className="w-5 h-5 text-foreground" />
                                                    <span className="text-lg font-serif">@{igUsername}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Your Instagram Business account is linked. DM automation is {
                                                        effectiveTier === 'starter' ? 'available with Pro tier' : 'active'
                                                    }.
                                                </p>
                                                {effectiveTier === 'starter' && (
                                                    <div className="p-4 bg-primary/5 border border-primary/20 mt-4">
                                                        <p className="text-xs text-muted-foreground">
                                                            <Zap className="w-3 h-3 inline mr-1 text-primary" />
                                                            Upgrade to Pro to enable automatic DM responses when followers comment with trigger keywords.
                                                        </p>
                                                        <Button
                                                            onClick={() => setActiveSection('billing')}
                                                            className="mt-2 h-8 bg-primary text-primary-foreground text-[10px] uppercase tracking-widest font-bold rounded-none"
                                                        >
                                                            View Plans
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-8 border border-dashed border-nimbus space-y-4 text-center">
                                                <Instagram className="w-8 h-8 text-muted-foreground mx-auto" />
                                                <div>
                                                    <p className="text-sm font-bold">Connect Instagram</p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Link your Instagram Business account to enable affiliate DM automation.
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={handleInstagramConnect}
                                                    className="h-12 bg-foreground text-background hover:bg-primary text-[10px] uppercase tracking-widest font-bold rounded-none transition-all"
                                                >
                                                    <Instagram className="w-4 h-4 mr-2" />
                                                    Connect via Meta
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── BILLING SECTION ── */}
                            {activeSection === 'billing' && (
                                <div className="space-y-8">
                                    <div className="border-b border-nimbus pb-4">
                                        <h2 className="font-serif text-2xl tracking-tight">Billing & Subscription</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Manage your plan and credits</p>
                                    </div>

                                    {/* Current Plan */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Current Plan</Label>
                                        <div className={`p-6 border-2 ${TIER_DETAILS[currentTier].borderColor} ${TIER_DETAILS[currentTier].bgColor} space-y-3`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {currentTier === 'high_octane' ? <Crown className="w-5 h-5 text-amber-500" /> :
                                                        currentTier === 'pro' ? <Zap className="w-5 h-5 text-primary" /> :
                                                            <Sparkles className="w-5 h-5" />}
                                                    <span className={`text-lg font-bold ${TIER_DETAILS[currentTier].color}`}>
                                                        {TIER_DETAILS[currentTier].name}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-2xl font-serif">{TIER_DETAILS[currentTier].price}</span>
                                                    <span className="text-[10px] text-muted-foreground ml-1">{TIER_DETAILS[currentTier].period}</span>
                                                </div>
                                            </div>
                                            {trialActive && trialEndsAt && (
                                                <div className="p-3 bg-primary/10 border border-primary/20">
                                                    <p className="text-xs text-primary font-bold">
                                                        <Zap className="w-3 h-3 inline mr-1" />
                                                        Trial active — ends {new Date(trialEndsAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Credits Overview */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Credits</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-5 border border-nimbus/20 bg-white">
                                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Balance</span>
                                                <span className="text-3xl font-serif">{creditBalance}</span>
                                                <span className="text-xs text-muted-foreground ml-1">credits</span>
                                            </div>
                                            <div className="p-5 border border-nimbus/20 bg-white">
                                                <span className="text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Monthly Grant</span>
                                                <span className="text-3xl font-serif">{monthlyGrant}</span>
                                                <span className="text-xs text-muted-foreground ml-1">/ month</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Plan Comparison / Change */}
                                    <div className="space-y-4">
                                        <Label className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
                                            {currentTier === 'high_octane' ? 'Downgrade Plan' : 'Upgrade Plan'}
                                        </Label>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {TIER_ORDER.map((tierId) => {
                                                const tier = TIER_DETAILS[tierId]
                                                const isCurrent = tierId === currentTier
                                                const currentIdx = TIER_ORDER.indexOf(currentTier)
                                                const tierIdx = TIER_ORDER.indexOf(tierId)
                                                const isUpgrade = tierIdx > currentIdx
                                                const isDowngrade = tierIdx < currentIdx

                                                return (
                                                    <div
                                                        key={tierId}
                                                        className={`p-5 border-2 space-y-4 transition-all duration-300
                                                            ${isCurrent
                                                                ? `${tier.borderColor} ${tier.bgColor} ring-2 ring-offset-2 ${tierId === 'high_octane' ? 'ring-amber-400' : tierId === 'pro' ? 'ring-primary' : 'ring-foreground/20'}`
                                                                : 'border-nimbus/20 hover:border-nimbus/40'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-bold uppercase tracking-widest">{tier.name}</span>
                                                            {isCurrent && (
                                                                <span className="text-[8px] font-bold uppercase tracking-widest bg-foreground text-background px-2 py-0.5">Current</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-xl font-serif">{tier.price}</span>
                                                            <span className="text-[10px] text-muted-foreground ml-1">{tier.period}</span>
                                                        </div>
                                                        <ul className="space-y-1.5">
                                                            {tier.features.map((feat, i) => (
                                                                <li key={i} className="flex items-start gap-2">
                                                                    <Check className={`w-3 h-3 mt-0.5 flex-shrink-0 ${isCurrent ? tier.color : 'text-nimbus'}`} />
                                                                    <span className="text-[11px] text-muted-foreground leading-tight">{feat}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        {!isCurrent && (
                                                            <Button
                                                                onClick={() => handleTierChange(tierId)}
                                                                disabled={saving}
                                                                className={`w-full h-10 text-[10px] uppercase tracking-widest font-bold rounded-none transition-all
                                                                    ${isUpgrade
                                                                        ? tierId === 'high_octane'
                                                                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                                                                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                                        : 'bg-nimbus/20 text-muted-foreground hover:bg-nimbus/30'
                                                                    }`}
                                                            >
                                                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                                                    isUpgrade
                                                                        ? tierId === 'pro' && currentTier === 'starter' ? 'Start Free Trial' : `Upgrade to ${tier.name}`
                                                                        : `Downgrade to ${tier.name}`
                                                                }
                                                            </Button>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Save status */}
                                    {saveStatus && (
                                        <div className="p-4 border-l-2 border-primary bg-primary/5">
                                            <p className="text-xs text-primary font-bold uppercase tracking-widest">{saveStatus}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    )
}
