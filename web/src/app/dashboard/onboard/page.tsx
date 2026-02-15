"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useSearchParams } from "next/navigation"
import {
    Sparkles, Camera, Upload, User, Sun, ArrowRight, ArrowLeft,
    CheckCircle2, XCircle, Loader2, RefreshCcw,
    Video as VideoIcon, Zap, Eye, RotateCcw, ImagePlus, Shield
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'guide' | 'mode_select' | 'ai_director' | 'manual_import' | 'synthesis' | 'generating' | 'done'
type Angle = 'front' | 'profile' | 'three_quarter'

interface Identity {
    id: string
    raw_selfie_url: string
    master_identity_url: string | null
    status: string
}

interface PoseDetection {
    angle: string
    confidence: number
    full_body_visible: boolean
    arms_clear: boolean
    no_phone: boolean
    silhouette_clear: boolean
    coaching_tip: string
}

interface UploadValidation {
    suitable: boolean
    angle: string
    checks: Record<string, { passed: boolean; message: string }>
    issues: string[]
    overall_message: string
}

interface AngleCapture {
    preview: string | null
    url: string | null
    validated: boolean
    validation?: UploadValidation | null
    uploading?: boolean
}
// ── Progress Helpers ─────────────────────────────────────────────────────────

function RotatingTip({ tips }: { tips: string[] }) {
    const [idx, setIdx] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % tips.length), 6000)
        return () => clearInterval(t)
    }, [tips.length])
    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={idx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.4 }}
            >
                {tips[idx]}
            </motion.span>
        </AnimatePresence>
    )
}

function ElapsedTimer() {
    const [seconds, setSeconds] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setSeconds(s => s + 1), 1000)
        return () => clearInterval(t)
    }, [])
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return <span>{m}:{s.toString().padStart(2, '0')}</span>
}

// ── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_ANGLES: { key: Angle; label: string; icon: string; desc: string }[] = [
    { key: 'front', label: 'Frontal', icon: '🧍', desc: 'Face the camera directly — symmetrical shoulders, arms slightly away from body.' },
    { key: 'profile', label: 'Profile 90°', icon: '🧍‍♂️', desc: 'Turn 90° to your left — one shoulder facing camera, side of face visible.' },
    { key: 'three_quarter', label: '3/4 View', icon: '🧍‍♀️', desc: 'Turn 45° — both eyes visible, body slightly angled to camera.' },
]

const GUIDE_CARDS = [
    {
        icon: User,
        title: "Multi-Angle Capture",
        desc: "We need 3 views: Frontal, Profile, and 3/4 view for complete draping coverage.",
        tip: "Each angle unlocks a new dimension of try-on precision"
    },
    {
        icon: Camera,
        title: "Full Body Required",
        desc: "Stand far enough that your entire body is visible — head to feet, nothing cropped.",
        tip: "Hold phone at chest height or use a tripod"
    },
    {
        icon: Sun,
        title: "Crisp Lighting",
        desc: "Face a window for soft, even lighting. Fabrics and skin must be texture-clear.",
        tip: "Avoid harsh shadows or backlighting"
    },
    {
        icon: Shield,
        title: "Clean Silhouette",
        desc: "Arms slightly away from body. No objects in hands. Form-fitting clothes.",
        tip: "The AI needs a clean body outline to drape onto"
    },
]

const STEP_LABELS = ['guide', 'mode_select', 'capture', 'synthesis', 'done']

// ── Component ────────────────────────────────────────────────────────────────

export default function OnboardPage() {
    const [step, setStep] = useState<Step>('guide')
    const [mode, setMode] = useState<'ai_director' | 'manual' | null>(null)
    const [identity, setIdentity] = useState<Identity | null>(null)
    const [error, setError] = useState<string | null>(null)

    // AI-Director state
    const [currentAngleIdx, setCurrentAngleIdx] = useState(0)
    const [poseDetection, setPoseDetection] = useState<PoseDetection | null>(null)
    const [detecting, setDetecting] = useState(false)
    const [autoCapturing, setAutoCapturing] = useState(false)

    // Captures (shared between both modes)
    const [captures, setCaptures] = useState<Record<Angle, AngleCapture>>({
        front: { preview: null, url: null, validated: false },
        profile: { preview: null, url: null, validated: false },
        three_quarter: { preview: null, url: null, validated: false },
    })

    // Camera refs
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const detectTimerRef = useRef<NodeJS.Timeout | null>(null)
    const fileRefs = useRef<Record<Angle, HTMLInputElement | null>>({
        front: null, profile: null, three_quarter: null
    })

    const supabase = createClient()
    const searchParams = useSearchParams()
    const personaName = searchParams.get('name') || 'Default'

    const capturedCount = Object.values(captures).filter(c => c.validated).length
    const allCaptured = capturedCount === 3
    const currentAngle = REQUIRED_ANGLES[currentAngleIdx]

    // ── Camera Management ─────────────────────────────────────────────────

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 2560 }, height: { ideal: 1440 } }
            })
            streamRef.current = stream
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                videoRef.current.play()
            }
        } catch {
            setError('Camera access required. Please allow camera permissions.')
        }
    }, [])

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (detectTimerRef.current) {
            clearInterval(detectTimerRef.current)
            detectTimerRef.current = null
        }
    }, [])

    useEffect(() => {
        if (step === 'ai_director') {
            startCamera()
            return () => stopCamera()
        }
    }, [step, startCamera, stopCamera])

    // ── Frame Capture Helpers ─────────────────────────────────────────────

    const captureFrame = useCallback((quality: number = 0.8, maxWidth: number = 1280): string | null => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas || video.readyState < 2) return null

        const scale = Math.min(1, maxWidth / video.videoWidth)
        canvas.width = video.videoWidth * scale
        canvas.height = video.videoHeight * scale
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg', quality)
    }, [])

    // ── AI-Director: Pose Detection Loop ──────────────────────────────────

    const detectPose = useCallback(async () => {
        if (detecting || autoCapturing) return
        const frame = captureFrame(0.7, 1024)
        if (!frame) return

        setDetecting(true)
        try {
            const res = await fetch('/api/validate-selfie-realtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: frame })
            })
            if (!res.ok) throw new Error('Detection failed')

            // Also get angle-specific detection
            const angleRes = await fetch('/api/validate-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: frame })
            })
            if (angleRes.ok) {
                const angleResult: UploadValidation = await angleRes.json()
                setPoseDetection({
                    angle: angleResult.angle || 'unknown',
                    confidence: angleResult.suitable ? 0.97 : 0.3,
                    full_body_visible: angleResult.checks?.whole_product?.passed ?? false,
                    arms_clear: angleResult.checks?.pose?.passed ?? false,
                    no_phone: angleResult.checks?.pose?.passed ?? true,
                    silhouette_clear: angleResult.suitable || false,
                    coaching_tip: angleResult.overall_message || 'Adjusting...',
                })

                // Auto-shutter: capture when correct angle detected with high confidence
                const targetAngle = currentAngle.key
                if (
                    angleResult.suitable &&
                    angleResult.angle === targetAngle &&
                    !captures[targetAngle].validated
                ) {
                    setAutoCapturing(true)
                    // Brief flash, then capture
                    setTimeout(async () => {
                        const hiRes = captureFrame(0.95, 2560)
                        if (hiRes) {
                            await saveAngleCapture(targetAngle, hiRes, 'camera', angleResult)
                        }
                        setAutoCapturing(false)
                    }, 500)
                }
            }
        } catch (e) {
            console.error('Detection error:', e)
        }
        setDetecting(false)
    }, [detecting, autoCapturing, captureFrame, currentAngle, captures])

    // Start detection loop
    useEffect(() => {
        if (step !== 'ai_director') return
        const delay = setTimeout(() => {
            detectPose()
            detectTimerRef.current = setInterval(detectPose, 3500)
        }, 2000)
        return () => {
            clearTimeout(delay)
            if (detectTimerRef.current) {
                clearInterval(detectTimerRef.current)
                detectTimerRef.current = null
            }
        }
    }, [step, detectPose])

    // Auto-advance to next angle after capture
    useEffect(() => {
        if (step !== 'ai_director') return
        if (captures[currentAngle.key].validated && currentAngleIdx < 2) {
            setTimeout(() => setCurrentAngleIdx(i => i + 1), 1500)
        } else if (allCaptured) {
            setTimeout(() => setStep('synthesis'), 1500)
        }
    }, [captures, currentAngleIdx, currentAngle, allCaptured, step])

    // ── Shared: Save an angle capture ─────────────────────────────────────

    const saveAngleCapture = async (angle: Angle, imageData: string, source: 'camera' | 'upload', validation?: UploadValidation | null) => {
        setCaptures(prev => ({
            ...prev,
            [angle]: { ...prev[angle], preview: imageData, uploading: true }
        }))

        try {
            // Create identity if first capture
            let identityId = identity?.id
            if (!identityId) {
                const blob = await fetch(imageData).then(r => r.blob())
                const fileName = `selfies/${Date.now()}.jpg`
                await supabase.storage.from('raw_assets').upload(fileName, blob)
                const { data: urlData } = supabase.storage.from('raw_assets').getPublicUrl(fileName)

                const { data: newIdentity, error: dbErr } = await supabase
                    .from('identities')
                    .insert({
                        raw_selfie_url: urlData.publicUrl,
                        status: 'pending',
                        onboarding_mode: mode || 'ai_director',
                        name: personaName,
                    })
                    .select()
                    .single()

                if (dbErr || !newIdentity) throw new Error('Failed to create identity')
                setIdentity(newIdentity)
                identityId = newIdentity.id
            }

            // Save this angle view
            const res = await fetch('/api/save-identity-view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identity_id: identityId,
                    angle,
                    image_data: imageData,
                    validation_result: validation || {},
                    source,
                })
            })

            const result = await res.json()
            setCaptures(prev => ({
                ...prev,
                [angle]: {
                    preview: imageData,
                    url: result.image_url || imageData,
                    validated: true,
                    validation,
                    uploading: false,
                }
            }))
        } catch (e) {
            console.error('Save capture error:', e)
            setCaptures(prev => ({
                ...prev,
                [angle]: { preview: null, url: null, validated: false, uploading: false }
            }))
            setError(`Failed to save ${angle} capture. Please try again.`)
        }
    }

    // ── Manual Import: File Upload Handler ────────────────────────────────

    const handleManualUpload = async (angle: Angle, file: File) => {
        setError(null)
        const base64 = await fileToBase64(file)

        // First validate suitability
        setCaptures(prev => ({
            ...prev,
            [angle]: { preview: base64, url: null, validated: false, uploading: true }
        }))

        try {
            const res = await fetch('/api/validate-upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_data: base64 })
            })

            const validation: UploadValidation = await res.json()

            if (!validation.suitable) {
                setCaptures(prev => ({
                    ...prev,
                    [angle]: { preview: base64, url: null, validated: false, validation, uploading: false }
                }))
                return
            }

            // Check if detected angle matches expected
            if (validation.angle !== angle && validation.angle !== 'other') {
                setCaptures(prev => ({
                    ...prev,
                    [angle]: {
                        preview: base64, url: null, validated: false,
                        validation: {
                            ...validation,
                            suitable: false,
                            issues: [...validation.issues, `Detected as ${validation.angle} — expected ${angle}`],
                            overall_message: `Wrong angle: this looks like a ${validation.angle} view`
                        },
                        uploading: false
                    }
                }))
                return
            }

            // Valid — save it
            await saveAngleCapture(angle, base64, 'upload', validation)
        } catch {
            setCaptures(prev => ({
                ...prev,
                [angle]: { preview: null, url: null, validated: false, uploading: false }
            }))
            setError('Validation failed. Please try again.')
        }
    }

    // ── Synthesis: Generate Master Identity ────────────────────────────────

    const handleSynthesize = async () => {
        if (!identity?.id) return
        setStep('generating')
        setError(null)

        try {
            // Use the front view as the primary selfie for master identity
            const frontUrl = captures.front.url || identity.raw_selfie_url

            // Update identity status
            await supabase.from('identities').update({
                status: 'validated',
                raw_selfie_url: frontUrl,
            }).eq('id', identity.id)

            // Trigger generation (returns immediately — worker processes async)
            const res = await fetch('/api/generate-identity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identity_id: identity.id })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Generation failed')
            }

            // Poll for completion (up to 8 minutes — generates 3 angle masters)
            let pollCount = 0
            const maxPolls = 160 // 160 × 3s = 8 min
            const pollInterval = setInterval(async () => {
                pollCount++
                if (pollCount > maxPolls) {
                    setError('Generation is taking longer than expected. Check back in a moment.')
                    setStep('synthesis')
                    clearInterval(pollInterval)
                    return
                }

                const { data: row } = await supabase
                    .from('identities')
                    .select('*')
                    .eq('id', identity.id)
                    .single()

                if (!row) return

                if (row.status === 'ready' && row.master_identity_url) {
                    setIdentity(row as Identity)
                    setStep('done')
                    clearInterval(pollInterval)
                }
                if (row.status === 'failed') {
                    setError('Identity generation failed. Please try again.')
                    setStep('synthesis')
                    clearInterval(pollInterval)
                }
            }, 3000)
        } catch (e) {
            console.error(e)
            setError('Something went wrong during synthesis.')
            setStep('synthesis')
        }
    }

    // ── Reset ──────────────────────────────────────────────────────────────

    const handleStartOver = () => {
        stopCamera()
        setStep('guide')
        setMode(null)
        setIdentity(null)
        setError(null)
        setCurrentAngleIdx(0)
        setPoseDetection(null)
        setCaptures({
            front: { preview: null, url: null, validated: false },
            profile: { preview: null, url: null, validated: false },
            three_quarter: { preview: null, url: null, validated: false },
        })
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    const getStepIndex = () => {
        if (step === 'guide') return 0
        if (step === 'mode_select') return 1
        if (step === 'ai_director' || step === 'manual_import') return 2
        if (step === 'synthesis' || step === 'generating') return 3
        return 4
    }

    // ── Render ─────────────────────────────────────────────────────────────

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
                    {STEP_LABELS.map((s, i) => (
                        <div key={s} className="flex items-center gap-1">
                            <div className={`h-0.5 transition-all duration-500 ${getStepIndex() === i ? 'bg-primary w-12'
                                : getStepIndex() > i ? 'bg-primary/40 w-8'
                                    : 'bg-nimbus w-8'
                                }`} />
                        </div>
                    ))}
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-16">
                <canvas ref={canvasRef} className="hidden" />

                <AnimatePresence mode="wait">
                    {/* ===== STEP: GUIDE ===== */}
                    {step === 'guide' && (
                        <motion.div key="guide" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                            <div className="text-center space-y-4">
                                <h1 className="font-serif text-5xl text-primary">Identity Calibration</h1>
                                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                                    Our neural engine requires multi-angle baseline data. We&apos;ll capture your likeness from 3 perspectives for precision draping.
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

                            <div className="text-center">
                                <Button
                                    onClick={() => setStep('mode_select')}
                                    className="h-16 px-12 text-sm uppercase tracking-[0.2em] font-bold rounded-none bg-foreground text-background hover:bg-primary hover:text-white transition-all shadow-xl hover:shadow-2xl"
                                >
                                    Begin Calibration <ArrowRight className="w-4 h-4 ml-3" />
                                </Button>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: MODE SELECT ===== */}
                    {step === 'mode_select' && (
                        <motion.div key="mode_select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                            <div className="text-center space-y-4">
                                <h1 className="font-serif text-5xl text-primary">Choose Your Path</h1>
                                <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
                                    Two ways to build your digital identity. Both produce the same multi-angle profile.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                                {/* AI Director Card */}
                                <button
                                    onClick={() => { setMode('ai_director'); setStep('ai_director') }}
                                    className="group text-left p-10 bg-white border-2 border-nimbus hover:border-primary transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 space-y-6"
                                >
                                    <div className="w-16 h-16 bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:border-primary transition-all">
                                        <Camera className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-xl uppercase tracking-widest text-foreground">AI-Director</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Hands-free guided capture. The AI directs you through each pose and auto-captures when your angle is perfect.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 pt-4 border-t border-nimbus/50">
                                        <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">Live Camera</Badge>
                                        <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">~2 min</Badge>
                                    </div>
                                </button>

                                {/* Manual Import Card */}
                                <button
                                    onClick={() => { setMode('manual'); setStep('manual_import') }}
                                    className="group text-left p-10 bg-white border-2 border-nimbus hover:border-primary transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 space-y-6"
                                >
                                    <div className="w-16 h-16 bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:bg-primary group-hover:border-primary transition-all">
                                        <Upload className="w-7 h-7 text-primary group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-xl uppercase tracking-widest text-foreground">Manual Import</h3>
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            Upload up to 5 existing photos. Each is AI-analyzed for suitability, angle, and quality.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 pt-4 border-t border-nimbus/50">
                                        <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">File Upload</Badge>
                                        <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">Instant</Badge>
                                    </div>
                                </button>
                            </div>

                            <div className="text-center">
                                <button onClick={() => setStep('guide')} className="text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-3 h-3 inline mr-1" /> back to guide
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: AI-DIRECTOR ===== */}
                    {step === 'ai_director' && (
                        <motion.div key="ai_director" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
                            <div className="text-center space-y-2">
                                <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest mb-4">
                                    AI-Director Active
                                </Badge>
                                <h2 className="font-serif text-4xl text-primary">
                                    {captures[currentAngle.key].validated
                                        ? '✓ Captured!'
                                        : `Pose: ${currentAngle.label}`
                                    }
                                </h2>
                                <p className="text-muted-foreground text-sm max-w-md mx-auto">{currentAngle.desc}</p>
                            </div>

                            {/* Angle Progress Indicators */}
                            <div className="flex justify-center gap-6">
                                {REQUIRED_ANGLES.map((a, i) => (
                                    <div key={a.key} className="flex flex-col items-center gap-2">
                                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${captures[a.key].validated
                                            ? 'bg-primary border-primary text-white'
                                            : i === currentAngleIdx
                                                ? 'border-primary text-primary animate-pulse'
                                                : 'border-nimbus text-muted-foreground'
                                            }`}>
                                            {captures[a.key].validated
                                                ? <CheckCircle2 className="w-5 h-5" />
                                                : <span className="text-lg">{a.icon}</span>
                                            }
                                        </div>
                                        <span className={`text-[9px] uppercase tracking-widest font-bold ${i === currentAngleIdx ? 'text-primary' : 'text-muted-foreground'
                                            }`}>{a.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Camera Feed */}
                                <div className="md:col-span-2 relative shadow-2xl">
                                    <div className="relative aspect-[3/4] bg-black overflow-hidden border border-nimbus">
                                        <video ref={videoRef} autoPlay playsInline muted
                                            className="w-full h-full object-cover transform scale-x-[-1]" />

                                        {/* Auto-capture flash */}
                                        {autoCapturing && (
                                            <motion.div
                                                initial={{ opacity: 1 }}
                                                animate={{ opacity: 0 }}
                                                transition={{ duration: 0.5 }}
                                                className="absolute inset-0 bg-white z-20"
                                            />
                                        )}

                                        {/* Detection overlay */}
                                        {detecting && (
                                            <div className="absolute top-4 left-4">
                                                <Badge className="bg-white/90 text-foreground border-0 text-[9px] font-bold tracking-widest backdrop-blur rounded-none">
                                                    <Zap className="w-3 h-3 mr-1 animate-pulse" /> SCANNING
                                                </Badge>
                                            </div>
                                        )}

                                        {/* Grid overlay */}
                                        <div className="absolute inset-0 pointer-events-none opacity-20">
                                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
                                            <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
                                        </div>

                                        {/* Coaching bar */}
                                        <div className="absolute bottom-4 left-4 right-4">
                                            <div className="bg-black/60 backdrop-blur-md px-4 py-3 flex items-center justify-between">
                                                <span className="text-[10px] text-white/80 uppercase tracking-widest font-bold">
                                                    {poseDetection?.coaching_tip || 'Position yourself in the frame...'}
                                                </span>
                                                {poseDetection && (
                                                    <Badge className={`border-0 rounded-none text-[9px] font-bold ${poseDetection.angle === currentAngle.key && poseDetection.confidence > 0.8
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-white/20 text-white/80'
                                                        }`}>
                                                        {poseDetection.angle === currentAngle.key
                                                            ? `${Math.round(poseDetection.confidence * 100)}%`
                                                            : poseDetection.angle.toUpperCase()
                                                        }
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Green border on match */}
                                        {poseDetection?.angle === currentAngle.key && poseDetection.confidence > 0.8 && (
                                            <div className="absolute inset-0 border-4 border-green-500 pointer-events-none" />
                                        )}
                                    </div>
                                </div>

                                {/* Captured Thumbnails */}
                                <div className="space-y-4">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold border-b border-nimbus pb-2">
                                        Captured Angles ({capturedCount}/3)
                                    </p>
                                    {REQUIRED_ANGLES.map((a) => (
                                        <div key={a.key} className={`p-3 border transition-all ${captures[a.key].validated ? 'border-primary/50 bg-primary/5' : 'border-nimbus bg-white'
                                            }`}>
                                            <div className="flex items-center gap-3">
                                                {captures[a.key].preview ? (
                                                    <div className="w-12 h-16 bg-black overflow-hidden border border-nimbus">
                                                        <img src={captures[a.key].preview!} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-16 bg-nimbus/20 border border-nimbus flex items-center justify-center">
                                                        <span className="text-lg">{a.icon}</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-wider">{a.label}</p>
                                                    <p className="text-[9px] text-muted-foreground uppercase">
                                                        {captures[a.key].validated ? '✓ Captured' : captures[a.key].uploading ? 'Saving...' : 'Waiting...'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="text-center pt-4">
                                <button onClick={handleStartOver} className="text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-3 h-3 inline mr-1" /> Start over
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: MANUAL IMPORT ===== */}
                    {step === 'manual_import' && (
                        <motion.div key="manual_import" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                            <div className="text-center space-y-4">
                                <Badge className="bg-primary/10 text-primary border-0 rounded-none text-[9px] uppercase tracking-widest">
                                    Manual Import — {capturedCount}/3 Validated
                                </Badge>
                                <h1 className="font-serif text-4xl text-primary">Upload Your Angles</h1>
                                <p className="text-muted-foreground max-w-lg mx-auto text-sm">
                                    Upload a photo for each required angle. Our AI will validate quality and suitability in real-time.
                                </p>
                            </div>

                            {/* 3-Zone Upload Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {REQUIRED_ANGLES.map((angle) => {
                                    const cap = captures[angle.key]
                                    const validation = cap.validation

                                    return (
                                        <div key={angle.key} className="space-y-4">
                                            {/* Upload Zone */}
                                            <div
                                                className={`relative aspect-[3/4] border-2 border-dashed transition-all duration-500 overflow-hidden cursor-pointer group ${cap.validated
                                                    ? 'border-primary bg-primary/5'
                                                    : validation && !validation.suitable
                                                        ? 'border-red-300 bg-red-50'
                                                        : 'border-nimbus hover:border-primary/50 bg-white'
                                                    }`}
                                                onClick={() => fileRefs.current[angle.key]?.click()}
                                            >
                                                <input
                                                    ref={el => { fileRefs.current[angle.key] = el }}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0]
                                                        if (f) handleManualUpload(angle.key, f)
                                                        e.target.value = ''
                                                    }}
                                                />

                                                {cap.preview ? (
                                                    <>
                                                        <img src={cap.preview} alt={angle.label} className="w-full h-full object-cover" />
                                                        {/* Status overlay */}
                                                        <div className="absolute top-3 right-3">
                                                            {cap.uploading ? (
                                                                <Badge className="bg-white/90 border-0 rounded-none text-[9px]">
                                                                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing
                                                                </Badge>
                                                            ) : cap.validated ? (
                                                                <Badge className="bg-green-500 text-white border-0 rounded-none text-[9px]">
                                                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Validated
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-red-500 text-white border-0 rounded-none text-[9px]">
                                                                    <XCircle className="w-3 h-3 mr-1" /> Rejected
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {/* Replace overlay on hover */}
                                                        {!cap.uploading && (
                                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <div className="text-center text-white space-y-2">
                                                                    <RefreshCcw className="w-6 h-6 mx-auto" />
                                                                    <p className="text-[10px] uppercase tracking-widest font-bold">Replace</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                                                        <div className="w-16 h-16 rounded-full border-2 border-nimbus flex items-center justify-center group-hover:border-primary transition-colors">
                                                            <ImagePlus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-bold uppercase tracking-widest text-foreground">{angle.label}</p>
                                                            <p className="text-[10px] text-muted-foreground mt-1">{angle.desc}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Validation Feedback */}
                                            {validation && !cap.validated && (
                                                <div className="space-y-2 p-4 bg-red-50 border border-red-200">
                                                    <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest">
                                                        {validation.overall_message}
                                                    </p>
                                                    {validation.issues.map((issue, i) => (
                                                        <p key={i} className="text-[9px] text-red-500 flex items-start gap-1">
                                                            <XCircle className="w-3 h-3 mt-0.5 shrink-0" /> {issue}
                                                        </p>
                                                    ))}
                                                    <button
                                                        onClick={() => fileRefs.current[angle.key]?.click()}
                                                        className="text-[9px] text-primary font-bold uppercase tracking-widest mt-2 hover:text-foreground transition-colors"
                                                    >
                                                        <RotateCcw className="w-3 h-3 inline mr-1" /> Upload Different Photo
                                                    </button>
                                                </div>
                                            )}

                                            {cap.validated && validation && (
                                                <div className="space-y-1 p-3 bg-primary/5 border border-primary/20">
                                                    {Object.entries(validation.checks).map(([key, check]) => (
                                                        <div key={key} className="flex items-center gap-2">
                                                            <CheckCircle2 className="w-3 h-3 text-primary" />
                                                            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{key.replace('_', ' ')}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Missing angle prompt */}
                            {capturedCount > 0 && !allCaptured && (
                                <div className="text-center p-6 bg-primary/5 border border-primary/20">
                                    <p className="text-xs text-primary font-bold uppercase tracking-widest">
                                        <Eye className="w-4 h-4 inline mr-2" />
                                        Missing: {REQUIRED_ANGLES.filter(a => !captures[a.key].validated).map(a => a.label).join(', ')}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                        Upload the remaining angle{3 - capturedCount > 1 ? 's' : ''} to complete your Digital Essence profile.
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-between items-center">
                                <button onClick={handleStartOver} className="text-[10px] text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-3 h-3 inline mr-1" /> Start over
                                </button>
                                <Button
                                    onClick={() => setStep('synthesis')}
                                    disabled={!allCaptured}
                                    className={`h-14 px-10 text-sm uppercase tracking-[0.2em] font-bold rounded-none transition-all ${allCaptured
                                        ? 'bg-foreground text-background hover:bg-primary hover:text-white shadow-xl'
                                        : 'bg-nimbus/20 text-muted-foreground cursor-not-allowed'
                                        }`}
                                >
                                    Complete Profile <ArrowRight className="w-4 h-4 ml-3" />
                                </Button>
                            </div>

                            {error && (
                                <p className="text-xs text-red-500 text-center uppercase tracking-widest">{error}</p>
                            )}
                        </motion.div>
                    )}

                    {/* ===== STEP: SYNTHESIS ===== */}
                    {step === 'synthesis' && (
                        <motion.div key="synthesis" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-12">
                            <div className="text-center space-y-4">
                                <h2 className="font-serif text-4xl text-primary">Profile Complete</h2>
                                <p className="text-muted-foreground max-w-lg mx-auto">
                                    All 3 angles captured and validated. Ready to synthesize your Master Identity portrait.
                                </p>
                            </div>

                            {/* Preview Grid */}
                            <div className="flex justify-center gap-6">
                                {REQUIRED_ANGLES.map((a, i) => (
                                    <div key={a.key} className={`bg-white p-2 shadow-lg ${i === 0 ? 'rotate-[-3deg]' : i === 2 ? 'rotate-[3deg]' : ''
                                        }`}>
                                        <div className="w-40 aspect-[3/4] bg-black overflow-hidden">
                                            {captures[a.key].preview && (
                                                <img src={captures[a.key].preview!} alt={a.label} className="w-full h-full object-cover" />
                                            )}
                                        </div>
                                        <p className="text-[9px] text-center pt-2 uppercase tracking-widest text-muted-foreground font-bold">{a.label}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="text-center space-y-4">
                                <Button
                                    onClick={handleSynthesize}
                                    className="h-16 px-12 text-sm uppercase tracking-[0.2em] font-bold rounded-none bg-foreground text-background hover:bg-primary hover:text-white transition-all shadow-xl hover:shadow-2xl"
                                >
                                    <Sparkles className="w-4 h-4 mr-3" /> Synthesize Master Identity
                                </Button>
                                {error && (
                                    <p className="text-xs text-red-500 uppercase tracking-widest">{error}</p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* ===== STEP: GENERATING ===== */}
                    {step === 'generating' && (() => {
                        const stages = [
                            { key: 'front', label: 'Front Profile', icon: '👤' },
                            { key: 'profile', label: 'Side Profile', icon: '👥' },
                            { key: 'three_quarter', label: '¾ View', icon: '🎭' },
                        ]
                        const tips = [
                            'Sculpting front profile from your selfie data…',
                            'Mapping side-profile bone structure…',
                            'Rendering three-quarter perspective…',
                            'Enhancing 4K skin-texture fidelity…',
                            'Calibrating studio lighting & white cyclorama…',
                            'Refining anatomical proportions…',
                            'Almost there — final quality pass…',
                        ]
                        return (
                            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-10 text-center py-16 max-w-lg mx-auto">
                                {/* Pulsing orb */}
                                <div className="relative w-24 h-24 mx-auto">
                                    <div className="absolute inset-0 border border-nimbus/30 rounded-full animate-ping" />
                                    <div className="absolute inset-4 border border-nimbus/60 rounded-full animate-ping" style={{ animationDelay: '0.4s' }} />
                                    <div className="absolute inset-8 bg-foreground rounded-full animate-pulse" />
                                </div>

                                <div className="space-y-2">
                                    <h2 className="font-serif text-3xl text-primary">Synthesizing Identity</h2>
                                    <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">
                                        Generating 3 master portraits from your multi-angle data
                                    </p>
                                </div>

                                {/* Progress bar */}
                                <div className="space-y-3">
                                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-nimbus via-primary to-nimbus rounded-full"
                                            initial={{ width: '2%' }}
                                            animate={{ width: '95%' }}
                                            transition={{ duration: 360, ease: 'linear' }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
                                        <RotatingTip tips={tips} />
                                        <ElapsedTimer />
                                    </div>
                                </div>

                                {/* Angle stage indicators */}
                                <div className="flex justify-center gap-6 pt-2">
                                    {stages.map((s, i) => (
                                        <div key={s.key} className="flex flex-col items-center gap-2">
                                            <motion.div
                                                className="w-14 h-14 rounded-full border border-border/50 flex items-center justify-center text-2xl bg-card/50"
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 2, repeat: Infinity, delay: i * 0.6 }}
                                            >
                                                {s.icon}
                                            </motion.div>
                                            <span className="text-[9px] text-muted-foreground uppercase tracking-widest">{s.label}</span>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-muted-foreground/60 text-[10px]">
                                    This takes 3 – 6 minutes · Do not close this tab
                                </p>
                            </motion.div>
                        )
                    })()}

                    {/* ===== STEP: DONE ===== */}
                    {step === 'done' && identity?.master_identity_url && (
                        <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12 text-center">
                            <div className="space-y-4">
                                <h2 className="font-serif text-5xl text-primary">Identity Established</h2>
                                <p className="text-muted-foreground text-sm uppercase tracking-widest">
                                    Your multi-angle digital twin is ready for editorial production.
                                </p>
                            </div>

                            <div className="flex gap-4 max-w-4xl mx-auto items-center justify-center flex-wrap">
                                {/* Source thumbnails */}
                                <div className="flex gap-3">
                                    {REQUIRED_ANGLES.map((a, i) => (
                                        captures[a.key].preview && (
                                            <div key={a.key} className={`w-24 bg-white p-1 shadow-md opacity-60 hover:opacity-100 transition-opacity ${i === 0 ? 'rotate-2' : i === 2 ? '-rotate-2' : 'rotate-1'
                                                }`}>
                                                <img src={captures[a.key].preview!} alt={a.label} className="w-full grayscale" />
                                                <p className="text-[7px] text-center pt-1 uppercase tracking-widest text-muted-foreground">{a.label}</p>
                                            </div>
                                        )
                                    ))}
                                </div>

                                <ArrowRight className="w-8 h-8 text-nimbus" />

                                {/* Master Identity */}
                                <div className="w-72 -rotate-1 bg-white p-3 shadow-2xl relative z-10 scale-110">
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

// ── Utility ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}
