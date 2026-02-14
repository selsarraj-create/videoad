"""
Gemini integration for selfie validation and master identity generation.
Uses google-genai SDK.

Models:
  - Validation: gemini-2.0-flash (vision) for real-time selfie analysis
  - Master Identity: gemini-2.0-flash-preview-image-generation for studio portrait generation
"""

import os
import json
import base64
import httpx
from google import genai
from google.genai import types

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")


def _get_client():
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY not set")
    return genai.Client(api_key=GEMINI_API_KEY)


def _download_image_bytes(url: str) -> bytes:
    """Download image from URL and return raw bytes."""
    resp = httpx.get(url, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    return resp.content


def _guess_mime(url: str) -> str:
    lower = url.lower()
    if ".png" in lower:
        return "image/png"
    if ".webp" in lower:
        return "image/webp"
    return "image/jpeg"


# =========================================================================
# 1. Validate Selfie — Gemini Flash (Vision) — Full validation from URL
# =========================================================================

VALIDATION_PROMPT = """You are a professional photography quality inspector for a fashion AI platform.

Analyze this selfie and evaluate these 4 criteria:

1. **A-Pose** — Is the person standing with arms slightly away from the body, palms visible or facing forward? Arms must NOT be at the side or crossed. Think "airport security scanner" pose.
2. **Lighting** — Is the lighting even and natural? No harsh shadows on the face, no extreme backlighting. Soft, diffused light is ideal.
3. **Attire** — Is the person wearing form-fitting clothes? No baggy, oversized, or layered outfits. The AI needs to see body contour clearly.
4. **Resolution** — Does the image appear to be at least 2K resolution (i.e. looks detailed, not pixelated or heavily compressed)?

Return your analysis as a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "passed": true/false,
  "checks": [
    {"name": "pose", "passed": true/false, "message": "brief friendly feedback"},
    {"name": "lighting", "passed": true/false, "message": "brief friendly feedback"},
    {"name": "attire", "passed": true/false, "message": "brief friendly feedback"},
    {"name": "resolution", "passed": true/false, "message": "brief friendly feedback"}
  ]
}

"passed" is true only if ALL 4 checks pass. Be encouraging but honest. Keep messages under 12 words."""


def validate_selfie(image_url: str) -> dict:
    """
    Use Gemini Flash to validate a selfie against quality criteria.
    Returns { passed: bool, checks: [...] }
    """
    client = _get_client()
    image_bytes = _download_image_bytes(image_url)
    mime = _guess_mime(image_url)

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime),
                    types.Part.from_text(text=VALIDATION_PROMPT),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )

    raw = response.text.strip()
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        if "```" in raw:
            json_block = raw.split("```")[1]
            if json_block.startswith("json"):
                json_block = json_block[4:]
            result = json.loads(json_block.strip())
        else:
            raise Exception(f"Gemini returned invalid JSON: {raw[:200]}")

    return result


# =========================================================================
# 1b. Real-time Validation — Gemini Flash from base64 frame (no URL)
# =========================================================================

REALTIME_VALIDATION_PROMPT = """You are a live camera quality coach for a fashion AI platform.
Analyze this camera frame QUICKLY and evaluate:

1. **pose** — A-Pose? Arms away from body, palms visible? (NOT arms at sides or crossed)
2. **lighting** — Even, soft light? No harsh shadows or backlighting?
3. **attire** — Form-fitting clothes? Body contour visible? (NOT baggy or layered)
4. **resolution** — Image clear and detailed? Not blurry or pixelated?

Return ONLY this JSON (no markdown):
{
  "passed": true/false,
  "checks": [
    {"name": "pose", "passed": true/false, "message": "max 8 words coaching tip"},
    {"name": "lighting", "passed": true/false, "message": "max 8 words coaching tip"},
    {"name": "attire", "passed": true/false, "message": "max 8 words coaching tip"},
    {"name": "resolution", "passed": true/false, "message": "max 8 words coaching tip"}
  ]
}

"passed" = true only if ALL pass. Be concise. Give actionable coaching tips."""


def validate_selfie_realtime(image_base64: str) -> dict:
    """
    Validate a base64-encoded camera frame for real-time feedback.
    Optimized for speed — shorter prompt, lower token usage.
    """
    client = _get_client()

    # Parse base64 data URL
    if image_base64.startswith("data:"):
        header, b64data = image_base64.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
    else:
        b64data = image_base64
        mime = "image/jpeg"

    image_bytes = base64.b64decode(b64data)

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime),
                    types.Part.from_text(text=REALTIME_VALIDATION_PROMPT),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.05,
            response_mime_type="application/json",
        ),
    )

    raw = response.text.strip()
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        if "```" in raw:
            json_block = raw.split("```")[1]
            if json_block.startswith("json"):
                json_block = json_block[4:]
            result = json.loads(json_block.strip())
        else:
            raise Exception(f"Gemini returned invalid JSON: {raw[:200]}")

    return result


# =========================================================================
# 2. Generate Master Identity — Gemini Flash Image Generation
# =========================================================================

IDENTITY_PROMPT = """Transform this person into a professional 4K studio portrait on a pure white cyclorama background.

CRITICAL Requirements:
- Pure white (#FFFFFF) cyclorama background with professional studio lighting
- Preserve EXACT facial features, skin tone, hair color/style, and body proportions
- Full body shot, relaxed A-pose (arms slightly away from torso)
- Form-fitting neutral clothing (simple grey or black)
- 4K detail: sharp eyes, skin texture, hair strands
- High-contrast three-point lighting setup
- Fashion photography quality: clean, crisp, commercial-grade

This is a "Master Identity" reference portrait for virtual garment try-on. Anatomical accuracy is critical — do NOT alter the person's appearance, only improve the background, lighting, and composition."""


def generate_master_identity(image_url: str) -> dict:
    """
    Use Gemini Flash image generation to create a 4K studio portrait
    from a selfie. Returns { image_bytes: bytes, mime_type: str }.
    """
    client = _get_client()
    image_bytes = _download_image_bytes(image_url)
    mime = _guess_mime(image_url)

    response = client.models.generate_content(
        model="gemini-2.0-flash-preview-image-generation",
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime),
                    types.Part.from_text(text=IDENTITY_PROMPT),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    # Extract the generated image from the response
    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            return {
                "image_bytes": part.inline_data.data,
                "mime_type": part.inline_data.mime_type or "image/png",
            }

    raise Exception("Gemini did not return an image in the response")
