"use client"

import { motion } from "framer-motion"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts"
import { DollarSign, TrendingUp } from "lucide-react"

interface TokenEconomyProps {
    totalCost24h: number
    monthlyProjection: number
    byModel: Record<string, { count: number; cost: number }>
    byUser: { user_id: string; count: number; cost: number }[]
    budgetLimit?: number
}

const MODEL_COLORS: Record<string, string> = {
    "veo-3.1-fast": "#06b6d4",
    "veo-3.1": "#8b5cf6",
    "veo-3.1-ultra": "#f59e0b",
    "kling-1.5": "#10b981",
    "kling-2.0": "#ec4899",
    default: "#6b7280",
}

export function TokenEconomy({
    totalCost24h,
    monthlyProjection,
    byModel,
    byUser,
    budgetLimit = 500,
}: TokenEconomyProps) {
    const modelData = Object.entries(byModel).map(([model, data]) => ({
        name: model,
        cost: Number(data.cost.toFixed(2)),
        count: data.count,
    }))

    const overBudget = monthlyProjection > budgetLimit

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium">
                    Token Economy
                </h3>
                {overBudget && (
                    <motion.div
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full"
                    >
                        <DollarSign className="w-3 h-3" />
                        Over budget
                    </motion.div>
                )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.04] rounded-xl p-3">
                    <div className="text-[10px] text-white/40 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        24h Spend
                    </div>
                    <span className="text-lg font-light text-white/90 tabular-nums">
                        ${totalCost24h.toFixed(2)}
                    </span>
                </div>
                <div className={`rounded-xl p-3 ${overBudget ? "bg-amber-500/10" : "bg-white/[0.04]"}`}>
                    <div className="text-[10px] text-white/40 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Monthly Proj.
                    </div>
                    <span className={`text-lg font-light tabular-nums ${overBudget ? "text-amber-400" : "text-white/90"
                        }`}>
                        ${monthlyProjection.toFixed(0)}
                    </span>
                    <span className="text-[9px] text-white/30 ml-1">/ ${budgetLimit}</span>
                </div>
            </div>

            {/* Cost by model bar chart */}
            {modelData.length > 0 && (
                <div className="h-32 mb-3">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={modelData} layout="vertical" margin={{ left: 60, right: 10 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                                axisLine={false}
                                tickLine={false}
                                width={55}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: "rgba(0,0,0,0.85)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: "8px",
                                    fontSize: 11,
                                    color: "#fff",
                                }}
                                formatter={(value: number | undefined) => [`$${value ?? 0}`, "Cost"]}
                            />
                            <Bar dataKey="cost" radius={[0, 6, 6, 0]} barSize={14}>
                                {modelData.map((entry) => (
                                    <Cell
                                        key={entry.name}
                                        fill={MODEL_COLORS[entry.name] || MODEL_COLORS.default}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Top users */}
            {byUser.length > 0 && (
                <div>
                    <div className="text-[10px] text-white/30 mb-1.5">Top Users by Spend</div>
                    <div className="space-y-1">
                        {byUser.slice(0, 3).map((user, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px]">
                                <span className="text-white/50 font-mono">{user.user_id}</span>
                                <span className="text-white/70 tabular-nums">
                                    ${user.cost.toFixed(2)} · {user.count} jobs
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    )
}
