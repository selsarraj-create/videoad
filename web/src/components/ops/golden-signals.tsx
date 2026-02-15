"use client"

import { motion } from "framer-motion"
import {
    Activity, Zap, AlertTriangle, Gauge
} from "lucide-react"

interface GoldenSignalsProps {
    latencyAvg: number
    latencyP95: number
    trafficRpm: number
    errorRate: number
    saturation: {
        queue_depth: number
        processing: number
        active_fallback: number
    }
}

function getStatusColor(value: number, thresholds: [number, number]) {
    if (value <= thresholds[0]) return "text-cyan-400"
    if (value <= thresholds[1]) return "text-amber-400"
    return "text-rose-400"
}

function getStatusGlow(value: number, thresholds: [number, number]) {
    if (value <= thresholds[0]) return "shadow-cyan-500/20"
    if (value <= thresholds[1]) return "shadow-amber-500/20"
    return "shadow-rose-500/20"
}

function getStatusBg(value: number, thresholds: [number, number]) {
    if (value <= thresholds[0]) return "bg-cyan-500/10 border-cyan-500/20"
    if (value <= thresholds[1]) return "bg-amber-500/10 border-amber-500/20"
    return "bg-rose-500/10 border-rose-500/20"
}

function SignalCard({
    icon: Icon,
    label,
    value,
    unit,
    subValue,
    thresholds,
    delay,
}: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    value: number
    unit: string
    subValue?: string
    thresholds: [number, number]
    delay: number
}) {
    const colorClass = getStatusColor(value, thresholds)
    const glowClass = getStatusGlow(value, thresholds)
    const bgClass = getStatusBg(value, thresholds)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5, ease: "easeOut" }}
            className={`
                relative overflow-hidden rounded-2xl border p-5
                backdrop-blur-xl ${bgClass}
                shadow-lg ${glowClass}
                hover:scale-[1.02] transition-transform duration-300
            `}
        >
            <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4 h-4 ${colorClass}`} />
                <span className="text-[11px] uppercase tracking-widest text-white/50 font-medium">
                    {label}
                </span>
            </div>
            <div className="flex items-baseline gap-1.5">
                <motion.span
                    key={value}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`text-3xl font-light tabular-nums ${colorClass}`}
                >
                    {typeof value === "number" ? value.toFixed(value < 10 ? 1 : 0) : value}
                </motion.span>
                <span className="text-xs text-white/40">{unit}</span>
            </div>
            {subValue && (
                <span className="text-[10px] text-white/30 mt-1 block">{subValue}</span>
            )}

            {/* Ambient glow */}
            <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-20 ${value <= thresholds[0] ? "bg-cyan-400" :
                    value <= thresholds[1] ? "bg-amber-400" : "bg-rose-400"
                }`} />
        </motion.div>
    )
}

export function GoldenSignals({ latencyAvg, latencyP95, trafficRpm, errorRate, saturation }: GoldenSignalsProps) {
    const totalLoad = saturation.queue_depth + saturation.processing + saturation.active_fallback
    const capacity = 10 // max reasonable capacity
    const satPct = Math.min(100, (totalLoad / capacity) * 100)

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SignalCard
                icon={Activity}
                label="Latency"
                value={latencyAvg}
                unit="ms"
                subValue={`P95: ${latencyP95.toFixed(0)}ms`}
                thresholds={[500, 2000]}
                delay={0}
            />
            <SignalCard
                icon={Zap}
                label="Traffic"
                value={trafficRpm}
                unit="req/min"
                thresholds={[100, 500]}
                delay={0.1}
            />
            <SignalCard
                icon={AlertTriangle}
                label="Errors"
                value={errorRate}
                unit="%"
                subValue={errorRate > 5 ? "⚠ Spike detected" : "Within tolerance"}
                thresholds={[2, 5]}
                delay={0.2}
            />
            <SignalCard
                icon={Gauge}
                label="Saturation"
                value={satPct}
                unit="%"
                subValue={`${saturation.queue_depth} queued · ${saturation.processing} processing`}
                thresholds={[50, 80]}
                delay={0.3}
            />
        </div>
    )
}
