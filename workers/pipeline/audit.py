"""
Step 2: Scene Audit — Gemini 1.5 Flash.

Analyzes the generated scene for VTO suitability.
Acts as a GATEKEEPER: blocks shoes if feet are not visible.
"""

import os
import json
import logging
import base64

import httpx

from .models import AuditResult
from .storage import download_image_bytes

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
FLASH_MODEL = "gemini-1.5-flash"
FLASH_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{FLASH_MODEL}:generateContent"
)

AUDIT_PROMPT = """Analyze this image for virtual try-on (VTO) suitability.

Respond with ONLY a JSON object, no markdown, no explanation:
{
  "is_full_body": true/false,
  "feet_visible": true/false,
  "hands_visible": true/false,
  "lighting_condition": "studio" | "natural" | "mixed" | "harsh" | "low"
}

Rules:
- is_full_body: true if you can see from head to at least mid-shin
- feet_visible: true ONLY if both feet are clearly visible and not cropped
- hands_visible: true if at least one hand is mostly visible
- lighting_condition: describe the dominant lighting
"""


async def audit_scene(scene_image_url: str) -> AuditResult:
    """
    Step 2: Send the generated scene to Gemini 1.5 Flash for VTO suitability audit.

    Returns:
        AuditResult with is_full_body, feet_visible, hands_visible, lighting_condition.

    The calling code uses this to gate which garment categories are allowed.
    """
    # Download the scene image
    image_bytes = await download_image_bytes(scene_image_url)
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    request_body = {
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": image_b64,
                        }
                    },
                    {"text": AUDIT_PROMPT},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 256,
        },
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            FLASH_API_URL,
            params={"key": GOOGLE_API_KEY},
            json=request_body,
        )
        response.raise_for_status()
        result = response.json()

    # Parse the text response
    candidates = result.get("candidates", [])
    if not candidates:
        logger.warning("Gemini Flash returned no candidates for audit. Using defaults.")
        return AuditResult()

    text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")

    # Strip markdown code fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    text = text.strip()

    try:
        data = json.loads(text)
        audit = AuditResult(**data)
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Failed to parse audit response: {e}\nRaw: {text}")
        audit = AuditResult()

    logger.info(
        f"Scene audit: full_body={audit.is_full_body}, feet={audit.feet_visible}, "
        f"hands={audit.hands_visible}, lighting={audit.lighting_condition}"
    )
    return audit


def filter_garments_by_audit(
    garment_categories: list[str], audit: AuditResult
) -> list[str]:
    """
    GATEKEEPER: Remove garment categories that conflict with the audit.

    Rules:
    - If feet_visible is False → strictly BLOCK "shoes" category
    """
    blocked: list[str] = []

    if not audit.feet_visible:
        blocked.append("shoes")

    filtered = [cat for cat in garment_categories if cat not in blocked]

    if blocked:
        logger.warning(f"Audit blocked categories: {blocked}")

    return filtered
