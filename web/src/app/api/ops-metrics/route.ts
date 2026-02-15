import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const WORKER_URL = process.env.RAILWAY_WORKER_URL || ""
const WORKER_SECRET = process.env.WORKER_SHARED_SECRET || ""

// Token cost per model (USD estimates)
const MODEL_COSTS: Record<string, number> = {
    "veo-3.1-fast": 0.05,
    "veo-3.1": 0.08,
    "veo-3.1-ultra": 0.15,
    "kling-1.5": 0.04,
    "kling-2.0": 0.06,
    default: 0.05,
}

export async function GET() {
    try {
        // 1. Fetch worker metrics
        let workerMetrics = null
        if (WORKER_URL) {
            try {
                const res = await fetch(`${WORKER_URL}/metrics`, {
                    headers: { "X-Worker-Secret": WORKER_SECRET },
                    cache: "no-store",
                })
                if (res.ok) workerMetrics = await res.json()
            } catch {
                // Worker unreachable — dashboard still works with DB data
            }
        }

        // 2. Enrich with Supabase job history
        const supabase = await createClient()

        // Last 24h jobs
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: recentJobs } = await supabase
            .from("jobs")
            .select("id, status, model, created_at, error_message, provider_metadata")
            .gte("created_at", twentyFourHoursAgo)
            .order("created_at", { ascending: false })
            .limit(500)

        const jobs = recentJobs || []

        // Compute token economy
        const costByModel: Record<string, { count: number; cost: number }> = {}
        const costByUser: Record<string, { count: number; cost: number }> = {}
        const hourlyTraffic: Record<string, { total: number; failed: number }> = {}
        let totalCost = 0
        let totalJobs = 0
        let failedJobs = 0

        for (const job of jobs) {
            const model = job.model || "default"
            const cost = MODEL_COSTS[model] || MODEL_COSTS.default
            const userId = (job.provider_metadata as Record<string, string>)?.user_id || "anonymous"
            const hour = new Date(job.created_at).toISOString().slice(0, 13) + ":00"

            // Cost by model
            if (!costByModel[model]) costByModel[model] = { count: 0, cost: 0 }
            costByModel[model].count++
            costByModel[model].cost += cost

            // Cost by user
            if (!costByUser[userId]) costByUser[userId] = { count: 0, cost: 0 }
            costByUser[userId].count++
            costByUser[userId].cost += cost

            // Hourly traffic
            if (!hourlyTraffic[hour]) hourlyTraffic[hour] = { total: 0, failed: 0 }
            hourlyTraffic[hour].total++
            if (job.status === "failed") hourlyTraffic[hour].failed++

            totalCost += cost
            totalJobs++
            if (job.status === "failed") failedJobs++
        }

        // Error breakdown
        const errorTypes: Record<string, number> = {}
        const recentErrors: { message: string; model: string; time: string }[] = []
        for (const job of jobs) {
            if (job.status === "failed" && job.error_message) {
                const type = categorizeError(job.error_message)
                errorTypes[type] = (errorTypes[type] || 0) + 1
                if (recentErrors.length < 10) {
                    recentErrors.push({
                        message: job.error_message.slice(0, 200),
                        model: job.model || "unknown",
                        time: job.created_at,
                    })
                }
            }
        }

        // Monthly projection
        const daysInData = Math.max(1, (Date.now() - new Date(twentyFourHoursAgo).getTime()) / 86400000)
        const monthlyProjection = (totalCost / daysInData) * 30

        // Hourly traffic sorted
        const trafficSeries = Object.entries(hourlyTraffic)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([hour, data]) => ({
                hour: new Date(hour).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                total: data.total,
                failed: data.failed,
            }))

        return NextResponse.json({
            worker: workerMetrics,
            golden_signals: {
                latency_avg: workerMetrics?.latency?.["generate"]?.avg || 0,
                latency_p95: workerMetrics?.latency?.["generate"]?.p95 || 0,
                traffic_rpm: totalJobs / Math.max(1, daysInData * 24 * 60),
                error_rate: totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0,
                saturation: {
                    queue_depth: workerMetrics?.gauges?.queue_depth || 0,
                    processing: workerMetrics?.gauges?.processing_count || 0,
                    active_fallback: workerMetrics?.gauges?.active_fallback_jobs || 0,
                },
            },
            token_economy: {
                total_cost_24h: totalCost,
                monthly_projection: monthlyProjection,
                by_model: costByModel,
                by_user: Object.entries(costByUser)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .slice(0, 10)
                    .map(([id, data]) => ({ user_id: id.slice(0, 8) + "...", ...data })),
            },
            errors: {
                total_24h: failedJobs,
                rate: totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0,
                by_type: errorTypes,
                recent: recentErrors,
            },
            traffic_series: trafficSeries,
            totals: { jobs_24h: totalJobs, failed_24h: failedJobs },
        })
    } catch (error) {
        console.error("Ops metrics error:", error)
        return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 })
    }
}

function categorizeError(msg: string): string {
    const lower = msg.toLowerCase()
    if (lower.includes("429") || lower.includes("rate limit")) return "Rate Limited"
    if (lower.includes("timeout") || lower.includes("timed out")) return "Timeout"
    if (lower.includes("500") || lower.includes("internal server")) return "Server Error"
    if (lower.includes("401") || lower.includes("403") || lower.includes("auth")) return "Auth Error"
    if (lower.includes("422") || lower.includes("validation")) return "Validation Error"
    if (lower.includes("network") || lower.includes("connection")) return "Network Error"
    return "Other"
}
