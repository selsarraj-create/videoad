"""
Step 1: Scene Generation — Gemini 3 Pro Image via Vertex AI.

CRITICAL: Passes the user's master_front.png and master_face.png as
"Subject Reference" images to maintain identity consistency.
"""

import os
import logging
import base64
from io import BytesIO

import httpx

from .storage import (
    master_url,
    download_image_bytes,
    upload_pipeline_artifact,
)

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
VERTEX_PROJECT = os.getenv("VERTEX_PROJECT", "")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")

# Gemini 3 Pro Image endpoint (REST)
GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation"
GEMINI_API_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_IMAGE_MODEL}:generateContent"
)


SCENE_SYSTEM_PROMPT = """You are a high-end fashion scene generator. Create a photorealistic 
full-body scene of the person shown in the reference images. The generated model MUST look 
exactly like the person in the reference photos — same face, body shape, hair, and skin tone.

Rules:
- Full body visible including feet and hands whenever possible
- High-fashion editorial lighting
- Clean, minimal background suitable for virtual try-on overlay
- The person should be standing in a natural, confident pose
- Maintain anatomical accuracy — do NOT alter the person's appearance
"""


async def generate_base_scene(user_id: str, prompt: str) -> str:
    """
    Step 1: Generate a base scene image using Gemini 3 Pro Image.

    CRITICAL: Passes master_front.png and master_face.png as subject references
    to ensure the generated model looks like the user.

    Args:
        user_id: The user's unique ID.
        prompt:  Additional scene direction (setting, mood, etc.).

    Returns:
        Public URL of the generated scene image.
    """
    # Download reference images
    front_url = master_url(user_id, "front")
    face_url = master_url(user_id, "face_closeup_front")

    front_bytes = await download_image_bytes(front_url)
    face_bytes = await download_image_bytes(face_url)

    front_b64 = base64.b64encode(front_bytes).decode("utf-8")
    face_b64 = base64.b64encode(face_bytes).decode("utf-8")

    # Build the Gemini request with subject reference images
    full_prompt = f"{SCENE_SYSTEM_PROMPT}\n\nScene Direction: {prompt}"

    request_body = {
        "contents": [
            {
                "parts": [
                    # Subject reference: front body
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": front_b64,
                        }
                    },
                    {"text": "This is the subject's full body reference (front view)."},
                    # Subject reference: face closeup
                    {
                        "inlineData": {
                            "mimeType": "image/png",
                            "data": face_b64,
                        }
                    },
                    {"text": "This is the subject's face reference (high resolution)."},
                    # Scene generation prompt
                    {"text": full_prompt},
                ]
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "temperature": 0.7,
        },
    }

    # Call Gemini API
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            GEMINI_API_URL,
            params={"key": GOOGLE_API_KEY},
            json=request_body,
        )
        response.raise_for_status()
        result = response.json()

    # Extract the generated image from response
    candidates = result.get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned no candidates for scene generation.")

    parts = candidates[0].get("content", {}).get("parts", [])

    for part in parts:
        if "inlineData" in part:
            image_data = base64.b64decode(part["inlineData"]["data"])
            mime_type = part["inlineData"].get("mimeType", "image/png")

            # Upload scene to R2
            ext = "png" if "png" in mime_type else "jpg"
            scene_url = await upload_pipeline_artifact(
                user_id, f"scene_base.{ext}", image_data, mime_type
            )
            logger.info(f"Scene generated for user {user_id}: {scene_url}")
            return scene_url

    raise RuntimeError("Gemini response contained no image data.")
