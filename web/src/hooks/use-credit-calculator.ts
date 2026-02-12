import { useMemo } from 'react'
import { MODELS, calculateCredits } from '@/lib/models'
import { Shot } from '@/lib/types'

interface UseCreditCalculatorProps {
    mode: 'draft' | 'storyboard'
    shots: Shot[]
    selectedModelId: string
    is4k: boolean
    draftDuration?: number
}

export function useCreditCalculator({
    mode,
    shots,
    selectedModelId,
    is4k,
    draftDuration = 8
}: UseCreditCalculatorProps) {
    const totalCost = useMemo(() => {
        const model = MODELS.find(m => m.id === selectedModelId) || MODELS[0]

        if (mode === 'draft') {
            return calculateCredits(model.baseCredits, draftDuration, is4k)
        }

        return shots.reduce((acc, shot) => {
            return acc + calculateCredits(model.baseCredits, shot.duration, is4k)
        }, 0)
    }, [mode, shots, selectedModelId, is4k, draftDuration])

    return totalCost
}
