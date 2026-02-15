// ── Speech Utilities ─────────────────────────────────────────────────────────
// Reusable TTS module using the native Web Speech API.
// Provides a queued utterance system with voice preference and mute support.

// ── Voice Selection ──────────────────────────────────────────────────────────

const PREFERRED_VOICES = [
    'Google US English',
    'Samantha',           // macOS high-quality
    'Alex',               // macOS
    'Microsoft Zira',     // Windows
    'Microsoft David',    // Windows
]

/**
 * Returns the best available SpeechSynthesisVoice, preferring professional-
 * sounding English voices. Falls back to any English voice, then the default.
 */
export function getPreferredVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null

    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    // Try preferred voices first
    for (const name of PREFERRED_VOICES) {
        const match = voices.find(v => v.name === name)
        if (match) return match
    }

    // Fallback: any English voice
    const english = voices.find(v => v.lang.startsWith('en'))
    if (english) return english

    // Last resort: first available
    return voices[0] ?? null
}

// ── Director Lines ───────────────────────────────────────────────────────────

export const DIRECTOR_LINES: Record<string, string> = {
    // Session start
    session_start: 'AI Director is active. Let\'s begin with your frontal view.',

    // Per-angle ready cues
    ready_front: 'Ready for your frontal view. Face the camera directly with your arms slightly away from your body.',
    ready_profile: 'Now turn 90 degrees to your left for the profile shot.',
    ready_three_quarter: 'Great. Now turn 45 degrees back toward the camera for the three-quarter view.',
    ready_face_front: 'Time for a close-up. Move closer so your head and shoulders fill the frame, looking straight at the camera.',
    ready_face_side: 'Last one. Turn your head 90 degrees to the side for the face profile close-up.',

    // Capture confirmations
    captured_front: 'Excellent. Front view captured.',
    captured_profile: 'Profile captured perfectly.',
    captured_three_quarter: 'Three-quarter view locked in.',
    captured_face_front: 'Face front captured beautifully.',
    captured_face_side: 'Face side captured. All angles complete.',

    // Coaching
    hold_steady: 'Hold steady. Scanning your pose now.',

    // Completion
    all_complete: 'All angles captured. You\'re ready to synthesize your master identity.',

    // Synthesis
    synthesis_start: 'Synthesis has begun. Your master identity is being generated.',
    synthesis_done: 'Your digital identity is ready. Welcome to the studio.',
}

// ── Speech Queue ─────────────────────────────────────────────────────────────

export class SpeechQueue {
    private queue: string[] = []
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

        // Voices often load async — listen for the event
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
    enqueue(text: string) {
        if (this._muted) return
        if (typeof window === 'undefined' || !window.speechSynthesis) return

        this.queue.push(text)
        if (!this.speaking) this.processNext()
    }

    /** Speak a director line by key. Looks up from DIRECTOR_LINES. */
    speak(key: string) {
        const line = DIRECTOR_LINES[key]
        if (line) this.enqueue(line)
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

        const text = this.queue.shift()!
        const utterance = new SpeechSynthesisUtterance(text)

        // Apply calm, authoritative tone
        utterance.rate = 0.9
        utterance.pitch = 1.0
        utterance.volume = 1.0

        if (this.voice) {
            utterance.voice = this.voice
        }

        utterance.onend = () => this.processNext()
        utterance.onerror = () => this.processNext()

        this.speaking = true
        this.onSpeakingChange?.(true)
        window.speechSynthesis.speak(utterance)
    }
}
