"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, X, Loader2, Sparkles, Check, Crown } from "lucide-react"
import { Button } from "./ui/button"
import { CREDIT_PACKS } from "@/lib/credit-router"

interface CreditShopProps {
    open: boolean
    onClose: () => void
    currentBalance: number
}

export function CreditShop({ open, onClose, currentBalance }: CreditShopProps) {
    const [purchasing, setPurchasing] = useState<string | null>(null)

    const handlePurchase = async (packId: string) => {
        setPurchasing(packId)
        try {
            const res = await fetch('/api/credits/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packId }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Checkout failed')
            }

            const { url } = await res.json()
            if (url) window.location.href = url
        } catch (err) {
            console.error('Purchase error:', err)
            setPurchasing(null)
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg z-50"
                    >
                        <div className="bg-white border border-nimbus/40 shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="p-6 pb-4 flex items-center justify-between border-b border-nimbus/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Zap className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h2 className="font-serif text-xl tracking-tight">Credit Shop</h2>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Balance: <span className="font-bold text-foreground">{currentBalance}</span> credits
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-nimbus/20 transition-colors rounded-full"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Credit Packs */}
                            <div className="p-6 space-y-3">
                                {CREDIT_PACKS.map((pack, idx) => {
                                    const isBestValue = pack.id === 'pack-100'
                                    const isPopular = pack.id === 'pack-25'
                                    const priceDisplay = `£${(pack.priceGBP / 100).toFixed(0)}`
                                    const perCredit = `£${(pack.priceGBP / 100 / pack.credits).toFixed(2)}/cr`
                                    const isPurchasing = purchasing === pack.id

                                    return (
                                        <motion.button
                                            key={pack.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                            onClick={() => handlePurchase(pack.id)}
                                            disabled={!!purchasing}
                                            className={`
                                                w-full flex items-center gap-4 p-4 border transition-all duration-300 text-left group
                                                ${isBestValue
                                                    ? 'border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60'
                                                    : 'border-nimbus/30 hover:border-nimbus/60 hover:bg-nimbus/10'
                                                }
                                                ${isPurchasing ? 'opacity-80' : ''}
                                                disabled:cursor-not-allowed
                                            `}
                                        >
                                            {/* Credit amount */}
                                            <div className={`
                                                w-14 h-14 flex flex-col items-center justify-center shrink-0 border
                                                ${isBestValue
                                                    ? 'bg-primary/10 border-primary/30'
                                                    : 'bg-nimbus/20 border-nimbus/30'
                                                }
                                            `}>
                                                <span className={`text-lg font-black font-mono leading-none ${isBestValue ? 'text-primary' : 'text-foreground'}`}>
                                                    {pack.credits}
                                                </span>
                                                <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">CR</span>
                                            </div>

                                            {/* Pack details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">{pack.label}</span>
                                                    {isBestValue && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 flex items-center gap-1">
                                                            <Crown className="w-2.5 h-2.5" /> Best Value
                                                        </span>
                                                    )}
                                                    {isPopular && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-foreground bg-nimbus/40 px-2 py-0.5 flex items-center gap-1">
                                                            <Sparkles className="w-2.5 h-2.5" /> Popular
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground">{perCredit}</span>
                                            </div>

                                            {/* Price / CTA */}
                                            <div className="shrink-0 flex items-center gap-2">
                                                {isPurchasing ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                                ) : (
                                                    <span className={`text-lg font-black ${isBestValue ? 'text-primary' : 'text-foreground'}`}>
                                                        {priceDisplay}
                                                    </span>
                                                )}
                                            </div>
                                        </motion.button>
                                    )
                                })}
                            </div>

                            {/* Footer */}
                            <div className="px-6 pb-6 pt-2">
                                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                                    Payments processed securely by Stripe. Credits are non-refundable and never expire.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
