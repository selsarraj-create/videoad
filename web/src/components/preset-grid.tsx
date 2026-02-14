"use client"

import { PRESETS, PRESET_CATEGORIES, type Preset } from "@/lib/presets"

interface PresetGridProps {
    selectedPresetId: string | null
    onSelect: (preset: Preset) => void
}

export function PresetGrid({ selectedPresetId, onSelect }: PresetGridProps) {
    return (
        <div className="space-y-4">
            {PRESET_CATEGORIES.map(category => (
                <div key={category}>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-2">
                        {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {PRESETS.filter(p => p.category === category).map(preset => {
                            const isSelected = selectedPresetId === preset.id
                            return (
                                <button
                                    key={preset.id}
                                    onClick={() => onSelect(preset)}
                                    className={`relative p-3 rounded-xl text-left transition-all duration-200 group
                                        ${isSelected
                                            ? 'bg-purple-900/30 border-purple-500/60 ring-1 ring-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                            : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60'
                                        } border`}
                                >
                                    <div className="text-2xl mb-1.5">{preset.emoji}</div>
                                    <div className={`text-xs font-bold ${isSelected ? 'text-purple-300' : 'text-zinc-300'}`}>
                                        {preset.name}
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
                                        {preset.description}
                                    </p>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
