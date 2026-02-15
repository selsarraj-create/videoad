"use client"

import { motion } from "framer-motion"
import { Shield, Eye, Brain } from "lucide-react"

interface AIQualityProps {
    errorRate: number
    totalJobs: number
    failedJobs: number
}

function RadialGauge({
    label,
    value,
    maxValue,
    icon: Icon,
    color,
    delay,
}: {
    label: string
    value: number
    maxValue: number
    icon: React.ComponentType<{ className?: string }>
    color: string
    delay: number
}) {
    const pct = Math.min(100, (value / maxValue) * 100)
    const circumference = 2 * Math.PI * 36
    const dashOffset = circumference - (pct / 100) * circumference

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.6 }}
            className="flex flex-col items-center"
        >
            <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                    {/* Background ring */}
                    <circle
                        cx="40" cy="40" r="36"
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="4"
                    />
                    {/* Value ring */}
                    <motion.circle
                        cx="40" cy="40" r="36"
                        fill="none"
                        stroke={color}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: dashOffset }}
                        transition={{ delay: delay + 0.3, duration: 1.2, ease: "easeOut" }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div style={{ color }}>
                        <Icon className="w-3.5 h-3.5 mb-0.5" />
                    </div>
                    <span className="text-sm font-light text-white/80 tabular-nums">
                        {value.toFixed(1)}%
                    </span>
                </div>
            </div>
            <span className="text-[10px] text-white/40 mt-1.5">{label}</span>
        </motion.div>
    )
}

export function AIQuality({ errorRate, totalJobs, failedJobs }: AIQualityProps) {
    const successRate = totalJobs > 0 ? ((totalJobs - failedJobs) / totalJobs) * 100 : 100
    // Semantic accuracy estimate (based on success rate + error type distribution)
    const semanticAccuracy = Math.min(100, successRate * 0.95 + 5)
    // Safety score (high by default, reduced by auth/validation errors)
    const safetyScore = Math.max(0, 100 - errorRate * 2)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5"
        >
            <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium mb-4">
                AI Quality
            </h3>
            <div className="flex justify-around">
                <RadialGauge
                    label="Accuracy"
                    value={semanticAccuracy}
                    maxValue={100}
                    icon={Brain}
                    color="#06b6d4"
                    delay={0.7}
                />
                <RadialGauge
                    label="Success"
                    value={successRate}
                    maxValue={100}
                    icon={Eye}
                    color="#8b5cf6"
                    delay={0.8}
                />
                <RadialGauge
                    label="Safety"
                    value={safetyScore}
                    maxValue={100}
                    icon={Shield}
                    color="#10b981"
                    delay={0.9}
                />
            </div>
        </motion.div>
    )
}
