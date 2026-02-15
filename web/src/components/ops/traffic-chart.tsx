"use client"

import { motion } from "framer-motion"
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts"

interface TrafficChartProps {
    data: { hour: string; total: number; failed: number }[]
}

export function TrafficChart({ data }: TrafficChartProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium">
                    Traffic · Last 24h
                </h3>
                <div className="flex items-center gap-4 text-[10px] text-white/40">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        Total
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        Failed
                    </span>
                </div>
            </div>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                background: "rgba(0,0,0,0.85)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: "12px",
                                fontSize: 12,
                                color: "#fff",
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="total"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            fill="url(#totalGrad)"
                        />
                        <Area
                            type="monotone"
                            dataKey="failed"
                            stroke="#f43f5e"
                            strokeWidth={1.5}
                            fill="url(#failedGrad)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    )
}
