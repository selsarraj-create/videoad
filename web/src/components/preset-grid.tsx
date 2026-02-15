"use client"

import { PRESETS, PRESET_CATEGORIES, type Preset } from "@/lib/presets"

interface PresetGridProps {
    selectedPresetId: string | null
    onSelect: (preset: Preset) => void
}

export function PresetGrid({ selectedPresetId, onSelect }: PresetGridProps) {
    return (
        <div className="space-y-6">
            {PRESET_CATEGORIES.map(category => (
                <div key={category}>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 font-serif pl-1">
                        {category}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {PRESETS.filter(p => p.category === category).map(preset => {
                            const isSelected = selectedPresetId === preset.id
                            return (
                                <button
                                    key={preset.id}
                                    onClick={() => onSelect(preset)}
                                    className={`relative p-4 rounded-none text-left transition-all duration-300 group border outline-none
                                        ${isSelected
                                            ? 'bg-primary text-primary-foreground border-primary shadow-xl ring-1 ring-primary ring-offset-2 ring-offset-paper z-10'
                                            : 'bg-white/40 border-nimbus/60 hover:border-primary hover:bg-white/80 hover:shadow-md hover:z-10'
                                        }`}
                                >
                                    <div className="text-2xl mb-2 filter grayscale group-hover:grayscale-0 transition-all duration-300 transform group-hover:scale-110 origin-left">{preset.emoji}</div>
                                    <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                                        {preset.name}
                                    </div>
                                    <p className={`text-[10px] line-clamp-2 leading-relaxed font-serif italic ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                        {preset.description}
                                    </p>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white animate-pulse shadow-sm" />
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
