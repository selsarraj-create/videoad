"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Zap, AlertCircle } from "lucide-react"

interface CreditBadgeProps {
    cost: number
    balance: number
}

export function CreditBadge({ cost, balance }: CreditBadgeProps) {
    const isOverBudget = cost > balance

    return (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300 ${isOverBudget ? 'bg-red-950/30 border-red-900/50' : 'bg-zinc-900/50 border-zinc-800'}`}>
            <div className="flex flex-col items-end leading-none">
                <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isOverBudget ? 'text-red-400' : 'text-zinc-500'}`}>
                    {isOverBudget ? 'Insufficient Funds' : 'Est. Cost'}
                </span>

                <div className="flex items-center gap-1.5 overflow-hidden h-5">
                    <AnimatePresence mode="popLayout">
                        <motion.span
                            key={cost}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={`text-lg font-black font-mono ${isOverBudget ? 'text-red-500' : 'text-white'}`}
                        >
                            {cost}
                        </motion.span>
                    </AnimatePresence>
                    <span className={`text-xs font-bold ${isOverBudget ? 'text-red-500/70' : 'text-zinc-600'}`}>CR</span>
                    <span className={`text-[10px] font-mono ${isOverBudget ? 'text-red-500/50' : 'text-zinc-500'}`}>
                        (${(cost * 0.005).toFixed(2)})
                    </span>
                </div>
            </div>

            <div className="h-8 w-[1px] bg-white/5 mx-1" />

            <motion.div
                animate={isOverBudget ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: isOverBudget ? Infinity : 0, duration: 2 }}
            >
                {isOverBudget ? (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                ) : (
                    <Zap className="w-5 h-5 text-blue-500 fill-blue-500/20" />
                )}
            </motion.div>
        </div>
    )
}
