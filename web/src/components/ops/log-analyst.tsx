"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, AlertCircle, CheckCircle, XCircle, Bell, BellOff } from "lucide-react"

interface LogAnalystProps {
    recentErrors: { message: string; model: string; time: string }[]
    errorPatterns: Record<string, number>
    errorRate: number
    monthlyProjection: number
    budgetLimit?: number
}

export function LogAnalyst({
    recentErrors,
    errorPatterns,
    errorRate,
    monthlyProjection,
    budgetLimit = 500,
}: LogAnalystProps) {
    const [notificationsEnabled, setNotificationsEnabled] = useState(false)
    const [alertDismissed, setAlertDismissed] = useState<Record<string, boolean>>({})

    // Predictive alerts
    const alerts: { id: string; type: "error" | "warning" | "info"; message: string }[] = []

    if (errorRate > 5) {
        alerts.push({
            id: "error_spike",
            type: "error",
            message: `Error rate at ${errorRate.toFixed(1)}% — exceeds 5% threshold. Root cause: ${Object.entries(errorPatterns)
                    .sort(([, a], [, b]) => b - a)[0]?.[0] || "Unknown"
                }`,
        })
    }
    if (monthlyProjection > budgetLimit) {
        alerts.push({
            id: "budget_warning",
            type: "warning",
            message: `Projected monthly spend: $${monthlyProjection.toFixed(0)} exceeds $${budgetLimit} budget`,
        })
    }
    if (errorRate <= 2 && monthlyProjection <= budgetLimit) {
        alerts.push({
            id: "all_clear",
            type: "info",
            message: "All systems nominal. No anomalies detected.",
        })
    }

    // Browser notifications
    useEffect(() => {
        if (notificationsEnabled && typeof window !== "undefined" && "Notification" in window) {
            Notification.requestPermission()
        }
    }, [notificationsEnabled])

    useEffect(() => {
        if (!notificationsEnabled || typeof window === "undefined" || !("Notification" in window)) return
        if (Notification.permission !== "granted") return

        for (const alert of alerts) {
            if (alert.type !== "info" && !alertDismissed[alert.id]) {
                new Notification("VideoAds Ops Alert", {
                    body: alert.message,
                    icon: alert.type === "error" ? "🔴" : "🟡",
                })
            }
        }
    }, [alerts.length, notificationsEnabled]) // eslint-disable-line react-hooks/exhaustive-deps

    // RCA pattern extraction
    const topPatterns = Object.entries(errorPatterns)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs uppercase tracking-widest text-white/50 font-medium flex items-center gap-2">
                    <Search className="w-3.5 h-3.5" />
                    Log Analyst
                </h3>
                <button
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                    title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
                >
                    {notificationsEnabled ? (
                        <Bell className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                        <BellOff className="w-3.5 h-3.5" />
                    )}
                </button>
            </div>

            {/* Alerts */}
            <AnimatePresence mode="popLayout">
                {alerts.filter(a => !alertDismissed[a.id]).map((alert) => (
                    <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={`
                            flex items-start gap-2 px-3 py-2 rounded-xl mb-2 text-xs
                            ${alert.type === "error" ? "bg-rose-500/10 text-rose-300 border border-rose-500/20" :
                                alert.type === "warning" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" :
                                    "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"}
                        `}
                    >
                        {alert.type === "error" ? <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> :
                            alert.type === "warning" ? <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> :
                                <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                        <span className="flex-1">{alert.message}</span>
                        {alert.type !== "info" && (
                            <button
                                onClick={() => setAlertDismissed(d => ({ ...d, [alert.id]: true }))}
                                className="text-white/30 hover:text-white/60 ml-2"
                            >
                                ×
                            </button>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Error pattern analysis */}
            {topPatterns.length > 0 && (
                <div className="mt-3">
                    <div className="text-[10px] text-white/30 mb-2 uppercase tracking-wider">
                        Root Cause Patterns
                    </div>
                    <div className="space-y-1.5">
                        {topPatterns.map(([pattern, count]) => (
                            <div key={pattern} className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full bg-gradient-to-r from-rose-500/60 to-amber-500/60"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(100, (count / (topPatterns[0]?.[1] || 1)) * 100)}%` }}
                                        transition={{ delay: 1, duration: 0.8 }}
                                    />
                                </div>
                                <span className="text-[10px] text-white/40 w-14 text-right tabular-nums">
                                    {count}x
                                </span>
                                <span className="text-[10px] text-white/50 truncate max-w-[140px]">
                                    {pattern}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent error details */}
            {recentErrors.length > 0 && (
                <div className="mt-3">
                    <div className="text-[10px] text-white/30 mb-2 uppercase tracking-wider">
                        Recent Failures
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                        {recentErrors.slice(0, 5).map((err, i) => (
                            <div key={i} className="text-[10px] text-white/30 flex gap-2">
                                <span className="text-white/20 tabular-nums flex-shrink-0">
                                    {new Date(err.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span className="text-rose-400/60 flex-shrink-0">{err.model}</span>
                                <span className="truncate">{err.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    )
}
