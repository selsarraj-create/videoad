"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Play, Download, RotateCcw, Clock, CheckCircle2,
    Loader2, AlertTriangle, Film, Sparkles, X,
    ArrowRight, FolderOpen
} from "lucide-react"
import { useRouter } from "next/navigation"

// ── Types ───────────────────────────────────────────────────────────────────

interface SceneHistoryEntry {
    id: number
    url: string
    prompt: string
    created_at: string
}

interface Project {
    id: string
    user_id: string
    identity_id: string | null
    pipeline_status: string | null
    credits_paid: boolean
    reroll_count: number
    scene_history: SceneHistoryEntry[]
    active_scene_index: number
    prompt: string | null
    fashn_render_url: string | null
    veo_video_url: string | null
    created_at: string
    updated_at: string
}

type FilterTab = 'all' | 'drafts' | 'completed'

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function getStatusConfig(status: string | null) {
    switch (status) {
        case 'SCENE_GENERATED':
        case 'DRAFT':
        case 'OUTFIT_SELECTED':
            return {
                label: 'Resume',
                color: 'bg-amber-500/10 text-amber-600 border-amber-300',
                dot: 'bg-amber-500',
                step: status === 'SCENE_GENERATED' ? 'Outfit Selection'
                    : status === 'OUTFIT_SELECTED' ? 'Video Processing'
                        : 'Scene Generation',
            }
        case 'PROCESSING_VIDEO':
            return {
                label: 'Animating...',
                color: 'bg-blue-500/10 text-blue-600 border-blue-300',
                dot: 'bg-blue-500 animate-pulse',
                step: 'Video Animation',
            }
        case 'COMPLETED':
            return {
                label: 'Ready',
                color: 'bg-emerald-500/10 text-emerald-600 border-emerald-300',
                dot: 'bg-emerald-500',
                step: 'Complete',
            }
        case 'FAILED':
            return {
                label: 'Failed',
                color: 'bg-red-500/10 text-red-600 border-red-300',
                dot: 'bg-red-500',
                step: 'Error',
            }
        default:
            return {
                label: 'Draft',
                color: 'bg-gray-500/10 text-gray-500 border-gray-300',
                dot: 'bg-gray-400',
                step: 'Unknown',
            }
    }
}

// ── ProjectCard ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onRetry }: { project: Project; onRetry: (id: string) => void }) {
    const router = useRouter()
    const videoRef = useRef<HTMLVideoElement>(null)
    const [isHovering, setIsHovering] = useState(false)
    const [videoModalOpen, setVideoModalOpen] = useState(false)
    const status = project.pipeline_status
    const config = getStatusConfig(status)

    // Thumbnail resolution
    const sceneUrl = project.scene_history?.[project.active_scene_index]?.url
    const thumbnailUrl = status === 'PROCESSING_VIDEO' || status === 'COMPLETED'
        ? project.fashn_render_url || sceneUrl
        : sceneUrl

    const handleClick = () => {
        if (status === 'COMPLETED') {
            setVideoModalOpen(true)
        } else if (status === 'PROCESSING_VIDEO') {
            // No-op or could show a status modal
        } else if (status === 'FAILED') {
            onRetry(project.id)
        } else {
            // Draft / Scene Generated / Outfit Selected → resume
            router.push(`/dashboard/outfit?project=${project.id}`)
        }
    }

    const handleMouseEnter = () => {
        setIsHovering(true)
        if (status === 'COMPLETED' && videoRef.current) {
            videoRef.current.play().catch(() => { })
        }
    }

    const handleMouseLeave = () => {
        setIsHovering(false)
        if (videoRef.current) {
            videoRef.current.pause()
            videoRef.current.currentTime = 0
        }
    }

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35 }}
                className={`group relative bg-white border border-nimbus/40 overflow-hidden cursor-pointer transition-all duration-300
                    hover:shadow-xl hover:border-primary/30
                    ${status === 'PROCESSING_VIDEO' ? 'pointer-events-auto' : ''}`}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* ── Thumbnail / Video ── */}
                <div className="aspect-[3/4] bg-nimbus/10 relative overflow-hidden">
                    {status === 'COMPLETED' && project.veo_video_url ? (
                        <>
                            {/* Static thumbnail underlay */}
                            {thumbnailUrl && (
                                <img
                                    src={thumbnailUrl}
                                    alt="Project thumbnail"
                                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500
                                        ${isHovering ? 'opacity-0' : 'opacity-100'}`}
                                />
                            )}
                            {/* Auto-play video on hover */}
                            <video
                                ref={videoRef}
                                src={project.veo_video_url}
                                muted
                                loop
                                playsInline
                                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500
                                    ${isHovering ? 'opacity-100' : 'opacity-0'}`}
                            />
                            {/* Play icon overlay */}
                            <div className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300
                                ${isHovering ? 'opacity-0' : 'opacity-100'}`}>
                                <div className="w-12 h-12 bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                    <Play className="w-5 h-5 text-foreground ml-0.5" />
                                </div>
                            </div>
                        </>
                    ) : status === 'PROCESSING_VIDEO' ? (
                        <>
                            {thumbnailUrl && (
                                <img src={thumbnailUrl} alt="Processing" className="w-full h-full object-cover" />
                            )}
                            {/* Spinner overlay */}
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
                                <div className="relative">
                                    <div className="w-14 h-14 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    <Sparkles className="w-5 h-5 text-white absolute inset-0 m-auto" />
                                </div>
                                <span className="text-[10px] uppercase tracking-[0.25em] text-white/80 font-bold">Generating Video</span>
                            </div>
                        </>
                    ) : status === 'FAILED' ? (
                        <>
                            {thumbnailUrl && (
                                <img src={thumbnailUrl} alt="Failed" className="w-full h-full object-cover opacity-50" />
                            )}
                            <div className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-3">
                                <AlertTriangle className="w-8 h-8 text-red-400" />
                                <span className="text-[10px] uppercase tracking-[0.25em] text-white/90 font-bold">Generation Failed</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRetry(project.id) }}
                                    className="mt-1 px-4 py-1.5 bg-white text-foreground text-[10px] uppercase tracking-widest font-bold hover:bg-primary hover:text-white transition-colors"
                                >
                                    <RotateCcw className="w-3 h-3 inline mr-1.5" />Retry
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {thumbnailUrl ? (
                                <img
                                    src={thumbnailUrl}
                                    alt="Scene"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <FolderOpen className="w-10 h-10 text-nimbus" />
                                </div>
                            )}
                            {/* Resume arrow on hover */}
                            <div className={`absolute bottom-3 right-3 transition-all duration-300
                                ${isHovering ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}>
                                <div className="w-9 h-9 bg-foreground text-white flex items-center justify-center shadow-lg">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Card Footer ── */}
                <div className="p-4 space-y-2.5">
                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold border ${config.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            {config.label}
                        </span>
                        {status === 'COMPLETED' && (
                            <span className="text-[9px] text-muted-foreground font-medium flex items-center gap-1">
                                <Film className="w-3 h-3" /> 6s · MP4
                            </span>
                        )}
                    </div>

                    {/* Prompt (truncated) */}
                    {project.prompt && (
                        <p className="text-[11px] text-foreground/80 leading-relaxed truncate font-medium">
                            {project.prompt}
                        </p>
                    )}

                    {/* Time + Step */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>
                            {status === 'COMPLETED'
                                ? `Completed ${timeAgo(project.updated_at)}`
                                : `Last edited ${timeAgo(project.updated_at)}. Step: ${config.step}`}
                        </span>
                    </div>
                </div>
            </motion.div>

            {/* ── Video Player Modal ── */}
            <AnimatePresence>
                {videoModalOpen && project.veo_video_url && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setVideoModalOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className="relative bg-white border border-nimbus/50 shadow-2xl max-w-lg w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-nimbus/30 flex items-center justify-between">
                                <div>
                                    <h3 className="font-serif text-lg tracking-tight">Video Preview</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Duration: 6s · Format: MP4</p>
                                </div>
                                <button
                                    onClick={() => setVideoModalOpen(false)}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-nimbus/20 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="aspect-[9/16] max-h-[70vh] bg-black">
                                <video
                                    src={project.veo_video_url}
                                    controls
                                    autoPlay
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="p-4 flex gap-3">
                                <a
                                    href={project.veo_video_url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-foreground text-white text-[10px] uppercase tracking-widest font-bold hover:bg-primary transition-colors"
                                >
                                    <Download className="w-3.5 h-3.5" /> Download MP4
                                </a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

// ── Rescue Toast ────────────────────────────────────────────────────────────

function RescueToast({ count, onResume, onDismiss }: { count: number; onResume: () => void; onDismiss: () => void }) {
    return (
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 40, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 40, x: '-50%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-6 left-1/2 z-[90] bg-foreground text-white px-6 py-3 shadow-2xl flex items-center gap-4"
                >
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-xs font-medium">
                        You have {count} unfinished project{count > 1 ? 's' : ''}.
                    </span>
                    <button
                        onClick={onResume}
                        className="text-[10px] uppercase tracking-widest font-bold text-amber-400 hover:text-amber-300 transition-colors"
                    >
                        Resume
                    </button>
                    <button
                        onClick={onDismiss}
                        className="ml-1 text-white/50 hover:text-white transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

// ── ProjectsGrid (Main Export) ──────────────────────────────────────────────

export function ProjectsGrid() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterTab>('all')
    const [unfinishedCount, setUnfinishedCount] = useState(0)
    const [toastDismissed, setToastDismissed] = useState(false)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const fetchProjects = useCallback(async () => {
        try {
            const filterParam = filter === 'all' ? '' : `?filter=${filter}`
            const res = await fetch(`/api/projects${filterParam}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setProjects(data.projects || [])
            setUnfinishedCount(data.unfinishedCount || 0)
        } catch (err) {
            console.error('Failed to fetch projects:', err)
        } finally {
            setLoading(false)
        }
    }, [filter])

    // Initial fetch + re-fetch on filter change
    useEffect(() => {
        setLoading(true)
        fetchProjects()
    }, [fetchProjects])

    // Poll every 10s for processing projects
    useEffect(() => {
        const hasProcessing = projects.some(p => p.pipeline_status === 'PROCESSING_VIDEO')
        if (hasProcessing) {
            pollRef.current = setInterval(fetchProjects, 10_000)
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current)
        }
    }, [projects, fetchProjects])

    const handleRetry = async (projectId: string) => {
        try {
            await fetch(`/api/projects/${projectId}/retry`, { method: 'POST' })
            fetchProjects()
        } catch (err) {
            console.error('Retry failed:', err)
        }
    }

    const filterTabs: { key: FilterTab; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'drafts', label: 'Drafts' },
        { key: 'completed', label: 'Completed' },
    ]

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

            {/* ── Header ── */}
            <div className="space-y-2 border-b border-nimbus pb-8">
                <h2 className="font-serif text-3xl tracking-tight">My Projects</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} · {unfinishedCount} in progress
                </p>
            </div>

            {/* ── Filter Tabs ── */}
            <div className="flex items-center gap-1 bg-nimbus/10 p-1 w-fit">
                {filterTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`relative px-5 py-2 text-[10px] uppercase tracking-[0.2em] font-bold transition-all duration-200
                            ${filter === tab.key
                                ? 'bg-white text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Grid ── */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : projects.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-24 gap-4"
                >
                    <div className="w-16 h-16 bg-nimbus/10 flex items-center justify-center">
                        <FolderOpen className="w-7 h-7 text-nimbus" />
                    </div>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                        {filter === 'all' ? 'No projects yet' : `No ${filter} projects`}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 max-w-xs text-center">
                        Start a new project from the Try On tab to begin your first video generation.
                    </p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    <AnimatePresence mode="popLayout">
                        {projects.map(project => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onRetry={handleRetry}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* ── Rescue Toast ── */}
            {!toastDismissed && (
                <RescueToast
                    count={unfinishedCount}
                    onResume={() => setFilter('drafts')}
                    onDismiss={() => setToastDismissed(true)}
                />
            )}
        </motion.div>
    )
}
