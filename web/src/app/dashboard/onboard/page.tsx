"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Sparkles, Camera, User, Sun, Shirt, ArrowRight,
    CheckCircle2, XCircle, Loader2, RefreshCcw, ChevronRight,
    Video as VideoIcon, Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type Step = 'guide' | 'camera' | 'validating' | 'checklist' | 'generating' | 'done'

interface ValidationCheck {
    name: string
    passed: boolean
    message: string
}

interface Identity {
    id: string
    raw_selfie_url: string
    master_identity_url: string | null
    validation_result: {
        passed?: boolean
        checks?: ValidationCheck[]
        error?: string
    }
    status: string
}

const GUIDE_CARDS = [
    {
        icon: User,
        title: "A-Pose",
        desc: "Stand with arms slightly away from your body, palms facing forward.",
        color: "purple",
        tip: "Think airport security scanner"
    },
    {
        icon: Camera,
        title: "Neutral Expression",
        desc: "Relax your face. No smile, no frown — just natural.",
        color: "pink",
        tip: "Look straight at the camera"
    },
    {
        icon: Shirt,
        title: "Form-Fitting Clothes",
        desc: "Wear tight or fitted clothes so the AI can see your body shape.",
        color: "violet",
        tip: "Avoid baggy or layered outfits"
    },
    {
        icon: Sun,
        title: "Natural Window Light",
        desc: "Face a window for soft, even lighting. No harsh shadows.",
        color: "amber",
        tip: "Best during daytime"
    },
]

const CHECK_META: Record<string, { icon: string; label: string; color: string }> = {
    pose: { icon: "🧍", label: "A-Pose", color: "purple" },
    lighting: { icon: "💡", label: "Lighting", color: "amber" },
    attire: { icon: "👕", label: "Attire", color: "violet" },
    resolution: { icon: "📐", label: "Resolution", color: "pink" },
}

export default function OnboardPage() {
    const [step, setStep] = useState<Step>('guide')
    const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
    const [selfieUrl, setSelfieUrl] = useState("")
    const [identity, setIdentity] = useState<Identity | null>(null)
    const [checks, setChecks] = useState<ValidationCheck[]>([
        { name: "pose", passed: false, message: "Waiting..." },
        { name: "lighting", passed: false, message: "Waiting..." },
        { name: "attire", passed: false, message: "Waiting..." },
        { name: "resolution", passed: false, message: "Waiting..." },
    ])
    const [allPassed, setAllPassed] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [scanCount, setScanCount] = useState(0)

    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const analyzeTimerRef = useRef<NodeJS.Timeout | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const supabase = createClient()

    // ---- Camera management ----
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 2560 },
                    height: { ideal: 1440 },
                }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
        } catch (err) {
            console.error('Camera access denied:', err)
            setError('Camera access is required. Please allow camera permissions.')
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (analyzeTimerRef.current) {
            clearInterval(analyzeTimerRef.current)
            analyzeTimerRef.current = null
        }
    }, [])

    // Start camera when entering camera step
    useEffect(() => {
        if (step === 'camera') {
            startCamera()
            return () => stopCamera()
        }
    }, [step, startCamera, stopCamera])

    // ---- Capture camera frame as base64 ----
    const captureFrame = useCallback((): string | null => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return null

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0)
        return canvas.toDataURL('image/jpeg', 0.85)
    }, [])

    // ---- Real-time analysis ----
    const analyzeFrame = useCallback(async () => {
        if (analyzing) return
        const frame = captureFrame()
        if (!frame) return

        setAnalyzing(true)
        try {
            const res = await fetch('/api/validate-selfie-realtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: frame })
            })

            if (res.ok) {
                const result = await res.json()
                if (result.checks) {
                    setChecks(result.checks)
                    setAllPassed(result.passed === true)
                    setScanCount(c => c + 1)
                }
            }
        } catch (e) {
            console.error('Analysis error:', e)
        }
        setAnalyzing(false)
    }, [analyzing, captureFrame])

    // Auto-analyze every 4 seconds when camera is active
    useEffect(() => {
        if (step !== 'camera') return
        // First analysis after 2s
        const initialDelay = setTimeout(() => {
            analyzeFrame()
            // Then every 4 seconds
            analyzeTimerRef.current = setInterval(analyzeFrame, 4000)
        }, 2000)

        return () => {
            clearTimeout(initialDelay)
            if (analyzeTimerRef.current) {
                clearInterval(analyzeTimerRef.current)
                analyzeTimerRef.current = null
            }
        }
    }, [step, analyzeFrame])

    // ---- Capture selfie (freeze frame) ----
    const handleCapture = async () => {
        const frame = captureFrame()
        if (!frame) return

        stopCamera()
        setSelfiePreview(frame)
        setSelfieUrl(frame)

        // Also upload to storage
        try {
            const blob = await fetch(frame).then(r => r.blob())
            const fileName = `selfies/${Date.now()}.jpg`
            const { error: uploadErr } = await supabase.storage.from('raw_assets').upload(fileName, blob)
            if (!uploadErr) {
                const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
                setSelfieUrl(urlData.publicUrl)
            }
        } catch {
            console.warn('Storage upload failed, using base64')
        }

        setStep('checklist')
    }

    // ---- Also support file upload as fallback ----
    const handleFileSelect = async (file: File) => {
        setError(null)
        const reader = new FileReader()
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string
            setSelfiePreview(dataUrl)
            setSelfieUrl(dataUrl)
        }
        reader.readAsDataURL(file)

        try {
            const fileName = `selfies/${Date.now()}_${file.name}`
            const { error: uploadErr } = await supabase.storage.from('raw_assets').upload(fileName, file)
            if (!uploadErr) {
                const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)
                setSelfieUrl(urlData.publicUrl)
            }
        } catch {
            console.warn('Storage upload failed, using data URL')
        }

        // Run full validation
        setStep('validating')
        try {
            const res = await fetch('/api/validate-selfie-realtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: await fileToBase64(file) })
            })
            if (res.ok) {
                const result = await res.json()
                if (result.checks) {
                    setChecks(result.checks)
                    setAllPassed(result.passed === true)
                }
            }
        } catch (e) {
            console.error(e)
        }
        setStep('checklist')
    }

    // ---- Submit for master identity generation ----
    const handleGenerateIdentity = async () => {
        if (!selfieUrl) return
        setStep('generating')
        setError(null)

        try {
            // Create identity in DB + trigger validation
            const res = await fetch('/api/validate-selfie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selfie_url: selfieUrl })
            })
            const data = await res.json()
            if (!data.identity?.id) {
                setError('Failed to create identity')
                setStep('checklist')
                return
            }

            setIdentity(data.identity)

            // Wait a moment then trigger generation
            await fetch('/api/generate-identity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity_id: data.identity.id })
            })

            // Poll for completion
            const pollInterval = setInterval(async () => {
                const { data: row } = await supabase
                    .from('identities')
                    .select('*')
                    .eq('id', data.identity.id)
                    .single()

                if (!row) return

                if (row.status === 'ready' && row.master_identity_url) {
                    setIdentity(row as Identity)
                    setStep('done')
                    clearInterval(pollInterval)
                }
                if (row.status === 'failed') {
                    setError('Identity generation failed. Please try again.')
                    setStep('checklist')
                    clearInterval(pollInterval)
                }
            }, 3000)

        } catch (e) {
            console.error(e)
            setError('Something went wrong')
            setStep('checklist')
        }
    }

    const handleRetake = () => {
        setSelfiePreview(null)
        setSelfieUrl('')
        setIdentity(null)
        setChecks([
            { name: "pose", passed: false, message: "Waiting..." },
            { name: "lighting", passed: false, message: "Waiting..." },
            { name: "attire", passed: false, message: "Waiting..." },
            { name: "resolution", passed: false, message: "Waiting..." },
        ])
        setAllPassed(false)
        setError(null)
        setScanCount(0)
        setStep('guide')
    }

    const passedCount = checks.filter(c => c.passed).length

    const colorMap: Record<string, string> = {
        purple: 'from-purple-600 to-purple-800 border-purple-700/40 text-purple-400',
        pink: 'from-pink-600 to-pink-800 border-pink-700/40 text-pink-400',
        violet: 'from-violet-600 to-violet-800 border-violet-700/40 text-violet-400',
        amber: 'from-amber-600 to-amber-800 border-amber-700/40 text-amber-400',
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <header className="h-14 border-b border-white/5 bg-[#050505]/90 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-lg tracking-tighter text-white/90">
                        FASHION<span className="font-light text-zinc-600">STUDIO</span>
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {['guide', 'camera', 'checklist', 'done'].map((s, i) => (
                        <div key={s} className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full transition-all ${step === s || (step === 'validating' && s === 'checklist') || (step === 'generating' && s === 'done')
                                    ? 'bg-purple-500 scale-125'
                                    : ['guide', 'camera', 'checklist', 'done'].indexOf(step) > i ||
                                        (step === 'validating' && i < 2) || (step === 'generating' && i < 3)
                                        ? 'bg-purple-800'
                                        : 'bg-zinc-800'
                                }`} />
                            {i < 3 && <div className="w-4 h-px bg-zinc-800" />}
                        </div>
                    ))}
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Hidden canvas for frame capture */}
                <canvas ref={canvasRef} className="hidden" />
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />

                {/* ===== STEP: GUIDE ===== */}
                {step === 'guide' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="text-center space-y-3">
                            <h1 className="text-3xl font-black tracking-tight">Set Up Your Identity</h1>
                            <p className="text-zinc-500 max-w-lg mx-auto">
                                We&apos;ll use your camera to check your pose, lighting, attire, and resolution in real-time.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            {GUIDE_CARDS.map(card => {
                                const Icon = card.icon
                                return (
                                    <div key={card.title}
                                        className="group rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-6 hover:border-zinc-700 transition-all space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorMap[card.color]} flex items-center justify-center`}>
                                                <Icon className="w-5 h-5 text-white" />
                                            </div>
                                            <h3 className="font-bold text-white">{card.title}</h3>
                                        </div>
                                        <p className="text-sm text-zinc-500 leading-relaxed">{card.desc}</p>
                                        <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">
                                            💡 {card.tip}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="text-center space-y-3">
                            <Button
                                onClick={() => setStep('camera')}
                                className="h-14 px-10 text-base font-bold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                            >
                                <VideoIcon className="w-5 h-5 mr-2" /> Open Camera
                            </Button>
                            <p className="text-[11px] text-zinc-600">
                                or{' '}
                                <button onClick={() => fileRef.current?.click()} className="text-purple-400 hover:text-purple-300 underline">
                                    upload a photo instead
                                </button>
                            </p>
                        </div>
                    </div>
                )}

                {/* ===== STEP: CAMERA (live + real-time analysis) ===== */}
                {step === 'camera' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black">Live Camera</h2>
                            <p className="text-zinc-500 text-sm">
                                Adjust your pose and environment. The AI is watching in real-time.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Camera Feed — takes 2 cols on desktop */}
                            <div className="md:col-span-2 relative">
                                <div className="rounded-2xl overflow-hidden border-2 border-zinc-800 bg-black relative">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full aspect-[3/4] object-cover transform scale-x-[-1]"
                                    />

                                    {/* Scanning overlay */}
                                    {analyzing && (
                                        <div className="absolute top-3 left-3">
                                            <Badge className="bg-purple-600/80 text-white border-0 text-[10px] font-bold backdrop-blur">
                                                <Zap className="w-3 h-3 mr-1 animate-pulse" /> ANALYZING
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Pass count badge */}
                                    <div className="absolute top-3 right-3">
                                        <Badge className={`border-0 text-[10px] font-bold backdrop-blur ${allPassed
                                                ? 'bg-green-600/80 text-white'
                                                : 'bg-zinc-900/80 text-zinc-300'
                                            }`}>
                                            {passedCount}/4 checks
                                        </Badge>
                                    </div>

                                    {/* All passed glow */}
                                    {allPassed && (
                                        <div className="absolute inset-0 border-4 border-green-500/50 rounded-2xl pointer-events-none" />
                                    )}
                                </div>

                                {/* Capture Button */}
                                <div className="mt-4 flex justify-center gap-3">
                                    <Button
                                        onClick={handleCapture}
                                        disabled={!allPassed}
                                        className={`h-14 px-8 font-bold text-base rounded-full transition-all ${allPassed
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-[0_0_30px_rgba(34,197,94,0.4)] scale-105'
                                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                                            }`}
                                    >
                                        {allPassed ? (
                                            <><Camera className="w-5 h-5 mr-2" /> Capture Selfie</>
                                        ) : (
                                            <><Camera className="w-5 h-5 mr-2" /> Fix checks to capture</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Live Checklist Panel */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Live Checklist</p>
                                    {scanCount > 0 && (
                                        <span className="text-[9px] text-zinc-700 font-mono">
                                            scan #{scanCount}
                                        </span>
                                    )}
                                </div>

                                {checks.map((check) => {
                                    const meta = CHECK_META[check.name] || { icon: '✨', label: check.name, color: 'purple' }
                                    return (
                                        <div key={check.name}
                                            className={`p-4 rounded-xl border transition-all duration-500 ${check.passed
                                                    ? 'border-green-800/50 bg-green-900/10'
                                                    : check.message === 'Waiting...'
                                                        ? 'border-zinc-800 bg-zinc-900/30'
                                                        : 'border-red-800/40 bg-red-900/10'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {check.passed ? (
                                                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                                                ) : check.message === 'Waiting...' ? (
                                                    <div className="w-5 h-5 rounded-full border-2 border-zinc-700 flex-shrink-0" />
                                                ) : (
                                                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-white">
                                                        {meta.icon} {meta.label}
                                                    </p>
                                                    <p className={`text-xs mt-0.5 ${check.passed ? 'text-green-400' :
                                                            check.message === 'Waiting...' ? 'text-zinc-600' :
                                                                'text-red-400'
                                                        }`}>
                                                        {check.message}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                                {/* Overall status */}
                                <div className={`p-4 rounded-xl border-2 text-center transition-all duration-500 ${allPassed
                                        ? 'border-green-600/60 bg-green-900/15'
                                        : 'border-zinc-800 bg-zinc-900/20'
                                    }`}>
                                    {allPassed ? (
                                        <div>
                                            <p className="text-sm font-black text-green-400">✅ All Clear!</p>
                                            <p className="text-[10px] text-green-500/70 mt-0.5">Hit Capture to proceed</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm font-bold text-zinc-500">
                                                {scanCount === 0 ? 'Analyzing...' : `${passedCount}/4 passed`}
                                            </p>
                                            <p className="text-[10px] text-zinc-600 mt-0.5">Adjust and hold position</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== STEP: VALIDATING (from file upload) ===== */}
                {step === 'validating' && (
                    <div className="space-y-8 animate-in fade-in duration-500 text-center py-12">
                        <div className="w-16 h-16 rounded-full border-2 border-zinc-800 border-t-purple-500 animate-spin mx-auto" />
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black">Analyzing Your Photo</h2>
                            <p className="text-zinc-500 text-sm">
                                Checking pose, lighting, attire, and resolution...
                            </p>
                        </div>
                    </div>
                )}

                {/* ===== STEP: CHECKLIST (after capture) ===== */}
                {step === 'checklist' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black">
                                {allPassed ? '✅ All Checks Passed!' : '📋 Quality Checklist'}
                            </h2>
                            <p className="text-zinc-500 text-sm">
                                {allPassed
                                    ? 'Your selfie is ready. Generate your Master Identity now.'
                                    : 'Some checks didn\'t pass. Retake your selfie and try again.'}
                            </p>
                        </div>

                        <div className="flex gap-6 max-w-2xl mx-auto">
                            {selfiePreview && (
                                <div className="w-48 flex-shrink-0">
                                    <div className={`rounded-2xl overflow-hidden border-2 ${allPassed ? 'border-green-700/50' : 'border-amber-700/50'}`}>
                                        <img src={selfiePreview} alt="" className="w-full object-contain" />
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 space-y-3">
                                {checks.map((check, i) => {
                                    const meta = CHECK_META[check.name] || { icon: '✨', label: check.name, color: 'purple' }
                                    return (
                                        <div key={check.name}
                                            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${check.passed
                                                ? 'border-green-800/40 bg-green-900/10'
                                                : 'border-red-800/40 bg-red-900/10'
                                                }`}
                                            style={{ animationDelay: `${i * 150}ms` }}
                                        >
                                            {check.passed
                                                ? <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                                : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            }
                                            <div>
                                                <p className="text-sm font-bold text-white">
                                                    {meta.icon} {meta.label}
                                                </p>
                                                <p className="text-xs text-zinc-400 mt-0.5">{check.message}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {error && (
                            <div className="text-center">
                                <Badge className="bg-red-900/20 text-red-400 border-red-700/30 text-xs px-3 py-1">
                                    ⚠ {error}
                                </Badge>
                            </div>
                        )}

                        <div className="flex justify-center gap-3 pt-4">
                            <Button variant="outline" onClick={handleRetake}
                                className="text-zinc-400 border-zinc-800 hover:bg-zinc-900">
                                <RefreshCcw className="w-4 h-4 mr-1.5" /> Retake
                            </Button>
                            <Button
                                onClick={handleGenerateIdentity}
                                disabled={!allPassed}
                                className={`h-12 px-8 font-bold transition-all ${allPassed
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed border border-zinc-800'
                                    }`}
                            >
                                <Sparkles className="w-4 h-4 mr-1.5" />
                                {allPassed ? 'Generate Master Identity' : 'Fix Issues First'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ===== STEP: GENERATING ===== */}
                {step === 'generating' && (
                    <div className="space-y-8 animate-in fade-in duration-500 text-center py-12">
                        <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 rounded-full border-2 border-zinc-800 border-t-purple-500 animate-spin" />
                            <div className="absolute inset-2 rounded-full border-2 border-zinc-800 border-b-pink-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                            <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-900/20 to-pink-900/20 flex items-center justify-center">
                                <Sparkles className="w-6 h-6 text-purple-400 animate-pulse" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black">Creating Your Master Identity</h2>
                            <p className="text-zinc-500 text-sm max-w-md mx-auto">
                                Generating a 4K studio portrait on a pure white cyclorama background.
                                This usually takes 15-30 seconds...
                            </p>
                        </div>
                    </div>
                )}

                {/* ===== STEP: DONE ===== */}
                {step === 'done' && identity?.master_identity_url && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <div className="text-center space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-green-800/40 bg-green-900/10 px-4 py-1.5">
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Identity Ready</span>
                            </div>
                            <h2 className="text-3xl font-black">Your Master Identity</h2>
                            <p className="text-zinc-500 text-sm max-w-md mx-auto">
                                This 4K studio portrait will be used for all your virtual try-ons and video creation.
                            </p>
                        </div>

                        <div className="flex gap-6 max-w-2xl mx-auto items-start">
                            {selfiePreview && (
                                <div className="flex-1 space-y-2">
                                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold text-center">Original Selfie</p>
                                    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950">
                                        <img src={selfiePreview} alt="Original" className="w-full object-contain max-h-[400px]" />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center pt-16">
                                <ChevronRight className="w-6 h-6 text-purple-500" />
                            </div>

                            <div className="flex-1 space-y-2">
                                <p className="text-[10px] text-purple-400 uppercase tracking-widest font-bold text-center">Master Identity</p>
                                <div className="rounded-2xl overflow-hidden border-2 border-purple-700/40 bg-zinc-950 shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                                    <img src={identity.master_identity_url} alt="Master Identity" className="w-full object-contain max-h-[400px]" />
                                </div>
                            </div>
                        </div>

                        <div className="text-center pt-4">
                            <Link href="/dashboard">
                                <Button className="h-14 px-10 text-base font-bold rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                                    Continue to Studio <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}
