"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Radio, ArrowLeft } from "lucide-react"
import Link from "next/link"

import { GoldenSignals } from "@/components/ops/golden-signals"
import { TrafficChart } from "@/components/ops/traffic-chart"
import { ErrorBreakdown } from "@/components/ops/error-breakdown"
import { TokenEconomy } from "@/components/ops/token-economy"
import { AIQuality } from "@/components/ops/ai-quality"
import { LogAnalyst } from "@/components/ops/log-analyst"

interface OpsData {
    golden_signals: {
        latency_avg: number
        latency_p95: number
        traffic_rpm: number
        error_rate: number
        saturation: {
            queue_depth: number
            processing: number
            active_fallback: number
        }
    }
    token_economy: {
        total_cost_24h: number
        monthly_projection: number
        by_model: Record<string, { count: number; cost: number }>
        by_user: { user_id: string; count: number; cost: number }[]
    }
    errors: {
        total_24h: number
        rate: number
        by_type: Record<string, number>
        recent: { message: string; model: string; time: string }[]
    }
    traffic_series: { hour: string; total: number; failed: number }[]
    totals: { jobs_24h: number; failed_24h: number }
    worker: {
        error_patterns?: Record<string, number>
        uptime_seconds?: number
    } | null
}

export default function OpsPage() {
    const [data, setData] = useState<OpsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchData = useCallback(async (showSpinner = false) => {
        if (showSpinner) setIsRefreshing(true)
        try {
            const res = await fetch("/api/ops-metrics", { cache: "no-store" })
            if (res.ok) {
                const json = await res.json()
                setData(json)
                setLastUpdate(new Date())
            }
        } catch (err) {
            console.error("Failed to fetch ops metrics:", err)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
        }
    }, [])

    // Initial load + auto-refresh every 10s
    useEffect(() => {
        fetchData()
        const interval = setInterval(() => fetchData(), 10000)
        return () => clearInterval(interval)
    }, [fetchData])

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/[0.06]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="text-white/30 hover:text-white/60 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div className="flex items-center gap-2.5">
                            <motion.div
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                            >
                                <Radio className="w-4 h-4 text-cyan-400" />
                            </motion.div>
                            <h1 className="text-sm font-medium tracking-wide">
                                VideoAds Ops
                            </h1>
                        </div>
                        <span className="text-[10px] text-white/20 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                            LIVE
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {lastUpdate && (
                            <span className="text-[10px] text-white/20 tabular-nums">
                                {lastUpdate.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
                            </span>
                        )}
                        {data?.worker?.uptime_seconds && (
                            <span className="text-[10px] text-white/15 tabular-nums">
                                Uptime: {formatUptime(data.worker.uptime_seconds)}
                            </span>
                        )}
                        <button
                            onClick={() => fetchData(true)}
                            className="text-white/30 hover:text-white/60 transition-colors"
                            disabled={isRefreshing}
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
                        >
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            >
                                <RefreshCw className="w-6 h-6 text-white/20" />
                            </motion.div>
                            <span className="text-xs text-white/30">Loading metrics...</span>
                        </motion.div>
                    ) : data ? (
                        <motion.div
                            key="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="space-y-4"
                        >
                            {/* Row 1: Golden Signals (10-second rule) */}
                            <GoldenSignals
                                latencyAvg={data.golden_signals.latency_avg}
                                latencyP95={data.golden_signals.latency_p95}
                                trafficRpm={data.golden_signals.traffic_rpm}
                                errorRate={data.golden_signals.error_rate}
                                saturation={data.golden_signals.saturation}
                            />

                            {/* Row 2: Traffic + Errors (bento grid) */}
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                <div className="lg:col-span-3">
                                    <TrafficChart data={data.traffic_series} />
                                </div>
                                <div className="lg:col-span-2">
                                    <ErrorBreakdown
                                        byType={data.errors.by_type}
                                        recent={data.errors.recent}
                                        totalErrors={data.errors.total_24h}
                                        errorRate={data.errors.rate}
                                    />
                                </div>
                            </div>

                            {/* Row 3: Token Economy + AI Quality */}
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                                <div className="lg:col-span-3">
                                    <TokenEconomy
                                        totalCost24h={data.token_economy.total_cost_24h}
                                        monthlyProjection={data.token_economy.monthly_projection}
                                        byModel={data.token_economy.by_model}
                                        byUser={data.token_economy.by_user}
                                    />
                                </div>
                                <div className="lg:col-span-2">
                                    <AIQuality
                                        errorRate={data.errors.rate}
                                        totalJobs={data.totals.jobs_24h}
                                        failedJobs={data.totals.failed_24h}
                                    />
                                </div>
                            </div>

                            {/* Row 4: Log Analyst */}
                            <LogAnalyst
                                recentErrors={data.errors.recent}
                                errorPatterns={data.worker?.error_patterns || {}}
                                errorRate={data.errors.rate}
                                monthlyProjection={data.token_economy.monthly_projection}
                            />

                            {/* Footer stat */}
                            <div className="text-center pt-2">
                                <span className="text-[10px] text-white/15">
                                    {data.totals.jobs_24h} jobs processed in the last 24h · Auto-refreshing every 10s
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex items-center justify-center min-h-[60vh]">
                            <span className="text-sm text-white/30">Failed to load metrics</span>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}
