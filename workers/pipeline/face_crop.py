"""
Face crop logic — verify the face_closeup_front is high-resolution.

Uses PIL to check dimensions and optionally crop to face region.
Stores the verified path as FACE_ANCHOR_REF for Veo.
"""

import logging
from io import BytesIO

from PIL import Image

from typing import Optional

from .storage import download_image_bytes, face_anchor_url

logger = logging.getLogger(__name__)

# Minimum acceptable face resolution (width or height)
MIN_FACE_RESOLUTION = 512


async def verify_face_resolution(
    user_id: str,
    face_image_url: Optional[str] = None,
) -> str:
    """
    Verify that the face_closeup_front image is actually high-resolution.

    Args:
        user_id:        The user's unique ID.
        face_image_url: Optional override URL. Falls back to the stored master.

    Returns:
        The verified FACE_ANCHOR_REF URL.

    Raises:
        ValueError: If the face image is below MIN_FACE_RESOLUTION.
    """
    url = face_image_url or face_anchor_url(user_id)

    image_bytes = await download_image_bytes(url)
    img = Image.open(BytesIO(image_bytes))
    width, height = img.size

    logger.info(f"Face anchor resolution check: {width}x{height} (min={MIN_FACE_RESOLUTION})")

    if width < MIN_FACE_RESOLUTION or height < MIN_FACE_RESOLUTION:
        raise ValueError(
            f"Face closeup too low resolution ({width}x{height}). "
            f"Minimum required: {MIN_FACE_RESOLUTION}x{MIN_FACE_RESOLUTION}."
        )

    # All good — return the URL as the verified FACE_ANCHOR_REF
    logger.info(f"FACE_ANCHOR_REF verified: {url}")
    return url


async def get_face_anchor_ref(user_id: str) -> str:
    """
    Convenience wrapper: get the verified FACE_ANCHOR_REF for a user.
    Assumes verify_face_resolution has already been called during identity setup.
    """
    return face_anchor_url(user_id)
