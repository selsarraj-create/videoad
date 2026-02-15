"use client"

import { motion } from "framer-motion"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { AlertCircle } from "lucide-react"

interface ErrorBreakdownProps {
    byType: Record<string, number>
    recent: { message: string; model: string; time: string }[]
    totalErrors: number
    errorRate: number
}

const COLORS = ["#f43f5e", "#f59e0b", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899"]

export function ErrorBreakdown({ byType, recent, totalErrors, errorRate }: ErrorBreakdownProps) {
    const pieData = Object.entries(byType).map(([name, value]) => ({ name, value }))

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium">
                    Error Breakdown
                </h3>
                {errorRate > 5 && (
                    <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="flex items-center gap-1 text-xs text-rose-400"
                    >
                        <AlertCircle className="w-3 h-3" />
                        Spike
                    </motion.div>
                )}
            </div>

            <div className="flex gap-4">
                {/* Donut */}
                <div className="w-28 h-28 flex-shrink-0 relative">
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={28}
                                    outerRadius={44}
                                    paddingAngle={3}
                                    dataKey="value"
                                    strokeWidth={0}
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        background: "rgba(0,0,0,0.85)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        fontSize: 11,
                                        color: "#fff",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-white/20 text-xs">
                            No errors
                        </div>
                    )}
                    {/* Center stat */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-light text-white/80 tabular-nums">{totalErrors}</span>
                        <span className="text-[9px] text-white/30">total</span>
                    </div>
                </div>

                {/* Legend + recent */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                        {pieData.map((entry, i) => (
                            <span key={entry.name} className="flex items-center gap-1 text-[10px] text-white/50">
                                <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: COLORS[i % COLORS.length] }}
                                />
                                {entry.name} ({entry.value})
                            </span>
                        ))}
                    </div>

                    {/* Recent errors */}
                    <div className="space-y-1.5 max-h-20 overflow-y-auto">
                        {recent.slice(0, 3).map((err, i) => (
                            <div key={i} className="text-[10px] text-white/30 truncate">
                                <span className="text-white/50">{err.model}</span>
                                {" · "}
                                {err.message}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}
