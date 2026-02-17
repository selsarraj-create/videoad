// ── Speech Utilities ─────────────────────────────────────────────────────────
// Reusable TTS module using the native Web Speech API.
// Professional protocol voice — no filler, no fluff.

// ── Voice Selection ──────────────────────────────────────────────────────────

const PREFERRED_VOICES = [
    'Google US English',
    'Samantha',           // macOS high-quality
    'Alex',               // macOS
    'Microsoft David',    // Windows (deeper)
    'Microsoft Zira',     // Windows
]

/**
 * Returns the best available SpeechSynthesisVoice, preferring professional-
 * sounding English voices. Falls back to any English voice, then the default.
 */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    for (const name of PREFERRED_VOICES) {
        const match = voices.find(v => v.name === name)
        if (match) return match
    }

    const english = voices.find(v => v.lang.startsWith('en'))
    if (english) return english

    return voices[0] ?? null
}

// ── Director Lines (Professional Protocol) ───────────────────────────────────

export const DIRECTOR_LINES: Record<string, string> = {
    // Initialization
    session_start:
        'Director active. Prepare for Nano Master capture. Establish your mark and look into the lens.',

    // Frontal
    ready_front:
        'Frontal view. Shoulders square. Chin level. Arms clear of the body.',
    countdown_front:
        'Three. Two. One.',
    captured_front:
        'Captured.',

    // Profile
    ready_profile:
        'Turn ninety degrees to your right. Profile view. Ensure a clean silhouette.',
    countdown_profile:
        'Three. Two. One.',
    captured_profile:
        'Captured.',

    // Three-quarter
    ready_three_quarter:
        'Forty-five degrees back toward the lens. Three-quarter view. Both eyes visible.',
    countdown_three_quarter:
        'Three. Two. One.',
    captured_three_quarter:
        'Captured.',

    // Face front close-up
    ready_face_front:
        'Close-up. Step forward. Head and shoulders only. Eyes to lens.',
    countdown_face_front:
        'Three. Two. One.',
    captured_face_front:
        'Captured.',

    // Face side close-up
    ready_face_side:
        'Final angle. Turn your head ninety degrees. Face profile. Hold the line.',
    countdown_face_side:
        'Three. Two. One.',
    captured_face_side:
        'Captured.',

    // Coaching — wrong position
    hold_steady:
        'Hold position. Scanning.',
    wrong_angle:
        'Wrong angle. Adjust your position.',
    coach_front:
        'Face the lens directly. Square your shoulders.',
    coach_profile:
        'Turn further. I need a full ninety-degree profile.',
    coach_three_quarter:
        'Adjust. Forty-five degrees to the lens. Both eyes must be visible.',
    coach_face_front:
        'Step closer. Head and shoulders only. Eyes forward.',
    coach_face_side:
        'Turn your head fully to the side. Hold the profile.',
    coach_body:
        'Full body must be visible. Step back.',
    coach_silhouette:
        'Arms away from the body. Clear the silhouette.',

    // Solo Mode — Blind Guidance (rear camera)
    solo_start:
        'Solo mode activated. Point the rear camera at yourself. I will guide you by voice.',
    move_further:
        'Move the phone further away.',
    move_closer:
        'Move the phone closer.',
    move_left:
        'Move the phone to the left.',
    move_right:
        'Move the phone to the right.',
    move_up:
        'Move the phone up slightly.',
    move_down:
        'Move the phone down slightly.',
    centered:
        'Perfect. Hold still.',
    turn_left:
        'Now, turn your head slowly to the left.',
    turn_right:
        'Great. Now turn to the right.',
    snap_center:
        'Center captured.',
    snap_left:
        'Left profile captured.',
    snap_right:
        'Right profile captured.',
    solo_complete:
        'All angles captured. Excellent work.',

    // Partner Mode
    partner_start:
        'Partner mode. Have someone hold the camera. Align the face in the green box.',
    partner_aligned:
        'Aligned. Tap the shutter button.',
    partner_not_aligned:
        'Adjust the framing. Center the face in the box.',
    partner_turn_left:
        'Great. Now have them turn to the left.',
    partner_turn_right:
        'Now have them turn to the right.',
    partner_snap:
        'Captured.',

    // Countdown (used before auto-capture)
    countdown:
        'Three. Two. One.',

    // Completion
    all_complete:
        'Sequence complete. Data sent to processing. Stand by.',

    // Synthesis
    synthesis_start:
        'Synthesis initiated. Processing multi-angle data.',
    synthesis_done:
        'Identity established. Proceed to studio.',
}

// ── Shutter Click Audio Cue ──────────────────────────────────────────────────

/**
 * Plays a synthetic shutter-click sound using the Web Audio API.
 * Short, sharp transient — mimics a mechanical shutter release.
 */
export function playShutterClick(): void {
    if (typeof window === 'undefined') return

    try {
        const ctx = new AudioContext()
        const duration = 0.08

        // White noise burst for the "click"
        const bufferSize = Math.floor(ctx.sampleRate * duration)
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)

        for (let i = 0; i < bufferSize; i++) {
            // Shaped noise: sharp attack, fast decay
            const envelope = Math.exp(-i / (bufferSize * 0.15))
            data[i] = (Math.random() * 2 - 1) * envelope * 0.6
        }

        // Bandpass filter for a mechanical click character
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 3000
        filter.Q.value = 1.5

        const source = ctx.createBufferSource()
        source.buffer = buffer

        // Second click layer — tonal ping
        const osc = ctx.createOscillator()
        osc.frequency.value = 4200
        const oscGain = ctx.createGain()
        oscGain.gain.setValueAtTime(0.3, ctx.currentTime)
        oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)

        source.connect(filter)
        filter.connect(ctx.destination)
        osc.connect(oscGain)
        oscGain.connect(ctx.destination)

        source.start(ctx.currentTime)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.04)
        source.stop(ctx.currentTime + duration)

        // Clean up
        setTimeout(() => ctx.close(), 200)
    } catch {
        // Audio not available — silent fallback
    }
}

// ── Speech Queue ─────────────────────────────────────────────────────────────

type QueueItem = { text: string; onEnd?: () => void }

export class SpeechQueue {
    private queue: QueueItem[] = []
    private speaking = false
    private _muted = false
    private voice: SpeechSynthesisVoice | null = null
    private onSpeakingChange?: (speaking: boolean) => void

    constructor(opts?: { muted?: boolean; onSpeakingChange?: (speaking: boolean) => void }) {
        this._muted = opts?.muted ?? false
        this.onSpeakingChange = opts?.onSpeakingChange
        this.loadVoice()
    }

    /** Attempt to load the preferred voice. Voices may load asynchronously. */
    loadVoice() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return

        this.voice = getPreferredVoice()

        if (!this.voice) {
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                this.voice = getPreferredVoice()
            }, { once: true })
        }
    }

    get muted() { return this._muted }
    set muted(val: boolean) {
        this._muted = val
        if (val) this.cancel()
    }

    /** Add a line to the queue. No-op if muted or speech API unavailable. */
    enqueue(text: string, onEnd?: () => void) {
        if (this._muted) return
        if (typeof window === 'undefined' || !window.speechSynthesis) return

        this.queue.push({ text, onEnd })
        if (!this.speaking) this.processNext()
    }

    /** Speak a director line by key. Optionally fire a callback when it ends. */
    speak(key: string, onEnd?: () => void) {
        const line = DIRECTOR_LINES[key]
        if (line) this.enqueue(line, onEnd)
    }

    /** Speak a line and play a shutter click immediately after. */
    speakThenShutter(key: string) {
        this.speak(key, () => playShutterClick())
    }

    /** Clear the queue without interrupting the current utterance. */
    clear() {
        this.queue = []
    }

    /** Cancel everything — stop current speech and clear the queue. */
    cancel() {
        this.queue = []
        this.speaking = false
        this.onSpeakingChange?.(false)
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel()
        }
    }

    private processNext() {
        if (this.queue.length === 0) {
            this.speaking = false
            this.onSpeakingChange?.(false)
            return
        }

        const item = this.queue.shift()!
        const utterance = new SpeechSynthesisUtterance(item.text)

        // Deep, deliberate, authoritative tone
        utterance.rate = 0.85
        utterance.pitch = 0.9
        utterance.volume = 1.0

        if (this.voice) {
            utterance.voice = this.voice
        }

        utterance.onend = () => {
            item.onEnd?.()
            this.processNext()
        }
        utterance.onerror = () => this.processNext()

        this.speaking = true
        this.onSpeakingChange?.(true)
        window.speechSynthesis.speak(utterance)
    }
}
