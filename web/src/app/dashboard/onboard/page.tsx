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
import { motion, AnimatePresence } from "framer-motion"

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
        tip: "Think airport security scanner"
    },
    {
        icon: Camera,
        title: "Neutral Expression",
        desc: "Relax your face. No smile, no frown — just natural.",
        tip: "Look straight at the camera"
    },
    {
        icon: Shirt,
        title: "Form-Fitting Clothes",
        desc: "Wear tight or fitted clothes so the AI can see your body shape.",
        tip: "Avoid baggy or layered outfits"
    },
    {
        icon: Sun,
        title: "Natural Window Light",
        desc: "Face a window for soft, even lighting. No harsh shadows.",
        tip: "Best during daytime"
    },
]

const CHECK_META: Record<string, { icon: string; label: string }> = {
    pose: { icon: "🧍", label: "A-Pose" },
    lighting: { icon: "💡", label: "Lighting" },
    attire: { icon: "👕", label: "Attire" },
    resolution: { icon: "📐", label: "Resolution" },
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

    // ---- Capture frame for analysis (downscaled for speed) ----
    const captureAnalysisFrame = useCallback((): string | null => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return null

        // Downscale to max 1280px width for faster transmission
        const scale = Math.min(1, 1280 / video.videoWidth)
        canvas.width = video.videoWidth * scale
        canvas.height = video.videoHeight * scale

        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', 0.8) // slightly lower quality for speed
    }, [])

    // ---- Capture high-res frame for final identity ----
    const captureHighResFrame = useCallback((): string | null => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return null

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0)
        return canvas.toDataURL('image/jpeg', 0.95) // high quality
    }, [])

    // ---- Real-time analysis ----
    const analyzeFrame = useCallback(async () => {
        if (analyzing) return
        const frame = captureAnalysisFrame()
        if (!frame) return

        setAnalyzing(true)
        try {
            const res = await fetch('/api/validate-selfie-realtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: frame })
            })

            let result
            if (res.ok) {
                result = await res.json()
            } else {
                try {
                    result = await res.json()
                } catch {
                    console.error('Failed to parse error response')
                }
            }

            if (result?.checks) {
                setChecks(result.checks)
                setAllPassed(result.passed === true)
                setScanCount(c => c + 1)
            }
        } catch (e) {
            console.error('Analysis error:', e)
        }
        setAnalyzing(false)
    }, [analyzing, captureAnalysisFrame])

    // Auto-analyze every 4 seconds when camera is active
    useEffect(() => {
        if (step !== 'camera') return
        const initialDelay = setTimeout(() => {
            analyzeFrame()
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
        const frame = captureHighResFrame()
        if (!frame) return

        stopCamera()
        setSelfiePreview(frame)
        setSelfieUrl(frame)

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

            await fetch('/api/generate-identity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity_id: data.identity.id })
            })

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

    return (
        <div className="min-h-screen bg-paper text-foreground font-sans">
            {/* Header */}
            <header className="h-20 border-b border-nimbus/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="font-serif text-xl tracking-tight text-foreground mix-blend-difference">
                        FASHION<span className="font-sans text-[10px] tracking-[0.2em] ml-2 opacity-60">STUDIO</span>
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {['guide', 'camera', 'checklist', 'done'].map((s, i) => (
                        <div key={s} className="flex items-center gap-1">
                            <div className={`h-0.5 w-8transition-all duration-500
                                ${step === s || (step === 'validating' && s === 'checklist') || (step === 'generating' && s === 'done')
                                    ? 'bg-primary w-12'
                                    : ['guide', 'camera', 'checklist', 'done'].indexOf(step) > i || (step === 'validating' && i < 2) || (step === 'generating' && i < 3)
                                        ? 'bg-primary/40 w-8'
                                        : 'bg-nimbus w-8'
                                }`} />
                        </div>
                    ))}
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-16">
                <canvas ref={canvasRef} className="hidden" />
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />

                <AnimatePresence mode="wait">
                    {/* ===== STEP: GUIDE ===== */}
                    {step === 'guide' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                            <div className="text-center space-y-4">
                                <h1 className="font-serif text-5xl text-primary">Identity Calibration</h1>
                                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                                    Our neural engine requires a precise baseline. Align your physical presence to these standards for optimal digital draping.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                {GUIDE_CARDS.map(card => {
                                    const Icon = card.icon
                                    return (
                                        <div key={card.title}
                                            className="group p-8 bg-white border border-nimbus hover:border-primary transition-all duration-500 hover:shadow-xl hover:-translate-y-1 space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-background flex items-center justify-center border border-nimbus">
                                                    <Icon className="w-5 h-5 text-foreground" />
                                                </div>
                                                <h3 className="font-bold text-lg uppercase tracking-widest text-foreground">{card.title}</h3>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-loose">{card.desc}</p>
                                            <div className="pt-4 border-t border-nimbus/50">
                                                <p className="text-[10px] text-primary uppercase tracking-widest font-bold">
                                                    Observation: {card.tip}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="text-center space-y-6">
                                <Button
                                    onClick={() => setStep('camera')}
                                    className="h-16 px-12 text-sm uppercase tracking-[0.2em] font-bold rounded-none bg-foreground text-background hover:bg-primary hover:text-white transition-all shadow-xl hover:shadow-2xl"
                                >
                                    <VideoIcon className="w-4 h-4 mr-3" /> Initialize Sensor
                                </Button>
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                    or{' '}
                                    <button onClick={() => fileRef.current?.click()} className="text-primary hover:text-foreground underline transition-colors">
                                        upload existing raw data
                                    </button>
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: CAMERA ===== */}
                    {step === 'camera' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                            <div className="text-center space-y-2">
                                <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest mb-4">Live Sensor Active</Badge>
                                <h2 className="font-serif text-4xl text-primary">Align & Capture</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-2 relative shadow-2xl">
                                    <div className="relative aspect-[3/4] bg-black overflow-hidden border border-nimbus">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover transform scale-x-[-1]"
                                        />

                                        {/* Overlay UI */}
                                        {analyzing && (
                                            <div className="absolute top-4 left-4">
                                                <Badge className="bg-white/90 text-foreground border-0 text-[9px] font-bold tracking-widest backdrop-blur rounded-none">
                                                    <Zap className="w-3 h-3 mr-1 animate-pulse" /> PROCESSING
                                                </Badge>
                                            </div>
                                        )}

                                        {/* Grid Overlay */}
                                        <div className="absolute inset-0 pointer-events-none opacity-20">
                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
                                            <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
                                        </div>

                                        {/* Status Badge */}
                                        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
                                            <Badge className={`border-0 text-[9px] font-bold tracking-widest backdrop-blur rounded-none px-3 py-1 ${allPassed
                                                ? 'bg-green-500 text-white'
                                                : 'bg-white/80 text-foreground'
                                                }`}>
                                                {allPassed ? 'OPTIMAL CONDITIONS' : `CALIBRATING ${passedCount}/4`}
                                            </Badge>
                                        </div>

                                        {allPassed && <div className="absolute inset-0 border-4 border-green-500 pointer-events-none" />}
                                    </div>

                                    <div className="mt-8 flex justify-center">
                                        <Button
                                            onClick={handleCapture}
                                            disabled={!allPassed}
                                            className={`h-16 px-12 text-sm uppercase tracking-[0.2em] font-bold rounded-none transition-all ${allPassed
                                                ? 'bg-foreground text-background hover:bg-primary hover:text-white shadow-xl'
                                                : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                                }`}
                                        >
                                            {allPassed ? 'Capture Frame' : 'Awaiting Calibration'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Live Checklist */}
                                <div className="space-y-4">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold border-b border-nimbus pb-2">Telemetry</p>
                                    {checks.map((check) => {
                                        const meta = CHECK_META[check.name] || { icon: '✨', label: check.name }
                                        return (
                                            <div key={check.name}
                                                className={`p-4 border transition-all duration-500 bg-white ${check.passed
                                                    ? 'border-primary/50'
                                                    : 'border-nimbus'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    {check.passed ? (
                                                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                                            <CheckCircle2 className="w-3 h-3 text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full border border-nimbus" />
                                                    )}
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                                                            {meta.label}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase">{check.message}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: VALIDATING ===== */}
                    {step === 'validating' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8 text-center py-20">
                            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />
                            <div className="space-y-4">
                                <h2 className="font-serif text-4xl text-primary">Analysing Geometry</h2>
                                <p className="text-muted-foreground text-sm uppercase tracking-widest">
                                    Mapping facial landmarks and lighting conditions...
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: CHECKLIST ===== */}
                    {step === 'checklist' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
                            <div className="text-center space-y-4">
                                <h2 className="font-serif text-4xl text-primary">
                                    {allPassed ? 'Calibration Complete' : 'Adjustment Required'}
                                </h2>
                                <p className="text-muted-foreground max-w-lg mx-auto">
                                    {allPassed
                                        ? 'Telemetry confirms optimal conditions. Ready to generate Master Identity.'
                                        : 'Sensors detected anomalies. Please refine and recapture.'}
                                </p>
                            </div>

                            <div className="flex gap-12 max-w-4xl mx-auto items-start">
                                {selfiePreview && (
                                    <div className="w-1/3 shadow-2xl rotate-1 bg-white p-2">
                                        <div className="aspect-[3/4] overflow-hidden bg-black">
                                            <img src={selfiePreview} alt="" className="w-full h-full object-contain" />
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 space-y-4">
                                    {checks.map((check) => {
                                        const meta = CHECK_META[check.name] || { icon: '✨', label: check.name }
                                        return (
                                            <div key={check.name} className="flex items-center gap-4 p-4 border-b border-nimbus">
                                                {check.passed
                                                    ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                    : <XCircle className="w-5 h-5 text-red-400" />
                                                }
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold uppercase tracking-widest text-foreground">{meta.label}</p>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-mono">{check.message}</p>
                                            </div>
                                        )
                                    })}

                                    <div className="pt-8 flex gap-4">
                                        <Button variant="outline" onClick={handleRetake}
                                            className="h-12 border-nimbus hover:bg-nimbus/20 rounded-none text-xs uppercase tracking-widest">
                                            Discard & Retake
                                        </Button>
                                        <Button
                                            onClick={handleGenerateIdentity}
                                            disabled={!allPassed}
                                            className={`h-12 px-8 flex-1 text-xs uppercase tracking-widest font-bold rounded-none transition-all ${allPassed
                                                ? 'bg-foreground text-background hover:bg-primary hover:text-white'
                                                : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                                }`}
                                        >
                                            {allPassed ? 'Generate Master Identity' : 'Fix Issues'} <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                    {error && (
                                        <p className="text-xs text-red-500 text-center uppercase tracking-widest">{error}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: GENERATING ===== */}
                    {step === 'generating' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12 text-center py-24">
                            <div className="relative w-32 h-32 mx-auto">
                                <div className="absolute inset-0 border-2 border-nimbus rounded-full animate-ping" />
                                <div className="absolute inset-8 bg-foreground rounded-full animate-pulse" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="font-serif text-4xl text-primary">Synthesizing Identity</h2>
                                <p className="text-muted-foreground text-sm uppercase tracking-widest max-w-md mx-auto">
                                    Generating high-fidelity studio portrait on cyclorama background...
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: DONE ===== */}
                    {step === 'done' && identity?.master_identity_url && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12 text-center">
                            <div className="space-y-4">
                                <h2 className="font-serif text-5xl text-primary">Identity Establishd</h2>
                                <p className="text-muted-foreground text-sm uppercase tracking-widest">
                                    Your digital twin is ready for editorial production.
                                </p>
                            </div>

                            <div className="flex gap-8 max-w-3xl mx-auto items-center justify-center">
                                <div className="w-64 rotate-3 bg-white p-2 shadow-lg opacity-60 hover:opacity-100 transition-opacity">
                                    <img src={selfiePreview!} alt="Original" className="w-full grayscale" />
                                    <p className="text-[9px] text-center pt-2 uppercase tracking-widest text-muted-foreground">Source</p>
                                </div>

                                <ArrowRight className="w-8 h-8 text-nimbus" />

                                <div className="w-80 -rotate-2 bg-white p-3 shadow-2xl relative z-10 scale-110">
                                    <img src={identity.master_identity_url} alt="Master Identity" className="w-full" />
                                    <p className="text-[9px] text-center pt-3 uppercase tracking-widest font-bold text-primary">Master Identity</p>
                                </div>
                            </div>

                            <div className="pt-8">
                                <Link href="/dashboard">
                                    <Button className="h-14 px-12 bg-foreground text-background hover:bg-primary hover:text-white rounded-none text-sm uppercase tracking-[0.2em] font-bold shadow-xl">
                                        Enter Studio
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
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
