"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Megaphone, PoundSterling, Calendar, Sparkles, Building2, ChevronRight, Send, Loader2, AlertCircle, Check } from "lucide-react"
import { Button } from "./ui/button"

interface BountyItem {
    id: string
    title: string
    description: string | null
    budget_gbp: number
    deadline: string | null
    status: string
    created_at: string
    brands?: { company_name: string; logo_url: string | null }
    my_submission_status: string | null
}

export function BountyFeed() {
    const [bounties, setBounties] = useState<BountyItem[]>([])
    const [loading, setLoading] = useState(true)
    const [submittingTo, setSubmittingTo] = useState<string | null>(null)

    const fetchBounties = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/bounties')
            if (res.ok) {
                const { data } = await res.json()
                setBounties(data || [])
            }
        } catch (err) {
            console.error('Failed to load bounties:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchBounties()
    }, [fetchBounties])

    const handleApply = async (bountyId: string) => {
        setSubmittingTo(bountyId)
        try {
            const res = await fetch(`/api/bounties/${bountyId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'I would like to participate in this campaign.' }),
            })

            if (res.ok) {
                setBounties(prev => prev.map(b =>
                    b.id === bountyId ? { ...b, my_submission_status: 'pending' } : b
                ))
            } else {
                const data = await res.json()
                if (res.status === 409) {
                    setBounties(prev => prev.map(b =>
                        b.id === bountyId ? { ...b, my_submission_status: 'pending' } : b
                    ))
                } else {
                    console.error('Submit error:', data.error)
                }
            }
        } catch (err) {
            console.error('Submit error:', err)
        } finally {
            setSubmittingTo(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </div>
        )
    }

    if (bounties.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-40 text-center">
                <Megaphone className="w-12 h-12 text-primary/20 mb-4" />
                <h3 className="font-serif text-2xl mb-2">No Active Bounties</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                    Check back soon — brands are posting new campaigns regularly.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {bounties.map((bounty, idx) => (
                <motion.div
                    key={bounty.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white border border-nimbus/40 p-6 hover:shadow-lg transition-shadow"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            {/* Brand */}
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-6 h-6 bg-primary/10 flex items-center justify-center">
                                    <Building2 className="w-3 h-3 text-primary" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    {bounty.brands?.company_name || 'Brand'}
                                </span>
                            </div>

                            <h3 className="font-bold text-base mb-1">{bounty.title}</h3>
                            {bounty.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{bounty.description}</p>
                            )}

                            {/* Meta */}
                            <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center gap-1.5">
                                    <PoundSterling className="w-3 h-3 text-emerald-600" />
                                    <span className="text-xs font-bold font-mono">£{bounty.budget_gbp}</span>
                                </div>
                                {bounty.deadline && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(bounty.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action */}
                        <div className="shrink-0">
                            {bounty.my_submission_status === 'accepted' ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-2">
                                    <Check className="w-3 h-3" /> Accepted
                                </span>
                            ) : bounty.my_submission_status === 'pending' ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2">
                                    <Loader2 className="w-3 h-3" /> Applied
                                </span>
                            ) : bounty.my_submission_status === 'rejected' ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-600 bg-red-50 border border-red-200 px-3 py-2">
                                    <AlertCircle className="w-3 h-3" /> Not Selected
                                </span>
                            ) : (
                                <Button
                                    onClick={() => handleApply(bounty.id)}
                                    disabled={!!submittingTo}
                                    className="h-10 bg-foreground text-white hover:bg-foreground/90 rounded-none text-[10px] uppercase tracking-[0.15em] font-bold px-5"
                                >
                                    {submittingTo === bounty.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <><Send className="w-3.5 h-3.5 mr-2" /> Apply</>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}
