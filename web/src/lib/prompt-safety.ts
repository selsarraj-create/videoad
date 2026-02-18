/**
 * Prompt Safety Layer — Sanitize user prompts before sending to paid AI APIs.
 *
 * Prevents:
 *   1. NSFW/explicit content generation → API key bans from Google
 *   2. Violence, gore, shock content → ToS violations
 *   3. Political/hate imagery → platform liability
 *   4. Prompt injection attacks → model jailbreaking
 *   5. Off-platform abuse → using fashion AI for non-fashion purposes
 */

// ── Banned keyword lists (case-insensitive) ──────────────────────

const NSFW_KEYWORDS = [
    'nude', 'naked', 'nudity', 'topless', 'bottomless', 'lingerie',
    'underwear', 'bikini', 'bra', 'panties', 'nsfw', 'erotic',
    'sexual', 'sexy', 'seductive', 'provocative', 'explicit',
    'pornographic', 'fetish', 'intimate', 'xxx', 'adult content',
    'strip', 'undress', 'remove clothes', 'take off', 'transparent',
    'see-through', 'sheer', 'revealing', 'suggestive',
]

const VIOLENCE_KEYWORDS = [
    'blood', 'gore', 'murder', 'kill', 'weapon', 'gun', 'knife',
    'violence', 'violent', 'dead', 'death', 'corpse', 'injury',
    'wound', 'torture', 'abuse', 'assault', 'attack', 'war',
    'bomb', 'explosion', 'shoot', 'stab', 'mutilate',
]

const POLITICAL_HATE_KEYWORDS = [
    'nazi', 'swastika', 'confederate', 'kkk', 'white supremac',
    'racial slur', 'hate symbol', 'terrorist', 'extremist',
    'propaganda', 'fascist', 'ethnic cleansing', 'genocide',
]

const JAILBREAK_PATTERNS = [
    'ignore previous', 'ignore all', 'forget your instructions',
    'act as', 'pretend you are', 'you are now', 'jailbreak',
    'bypass', 'override', 'system prompt', 'disregard',
    'do anything now', 'dan mode', 'developer mode',
    'no restrictions', 'no rules', 'no filters',
]

// ── Core sanitization ────────────────────────────────────────────

export interface SafetyResult {
    safe: boolean
    sanitized: string
    blocked_reason?: string
    flagged_terms?: string[]
}

/**
 * Sanitize a user prompt before sending to the AI API.
 * Returns the cleaned prompt string.
 * Throws if the prompt is entirely unsafe.
 */
export function sanitizePrompt(rawPrompt: string): string {
    const result = checkPromptSafety(rawPrompt)
    if (!result.safe) {
        // Replace the unsafe prompt with a safe fallback
        return 'A fashion model walking on a runway, professional fashion photography, clean white background'
    }
    return result.sanitized
}

/**
 * Full safety check with details — for routes that want to return
 * a 400 error instead of silently replacing the prompt.
 */
export function checkPromptSafety(rawPrompt: string): SafetyResult {
    if (!rawPrompt || typeof rawPrompt !== 'string') {
        return { safe: false, sanitized: '', blocked_reason: 'empty_prompt' }
    }

    const lower = rawPrompt.toLowerCase().trim()
    const flaggedTerms: string[] = []

    // Check NSFW
    for (const keyword of NSFW_KEYWORDS) {
        if (lower.includes(keyword)) {
            flaggedTerms.push(keyword)
        }
    }

    // Check violence
    for (const keyword of VIOLENCE_KEYWORDS) {
        if (lower.includes(keyword)) {
            flaggedTerms.push(keyword)
        }
    }

    // Check political/hate
    for (const keyword of POLITICAL_HATE_KEYWORDS) {
        if (lower.includes(keyword)) {
            flaggedTerms.push(keyword)
        }
    }

    // Check jailbreak patterns
    for (const pattern of JAILBREAK_PATTERNS) {
        if (lower.includes(pattern)) {
            flaggedTerms.push(`[jailbreak: ${pattern}]`)
        }
    }

    if (flaggedTerms.length > 0) {
        return {
            safe: false,
            sanitized: rawPrompt,
            blocked_reason: 'unsafe_content',
            flagged_terms: flaggedTerms,
        }
    }

    // Strip any remaining control characters or unusual unicode
    const sanitized = rawPrompt
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars
        .replace(/\s+/g, ' ')                                // collapse whitespace
        .trim()
        .slice(0, 2000) // hard length limit

    return { safe: true, sanitized }
}
