/**
 * Preset Library — Curated fashion video vibes with hidden prompts.
 * Users select a visual vibe; actual prompt is injected from here.
 */

export interface Preset {
    id: string
    name: string
    category: string
    emoji: string
    description: string
    hiddenPrompt: string  // Never shown to user
    cameraMove: string
    duration: number
}

export const PRESETS: Preset[] = [
    {
        id: "paris-strut",
        name: "Paris Strut",
        category: "Editorial",
        emoji: "🗼",
        description: "Golden hour walk on Parisian cobblestones",
        hiddenPrompt: "High fashion model walking confidently towards the camera on a sunlit Parisian cobblestone street, golden hour warm light casting long shadows, cinematic 35mm anamorphic lens, slow motion fabric movement with natural wind, boutique storefronts slightly blurred in background, editorial Vogue aesthetic, shallow depth of field",
        cameraMove: "static",
        duration: 8,
    },
    {
        id: "studio-spin",
        name: "Studio Spin",
        category: "Product",
        emoji: "🎬",
        description: "Clean studio rotation showcasing full outfit",
        hiddenPrompt: "Fashion model standing center frame in a pristine white cyclorama studio, smooth 360-degree rotation showcasing the full outfit, professional soft box lighting with subtle rim light, clean shadow on floor, high-end editorial fashion photography, neutral expression, 4K detail on fabric texture",
        cameraMove: "pan_left",
        duration: 8,
    },
    {
        id: "beach-walk",
        name: "Beach Walk",
        category: "Lifestyle",
        emoji: "🏖️",
        description: "Sunset shoreline walk with ocean breeze",
        hiddenPrompt: "Model walking barefoot along a pristine shoreline at golden sunset, gentle ocean breeze flowing through hair and fabric, warm amber and teal color grading, lifestyle fashion editorial, waves softly lapping at feet, drone following shot from slight elevation, relaxed confident stride",
        cameraMove: "pan_right",
        duration: 8,
    },
    {
        id: "street-style",
        name: "Street Style",
        category: "Urban",
        emoji: "🎨",
        description: "Dynamic poses against graffiti walls",
        hiddenPrompt: "Fashion model striking dynamic poses against a vibrant graffiti-covered brick wall in an urban alley, streetwear energy, Dutch angle camera slowly tilting, neon signage reflections, moody cinematic grade with high contrast, confident attitude, hip-hop editorial style",
        cameraMove: "tilt_up",
        duration: 8,
    },
    {
        id: "runway",
        name: "Runway",
        category: "High Fashion",
        emoji: "💎",
        description: "Dramatic catwalk under spotlight",
        hiddenPrompt: "High fashion runway walk, model striding powerfully towards camera on an elevated catwalk, dramatic single spotlight from above, moody dark atmosphere with subtle haze, fashion week energy, front row silhouettes slightly visible, professional model posture, fabric catching the light",
        cameraMove: "static",
        duration: 8,
    },
    {
        id: "golden-hour",
        name: "Golden Hour",
        category: "Lifestyle",
        emoji: "🌾",
        description: "Magic hour in a wheat field, bohemian vibes",
        hiddenPrompt: "Model standing in a wheat field at magic hour, warm golden sunlight streaming through, gentle lens flare, bohemian editorial mood, fabric billowing in soft breeze, shallow depth of field with bokeh, slow cinematic push-in, romantic color palette with rich warm tones",
        cameraMove: "zoom_in",
        duration: 8,
    },
    {
        id: "luxury-hotel",
        name: "Luxury Hotel",
        category: "Editorial",
        emoji: "🏛️",
        description: "Elegant old-money hotel lobby aesthetic",
        hiddenPrompt: "Fashion model leaning against a marble column in a grand luxury hotel lobby, ornate chandelier overhead, polished floor reflections, old-money aesthetic, soft natural light through tall windows, cinematic medium shot slowly pulling back to reveal the opulent interior, sophisticated and elegant",
        cameraMove: "zoom_out",
        duration: 8,
    },
    {
        id: "neon-nights",
        name: "Neon Nights",
        category: "Urban",
        emoji: "🌃",
        description: "Rain-slicked Tokyo streets, cyberpunk glow",
        hiddenPrompt: "Model walking through a rain-slicked Tokyo street at night, vibrant neon signs reflecting on wet pavement, cyberpunk color palette with magenta and electric blue, cinematic shallow DOF, steam rising from grates, dramatic low-angle tracking shot, futuristic fashion editorial",
        cameraMove: "pan_left",
        duration: 8,
    },
]

export function getPreset(id: string): Preset | undefined {
    return PRESETS.find(p => p.id === id)
}

export const PRESET_CATEGORIES = [...new Set(PRESETS.map(p => p.category))]
