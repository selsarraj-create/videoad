'use client'

import { useState, useEffect } from 'react'

// ── Rotating Tips ────────────────────────────────────────────────────────────
const WAIT_TIPS = [
    'Our AI models are crafting your video frame by frame…',
    'Each video is custom-generated — no templates, ever.',
    'Tip: Higher resolution takes a little longer but looks amazing.',
    'Your position in the queue is being updated live.',
    'Fun fact: Veo 3.1 renders at cinematic quality.',
    'Almost there — great things take a moment.',
]

interface QueueStatus {
    position: number
    estimated_wait_seconds: number
    queue_length: number
    status: string
}

interface WaitRoomProps {
    jobId: string
    onComplete?: () => void
    onError?: (error: string) => void
}

export default function WaitRoom({ jobId, onComplete, onError }: WaitRoomProps) {
    const [queueStatus, setQueueStatus] = useState<QueueStatus>({
        position: 0,
        estimated_wait_seconds: 0,
        queue_length: 0,
        status: 'queued',
    })
    const [tipIndex, setTipIndex] = useState(0)
    const [elapsedSeconds, setElapsedSeconds] = useState(0)
    const [dotCount, setDotCount] = useState(1)

    // Poll queue status every 3s
    useEffect(() => {
        let mounted = true

        const poll = async () => {
            try {
                const res = await fetch(`/api/queue-status?job_id=${jobId}`)
                if (!res.ok) throw new Error('Failed to fetch queue status')
                const data: QueueStatus = await res.json()
                if (!mounted) return
                setQueueStatus(data)

                if (data.status === 'completed' || data.status === 'processing') {
                    onComplete?.()
                } else if (data.status === 'failed') {
                    onError?.('Video generation failed')
                }
            } catch {
                // Silently retry
            }
        }

        poll()
        const interval = setInterval(poll, 3000)
        return () => {
            mounted = false
            clearInterval(interval)
        }
    }, [jobId, onComplete, onError])

    // Rotate tips every 5s
    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % WAIT_TIPS.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    // Elapsed timer
    useEffect(() => {
        const interval = setInterval(() => {
            setElapsedSeconds((prev) => prev + 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    // Animated dots
    useEffect(() => {
        const interval = setInterval(() => {
            setDotCount((prev) => (prev % 3) + 1)
        }, 600)
        return () => clearInterval(interval)
    }, [])

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    const dots = '.'.repeat(dotCount)

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2rem',
            padding: '3rem 2rem',
            minHeight: '360px',
        }}>
            {/* Progress Ring */}
            <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                    {/* Track */}
                    <circle
                        cx="60" cy="60" r="52"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="6"
                    />
                    {/* Animated arc */}
                    <circle
                        cx="60" cy="60" r="52"
                        fill="none"
                        stroke="url(#waitGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="327"
                        strokeDashoffset={queueStatus.position > 0 ? 327 * 0.75 : 327 * 0.15}
                        style={{
                            transition: 'stroke-dashoffset 1s ease',
                            transform: 'rotate(-90deg)',
                            transformOrigin: '50% 50%',
                        }}
                    />
                    <defs>
                        <linearGradient id="waitGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#a78bfa" />
                            <stop offset="50%" stopColor="#818cf8" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>
                </svg>
                {/* Center text */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                }}>
                    {queueStatus.position > 0 ? (
                        <>
                            <div style={{
                                fontSize: '2rem',
                                fontWeight: 700,
                                color: '#a78bfa',
                                lineHeight: 1,
                            }}>
                                #{queueStatus.position}
                            </div>
                            <div style={{
                                fontSize: '0.65rem',
                                color: 'rgba(255,255,255,0.5)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginTop: 4,
                            }}>
                                in queue
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: '#6ee7b7',
                                lineHeight: 1,
                            }}>
                                ✦
                            </div>
                            <div style={{
                                fontSize: '0.6rem',
                                color: 'rgba(255,255,255,0.5)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                marginTop: 4,
                            }}>
                                rendering
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Status label */}
            <div style={{ textAlign: 'center' }}>
                <h3 style={{
                    fontSize: '1.15rem',
                    fontWeight: 600,
                    color: '#fff',
                    margin: 0,
                }}>
                    {queueStatus.position > 0
                        ? `Your task is #${queueStatus.position} in the queue${dots}`
                        : `Generating your video${dots}`
                    }
                </h3>

                {queueStatus.estimated_wait_seconds > 0 && (
                    <p style={{
                        fontSize: '0.85rem',
                        color: 'rgba(255,255,255,0.5)',
                        margin: '0.5rem 0 0',
                    }}>
                        Estimated wait: ~{Math.ceil(queueStatus.estimated_wait_seconds / 60)} min
                    </p>
                )}
            </div>

            {/* Stats row */}
            <div style={{
                display: 'flex',
                gap: '2rem',
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.4)',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                        {formatTime(elapsedSeconds)}
                    </div>
                    <div>elapsed</div>
                </div>
                <div style={{
                    width: 1,
                    background: 'rgba(255,255,255,0.1)',
                }} />
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                        {queueStatus.queue_length}
                    </div>
                    <div>in queue</div>
                </div>
            </div>

            {/* Rotating tip */}
            <p style={{
                fontSize: '0.8rem',
                color: 'rgba(255,255,255,0.35)',
                fontStyle: 'italic',
                textAlign: 'center',
                maxWidth: 360,
                minHeight: '2.5em',
                transition: 'opacity 0.5s ease',
            }}>
                {WAIT_TIPS[tipIndex]}
            </p>

            {/* Do not close warning */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                borderRadius: 8,
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.15)',
                fontSize: '0.7rem',
                color: '#fbbf24',
            }}>
                <span>⚠</span>
                <span>Do not close this tab — your position will be lost</span>
            </div>

            {/* Keyframe animation for the progress ring pulse */}
            <style>{`
                @keyframes waitRingPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `}</style>
        </div>
    )
}
