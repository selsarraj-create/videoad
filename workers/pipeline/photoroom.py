"""
Photoroom API integration for background removal and image cleaning.

Used in:
  - Part 1: Clean all 5 AI-Director reference images
  - Step 3/4: Clean raw garments before compositing
"""

import os
import logging
import asyncio
from typing import Optional

import httpx

from .storage import upload_to_r2, master_key, upload_pipeline_artifact
from .models import PoseAngle, POSE_ANGLE_LIST

logger = logging.getLogger(__name__)

PHOTOROOM_API_KEY = os.getenv("PHOTOROOM_API_KEY", "")
PHOTOROOM_API_URL = "https://sdk.photoroom.com/v2/edit"


async def _process_single_image(
    image_url: str,
    output_key: str,
) -> str:
    """
    Send a single image to Photoroom v2/edit for processing:
      - removeBackground=true
      - shadow.mode=ai.soft
      - light.mode=ai.auto

    Returns the public URL of the cleaned image.
    """
    headers = {
        "x-api-key": PHOTOROOM_API_KEY,
    }

    # Photoroom v2/edit accepts multipart form data
    data = {
        "imageUrl": image_url,
        "removeBackground": "true",
        "shadow.mode": "ai.soft",
        "light.mode": "ai.auto",
        "outputSize": "original",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            PHOTOROOM_API_URL,
            headers=headers,
            data=data,
        )
        response.raise_for_status()

        # Photoroom returns the processed image as binary
        image_bytes = response.content
        content_type = response.headers.get("content-type", "image/png")

    # Upload cleaned image to R2
    public_url = await upload_to_r2(output_key, image_bytes, content_type)
    logger.info(f"Photoroom cleaned: {output_key} → {public_url}")
    return public_url


async def clean_reference_images(
    user_id: str,
    image_urls: dict[str, str],
) -> dict[str, str]:
    """
    Part 1, Step 2: Loop through all 5 reference images and clean via Photoroom.

    Args:
        user_id:    The user's unique ID.
        image_urls: Map of pose → raw image URL, e.g. {'front': 'https://...'}

    Returns:
        Map of pose → cleaned public URL.
    """
    results: dict[str, str] = {}

    # Process sequentially to respect Photoroom rate limits
    for pose in POSE_ANGLE_LIST:
        raw_url = image_urls.get(pose)
        if not raw_url:
            logger.warning(f"Missing image for pose '{pose}', skipping.")
            continue

        output_key = master_key(user_id, pose)
        try:
            clean_url = await _process_single_image(raw_url, output_key)
            results[pose] = clean_url
        except Exception as e:
            logger.error(f"Photoroom failed for {pose}: {e}")
            raise RuntimeError(f"Photoroom processing failed for pose '{pose}': {e}")

    logger.info(f"Cleaned {len(results)}/{len(image_urls)} reference images for user {user_id}")
    return results


async def clean_garment(image_url: str, user_id: str, garment_id: str) -> str:
    """
    Clean a raw garment image via Photoroom (used in Step 3/4 outfit prep).

    Returns the public URL of the cleaned garment.
    """
    output_key = f"pipeline/{user_id}/garment_{garment_id}_clean.png"
    return await _process_single_image(image_url, output_key)
