"""
Step 5: The Drape — Fashn.ai tryon-max.

Takes the Gemini scene render + flat lay composite and produces a VTO image.
"""

import os
import logging
import asyncio

import httpx

from .storage import upload_pipeline_artifact, download_image_bytes

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

FAL_API_KEY = os.getenv("FAL_KEY", "")
FASHN_TRYON_MAX_ENDPOINT = "https://queue.fal.run/fal-ai/fashn/tryon/v1.6"
FASHN_STATUS_BASE = "https://queue.fal.run/fal-ai/fashn/tryon/v1.6/requests"

POLL_INTERVAL = 5  # seconds
MAX_POLL_ATTEMPTS = 120  # 10 minutes max


def _fal_headers() -> dict:
    return {
        "Authorization": f"Key {FAL_API_KEY}",
        "Content-Type": "application/json",
    }


async def execute_vto(
    user_id: str,
    scene_image_url: str,
    flat_lay_composite_url: str,
    category: str = "tops",
) -> str:
    """
    Step 5: Execute virtual try-on drape via Fashn.ai tryon-max.

    Inputs:
        scene_image_url:         Output from Step 1 (Gemini Scene).
        flat_lay_composite_url:  Output from Step 4 (Composite PNG).
        category:                Garment category hint.

    Returns:
        Public URL of the FASHN_RENDER (the dressed scene).
    """
    payload = {
        "model_image": scene_image_url,
        "garment_image": flat_lay_composite_url,
        "category": category,
        "mode": "quality",
        "garment_photo_type": "flat-lay",
        "long_top": False,
        "adjust_hands": True,
        "restore_background": True,
    }

    # Submit to fal.ai queue
    async with httpx.AsyncClient(timeout=30) as client:
        submit_resp = await client.post(
            FASHN_TRYON_MAX_ENDPOINT,
            headers=_fal_headers(),
            json=payload,
        )
        submit_resp.raise_for_status()
        submit_data = submit_resp.json()

    request_id = submit_data.get("request_id")
    if not request_id:
        raise RuntimeError(f"Fashn submit failed — no request_id: {submit_data}")

    logger.info(f"Fashn tryon submitted: request_id={request_id}")

    # Poll for completion
    status_url = f"{FASHN_STATUS_BASE}/{request_id}/status"
    result_url = f"{FASHN_STATUS_BASE}/{request_id}"

    for attempt in range(MAX_POLL_ATTEMPTS):
        await asyncio.sleep(POLL_INTERVAL)

        async with httpx.AsyncClient(timeout=15) as client:
            status_resp = await client.get(status_url, headers=_fal_headers())
            status_resp.raise_for_status()
            status_data = status_resp.json()

        status = status_data.get("status", "")
        logger.info(f"Fashn poll #{attempt + 1}: status={status}")

        if status == "COMPLETED":
            # Fetch result
            async with httpx.AsyncClient(timeout=15) as client:
                result_resp = await client.get(result_url, headers=_fal_headers())
                result_resp.raise_for_status()
                result_data = result_resp.json()

            # Extract output image URL
            output_image = result_data.get("image", {}).get("url")
            if not output_image:
                output_image = result_data.get("output", [{}])[0].get("url")

            if not output_image:
                raise RuntimeError(f"Fashn completed but no image in response: {result_data}")

            # Download and re-upload to our storage for persistence
            image_bytes = await download_image_bytes(output_image)
            fashn_render_url = await upload_pipeline_artifact(
                user_id, "fashn_render.png", image_bytes, "image/png"
            )

            logger.info(f"FASHN_RENDER created: {fashn_render_url}")
            return fashn_render_url

        elif status == "FAILED":
            error = status_data.get("error", "Unknown Fashn error")
            raise RuntimeError(f"Fashn tryon failed: {error}")

    raise TimeoutError(f"Fashn tryon timed out after {MAX_POLL_ATTEMPTS * POLL_INTERVAL}s")
