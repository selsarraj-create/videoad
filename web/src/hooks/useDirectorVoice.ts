'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { SpeechQueue } from '@/lib/speech-utils'

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 'guide' | 'mode_select' | 'ai_director' | 'manual_import' | 'synthesis' | 'generating' | 'done'
type Angle = 'front' | 'profile' | 'three_quarter' | 'face_front' | 'face_side'

interface AngleCapture {
    preview: string | null
    url: string | null
    validated: boolean
}

interface UseDirectorVoiceParams {
    step: Step
    currentAngleIdx: number
    captures: Record<Angle, AngleCapture>
    muted: boolean
    userHasInteracted: boolean
}

const ANGLE_KEYS: Angle[] = ['front', 'profile', 'three_quarter', 'face_front', 'face_side']

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDirectorVoice({
    step,
    currentAngleIdx,
    captures,
    muted,
    userHasInteracted,
}: UseDirectorVoiceParams) {
    const queueRef = useRef<SpeechQueue | null>(null)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const prevStepRef = useRef<Step | null>(null)
    const prevAngleIdxRef = useRef<number>(-1)
    const prevCapturedRef = useRef<Set<Angle>>(new Set())

    // Initialize queue after user interaction (gesture gate)
    useEffect(() => {
        if (!userHasInteracted) return
        if (queueRef.current) return

        queueRef.current = new SpeechQueue({
            muted,
            onSpeakingChange: setIsSpeaking,
        })
    }, [userHasInteracted, muted])

    // Sync mute state
    useEffect(() => {
        if (queueRef.current) {
            queueRef.current.muted = muted
        }
    }, [muted])

    // ── State-driven triggers ────────────────────────────────────────────

    // Step change → session start / all complete / synthesis
    useEffect(() => {
        const q = queueRef.current
        if (!q || !userHasInteracted) return

        const prevStep = prevStepRef.current
        prevStepRef.current = step

        if (step === 'ai_director' && prevStep !== 'ai_director') {
            q.cancel() // Clear any leftover speech
            q.speak('session_start')
        }

        if (step === 'synthesis' && prevStep === 'ai_director') {
            q.speak('all_complete')
        }

        if (step === 'generating' && prevStep !== 'generating') {
            q.speak('synthesis_start')
        }

        if (step === 'done' && prevStep !== 'done') {
            q.speak('synthesis_done')
        }
    }, [step, userHasInteracted])

    // Angle advancement → speak ready cue
    useEffect(() => {
        const q = queueRef.current
        if (!q || step !== 'ai_director') return

        if (currentAngleIdx !== prevAngleIdxRef.current) {
            const prevIdx = prevAngleIdxRef.current
            prevAngleIdxRef.current = currentAngleIdx

            // Don't speak ready cue for first angle on session start (already handled above)
            if (prevIdx === -1) return

            const angleKey = ANGLE_KEYS[currentAngleIdx]
            if (angleKey) {
                q.speak(`ready_${angleKey}`)
            }
        }
    }, [currentAngleIdx, step])

    // Capture validated → speak confirmation
    useEffect(() => {
        const q = queueRef.current
        if (!q || step !== 'ai_director') return

        for (const angle of ANGLE_KEYS) {
            if (captures[angle]?.validated && !prevCapturedRef.current.has(angle)) {
                prevCapturedRef.current.add(angle)
                q.speak(`captured_${angle}`)
            }
        }
    }, [captures, step])

    // Cleanup on unmount or step change away from ai_director
    useEffect(() => {
        return () => {
            queueRef.current?.cancel()
        }
    }, [])

    // Reset tracking refs when going back to guide / start over
    const reset = useCallback(() => {
        queueRef.current?.cancel()
        prevStepRef.current = null
        prevAngleIdxRef.current = -1
        prevCapturedRef.current = new Set()
    }, [])

    return { isSpeaking, reset }
}
