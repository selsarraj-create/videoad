"""
Preset Library — Hidden prompts for fashion video generation.
Users pick a "vibe", we inject the actual cinematic prompt.
"""

PRESETS = {
    "paris-strut": {
        "id": "paris-strut",
        "name": "Paris Strut",
        "category": "Editorial",
        "prompt": (
            "High fashion model walking confidently towards the camera on a sunlit Parisian "
            "cobblestone street, golden hour warm light casting long shadows, cinematic 35mm "
            "anamorphic lens, slow motion fabric movement with natural wind, boutique storefronts "
            "slightly blurred in background, editorial Vogue aesthetic, shallow depth of field"
        ),
        "camera_move": "static",
        "duration": 8,
    },
    "studio-spin": {
        "id": "studio-spin",
        "name": "Studio Spin",
        "category": "Product",
        "prompt": (
            "Fashion model standing center frame in a pristine white cyclorama studio, smooth "
            "360-degree rotation showcasing the full outfit, professional soft box lighting with "
            "subtle rim light, clean shadow on floor, high-end editorial fashion photography, "
            "neutral expression, 4K detail on fabric texture"
        ),
        "camera_move": "pan_left",
        "duration": 8,
    },
    "beach-walk": {
        "id": "beach-walk",
        "name": "Beach Walk",
        "category": "Lifestyle",
        "prompt": (
            "Model walking barefoot along a pristine shoreline at golden sunset, gentle ocean "
            "breeze flowing through hair and fabric, warm amber and teal color grading, "
            "lifestyle fashion editorial, waves softly lapping at feet, drone following shot "
            "from slight elevation, relaxed confident stride"
        ),
        "camera_move": "pan_right",
        "duration": 8,
    },
    "street-style": {
        "id": "street-style",
        "name": "Street Style",
        "category": "Urban",
        "prompt": (
            "Fashion model striking dynamic poses against a vibrant graffiti-covered brick wall "
            "in an urban alley, streetwear energy, Dutch angle camera slowly tilting, neon "
            "signage reflections, moody cinematic grade with high contrast, confident attitude, "
            "hip-hop editorial style"
        ),
        "camera_move": "tilt_up",
        "duration": 8,
    },
    "runway": {
        "id": "runway",
        "name": "Runway",
        "category": "High Fashion",
        "prompt": (
            "High fashion runway walk, model striding powerfully towards camera on an elevated "
            "catwalk, dramatic single spotlight from above, moody dark atmosphere with subtle "
            "haze, fashion week energy, front row silhouettes slightly visible, professional "
            "model posture, fabric catching the light"
        ),
        "camera_move": "static",
        "duration": 8,
    },
    "golden-hour": {
        "id": "golden-hour",
        "name": "Golden Hour",
        "category": "Lifestyle",
        "prompt": (
            "Model standing in a wheat field at magic hour, warm golden sunlight streaming "
            "through, gentle lens flare, bohemian editorial mood, fabric billowing in soft "
            "breeze, shallow depth of field with bokeh, slow cinematic push-in, romantic "
            "color palette with rich warm tones"
        ),
        "camera_move": "zoom_in",
        "duration": 8,
    },
    "luxury-hotel": {
        "id": "luxury-hotel",
        "name": "Luxury Hotel",
        "category": "Editorial",
        "prompt": (
            "Fashion model leaning against a marble column in a grand luxury hotel lobby, "
            "ornate chandelier overhead, polished floor reflections, old-money aesthetic, "
            "soft natural light through tall windows, cinematic medium shot slowly pulling "
            "back to reveal the opulent interior, sophisticated and elegant"
        ),
        "camera_move": "zoom_out",
        "duration": 8,
    },
    "neon-nights": {
        "id": "neon-nights",
        "name": "Neon Nights",
        "category": "Urban",
        "prompt": (
            "Model walking through a rain-slicked Tokyo street at night, vibrant neon signs "
            "reflecting on wet pavement, cyberpunk color palette with magenta and electric blue, "
            "cinematic shallow DOF, steam rising from grates, dramatic low-angle tracking shot, "
            "futuristic fashion editorial"
        ),
        "camera_move": "pan_left",
        "duration": 8,
    },
}


def get_prompt(preset_id: str) -> str:
    """Get the hidden prompt for a preset. Raises if preset not found."""
    preset = PRESETS.get(preset_id)
    if not preset:
        raise ValueError(f"Unknown preset: {preset_id}. Available: {list(PRESETS.keys())}")
    return preset["prompt"]


def get_preset(preset_id: str) -> dict:
    """Get full preset config including camera_move and duration."""
    preset = PRESETS.get(preset_id)
    if not preset:
        raise ValueError(f"Unknown preset: {preset_id}")
    return preset
