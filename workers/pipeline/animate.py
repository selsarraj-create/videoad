"""
Step 6: The Motion — Veo 3.1 via Kie.ai.

Animates the FASHN_RENDER into a cinematic fashion video using:
  - image: FASHN_RENDER (dressed scene from Step 5)
  - face_reference: FACE_ANCHOR_REF (high-res face closeup from Part 1)
  - body_reference: master_front.png (full body reference from Part 1)
"""

import os
import logging
import asyncio
from typing import Optional

import httpx

from .storage import (
    master_url,
    face_anchor_url,
    upload_pipeline_artifact,
    download_image_bytes,
)

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

KIE_API_KEY = os.getenv("KIE_API_KEY", "")
KIE_API_BASE = "https://api.kie.ai/api/v1"

POLL_INTERVAL = 10  # seconds
MAX_POLL_ATTEMPTS = 90  # 15 minutes max

ANIMATION_PROMPT = (
    "Cinematic fashion movement, slow motion, "
    "keep identity consistent, editorial runway walk, "
    "smooth camera tracking, professional lighting."
)


async def animate_video(
    user_id: str,
    fashn_render_url: str,
    custom_prompt: Optional[str] = None,
) -> str:
    """
    Step 6: Animate the dressed scene into a fashion video via Veo 3.1 Fast (Kie.ai).

    The Secret Sauce:
        - image:          FASHN_RENDER (the dressed model from Step 5)
        - face_reference: FACE_ANCHOR_REF (high-res face from Part 1)
        - body_reference: master_front.png (full body from Part 1)

    Args:
        user_id:          The user's unique ID.
        fashn_render_url: URL of the FASHN_RENDER (dressed model image).
        custom_prompt:    Optional override prompt for the animation.

    Returns:
        Public URL of the generated video.
    """
    prompt = custom_prompt or ANIMATION_PROMPT

    # Collect all reference images
    face_ref = face_anchor_url(user_id)
    body_ref = master_url(user_id, "front")

    # Build Kie.ai Veo 3.1 request
    # REFERENCE_2_VIDEO mode uses the first image as the scene,
    # additional images as face/body references
    payload = {
        "prompt": prompt,
        "model": "veo3_fast",
        "mode": "REFERENCE_2_VIDEO",
        "aspectRatio": "9:16",
        "imageUrls": [
            fashn_render_url,  # Primary: the dressed scene
            face_ref,          # Face reference for identity lock
            body_ref,          # Body reference for consistency
        ],
    }

    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}",
        "Content-Type": "application/json",
    }

    # Submit generation task
    async with httpx.AsyncClient(timeout=30) as client:
        submit_resp = await client.post(
            f"{KIE_API_BASE}/veo/generate",
            headers=headers,
            json=payload,
        )
        submit_resp.raise_for_status()
        submit_data = submit_resp.json()

    task_id = submit_data.get("data", {}).get("task_id") or submit_data.get("task_id")
    if not task_id:
        raise RuntimeError(f"Kie.ai submit failed — no task_id: {submit_data}")

    logger.info(f"Veo 3.1 animation submitted: task_id={task_id}")

    # Poll for completion
    for attempt in range(MAX_POLL_ATTEMPTS):
        await asyncio.sleep(POLL_INTERVAL)

        async with httpx.AsyncClient(timeout=15) as client:
            status_resp = await client.get(
                f"{KIE_API_BASE}/veo/record-info",
                headers=headers,
                params={"taskId": task_id},
            )
            status_resp.raise_for_status()
            status_data = status_resp.json()

        record = status_data.get("data", status_data)
        status = record.get("status", "")

        logger.info(f"Veo poll #{attempt + 1}: status={status}")

        if status in ("SUCCESS", "success", "completed"):
            # Extract video URL
            video_url = (
                record.get("video_url")
                or record.get("videoUrl")
                or record.get("resultUrl")
            )

            if not video_url:
                # Check nested works array
                works = record.get("works", [])
                if works and isinstance(works, list):
                    video_url = works[0].get("resource", {}).get("resource")

            if not video_url:
                raise RuntimeError(f"Veo completed but no video URL in response: {record}")

            # Download and re-upload video to our storage
            video_bytes = await download_image_bytes(video_url)
            final_url = await upload_pipeline_artifact(
                user_id, "fashion_video.mp4", video_bytes, "video/mp4"
            )

            logger.info(f"Fashion video created: {final_url}")
            return final_url

        elif status in ("FAILED", "failed", "error"):
            error_msg = record.get("message", "Unknown Veo error")
            raise RuntimeError(f"Veo animation failed: {error_msg}")

    raise TimeoutError(f"Veo animation timed out after {MAX_POLL_ATTEMPTS * POLL_INTERVAL}s")
