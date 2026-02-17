'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FaceDetectorResult {
    /** Bounding box as fractions of video dimensions (0–1) */
    box: { x: number; y: number; width: number; height: number } | null
    /** Face center as fraction (0–1) */
    center: { x: number; y: number } | null
    /** Face width as fraction of video width (0–1) */
    faceWidthFraction: number
    /** Estimated yaw in degrees (positive = turned left, negative = turned right) */
    yaw: number
    /** Whether the face position has been stable for ≥500ms */
    stable: boolean
    /** Whether the detector is loaded and running */
    ready: boolean
    /** Whether a face is currently detected */
    detected: boolean
}

const STABILITY_THRESHOLD = 0.03 // 3% movement tolerance
const STABILITY_DURATION = 500   // ms of stillness required

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Client-side face detection using MediaPipe FaceDetection.
 * Runs entirely in the browser — no API calls.
 * 
 * @param videoRef - ref to the <video> element to analyze
 * @param active - whether detection should be running
 * @param fps - target detection frequency (default 10)
 */
export function useFaceDetector(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    active: boolean,
    fps: number = 10
): FaceDetectorResult {
    const [result, setResult] = useState<FaceDetectorResult>({
        box: null,
        center: null,
        faceWidthFraction: 0,
        yaw: 0,
        stable: false,
        ready: false,
        detected: false,
    })

    const detectorRef = useRef<any>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const lastCenterRef = useRef<{ x: number; y: number } | null>(null)
    const stableStartRef = useRef<number>(0)
    const mountedRef = useRef(true)

    // Initialize MediaPipe FaceDetection
    useEffect(() => {
        if (!active) return
        mountedRef.current = true

        let cancelled = false

        async function init() {
            try {
                // Dynamic import to avoid SSR issues
                const { FaceDetection } = await import('@mediapipe/face_detection')

                if (cancelled) return

                const detector = new FaceDetection({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
                })

                detector.setOptions({
                    model: 'short',           // Lightweight model
                    minDetectionConfidence: 0.5,
                })

                detector.onResults((results: any) => {
                    if (!mountedRef.current) return
                    processResults(results)
                })

                detectorRef.current = detector

                if (mountedRef.current) {
                    setResult(prev => ({ ...prev, ready: true }))
                }
            } catch (err) {
                console.error('Failed to initialize face detector:', err)
            }
        }

        init()

        return () => {
            cancelled = true
            mountedRef.current = false
        }
    }, [active])

    // Process detection results
    const processResults = useCallback((results: any) => {
        if (!results.detections || results.detections.length === 0) {
            setResult(prev => ({
                ...prev,
                box: null,
                center: null,
                faceWidthFraction: 0,
                yaw: 0,
                stable: false,
                detected: false,
            }))
            lastCenterRef.current = null
            return
        }

        const detection = results.detections[0]
        const bbox = detection.boundingBox

        // Bounding box (normalized 0–1)
        const box = {
            x: bbox.xCenter - bbox.width / 2,
            y: bbox.yCenter - bbox.height / 2,
            width: bbox.width,
            height: bbox.height,
        }

        const center = { x: bbox.xCenter, y: bbox.yCenter }
        const faceWidthFraction = bbox.width

        // ── Yaw Estimation from Keypoints ────────────────────────
        // MediaPipe face detection keypoints:
        // 0: right eye, 1: left eye, 2: nose tip, 3: mouth center,
        // 4: right ear tragion, 5: left ear tragion
        let yaw = 0
        const keypoints = detection.landmarks
        if (keypoints && keypoints.length >= 6) {
            const nose = keypoints[2]
            const rightEar = keypoints[4]
            const leftEar = keypoints[5]

            if (nose && rightEar && leftEar) {
                const earSpan = leftEar.x - rightEar.x
                if (Math.abs(earSpan) > 0.01) {
                    // Nose position relative to ear midpoint
                    const earMid = (leftEar.x + rightEar.x) / 2
                    const noseOffset = (nose.x - earMid) / (earSpan / 2)
                    // Map to approximate degrees (-90 to 90)
                    yaw = Math.atan(noseOffset * 2) * (180 / Math.PI)
                }
            }
        }

        // ── Stability Detection ──────────────────────────────────
        let stable = false
        const now = Date.now()
        const lastCenter = lastCenterRef.current

        if (lastCenter) {
            const dx = Math.abs(center.x - lastCenter.x)
            const dy = Math.abs(center.y - lastCenter.y)

            if (dx < STABILITY_THRESHOLD && dy < STABILITY_THRESHOLD) {
                if (stableStartRef.current === 0) {
                    stableStartRef.current = now
                } else if (now - stableStartRef.current >= STABILITY_DURATION) {
                    stable = true
                }
            } else {
                stableStartRef.current = 0
            }
        } else {
            stableStartRef.current = now
        }

        lastCenterRef.current = center

        setResult({
            box,
            center,
            faceWidthFraction,
            yaw,
            stable,
            ready: true,
            detected: true,
        })
    }, [])

    // Run detection at target FPS
    useEffect(() => {
        if (!active || !detectorRef.current) return

        const detect = async () => {
            const video = videoRef.current
            const detector = detectorRef.current
            if (!video || !detector || video.readyState < 2) return

            try {
                await detector.send({ image: video })
            } catch {
                // Frame send failed — skip
            }
        }

        intervalRef.current = setInterval(detect, 1000 / fps)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [active, fps, videoRef, result.ready])

    // Cleanup
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
            mountedRef.current = false
            detectorRef.current = null
        }
    }, [])

    return result
}
