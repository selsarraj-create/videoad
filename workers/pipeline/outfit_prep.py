"""
Steps 3 & 4: Outfit Builder & Asset Prep.

- Checks if garments need cleaning (sends raw ones to Photoroom)
- Filters out garments blocked by the Audit gatekeeper
- Composites selected garments into a single flat_lay_composite.png via PIL
"""

import logging
from io import BytesIO

from PIL import Image

from .models import AuditResult, GarmentInfo
from .audit import filter_garments_by_audit
from .photoroom import clean_garment
from .storage import download_image_bytes, upload_pipeline_artifact

logger = logging.getLogger(__name__)

# ── Canvas layout constants ──────────────────────────────────────────────────

CANVAS_WIDTH = 1024
CANVAS_HEIGHT = 1536  # Portrait orientation for fashion
GARMENT_PADDING = 20


async def prepare_garment_layer(
    user_id: str,
    garments: list[GarmentInfo],
    audit_result: AuditResult,
) -> str:
    """
    Steps 3 & 4: Prepare a composite garment layer.

    1. Filter out garments blocked by the audit (e.g., shoes if feet not visible)
    2. Clean any "raw" garments via Photoroom
    3. Composite all garments into a single transparent PNG canvas

    Args:
        user_id:      The user's unique ID.
        garments:     List of GarmentInfo objects with image URLs and categories.
        audit_result: AuditResult from the scene audit step.

    Returns:
        Public URL of the flat_lay_composite.png.
    """
    # ── Step 1: Filter by audit ──────────────────────────────────────────
    allowed_categories = filter_garments_by_audit(
        [g.category for g in garments], audit_result
    )
    filtered_garments = [g for g in garments if g.category in allowed_categories]

    blocked = [g for g in garments if g.category not in allowed_categories]
    if blocked:
        logger.warning(
            f"Blocked {len(blocked)} garment(s) by audit: "
            f"{[g.category for g in blocked]}"
        )

    if not filtered_garments:
        raise ValueError("No garments remaining after audit filtering.")

    # ── Step 2: Clean raw garments ───────────────────────────────────────
    clean_urls: list[str] = []
    for garment in filtered_garments:
        if garment.is_clean:
            clean_urls.append(garment.image_url)
            logger.info(f"Garment {garment.id} already clean, using as-is.")
        else:
            logger.info(f"Garment {garment.id} is raw — cleaning via Photoroom...")
            clean_url = await clean_garment(garment.image_url, user_id, garment.id)
            clean_urls.append(clean_url)

    # ── Step 3: Composite into flat lay ──────────────────────────────────
    composite_bytes = await _composite_garments(clean_urls)

    # Upload the composite
    composite_url = await upload_pipeline_artifact(
        user_id, "flat_lay_composite.png", composite_bytes, "image/png"
    )
    logger.info(f"Flat lay composite created: {composite_url}")
    return composite_url


async def _composite_garments(garment_urls: list[str]) -> bytes:
    """
    Use PIL to stitch garment images (Top + Bottom + Jacket etc.)
    into a single transparent PNG canvas arranged vertically.

    Layout:
    ┌─────────────────┐
    │    Outerwear     │
    │     (jacket)     │
    ├─────────────────┤
    │      Top         │
    │    (shirt/tee)   │
    ├─────────────────┤
    │     Bottom       │
    │   (pants/skirt)  │
    └─────────────────┘
    """
    # Download all garment images
    images: list[Image.Image] = []
    for url in garment_urls:
        img_bytes = await download_image_bytes(url)
        img = Image.open(BytesIO(img_bytes)).convert("RGBA")
        images.append(img)

    if not images:
        raise ValueError("No garment images to composite.")

    # Calculate target size for each garment slot
    n = len(images)
    slot_height = (CANVAS_HEIGHT - (n + 1) * GARMENT_PADDING) // n
    slot_width = CANVAS_WIDTH - 2 * GARMENT_PADDING

    # Create transparent canvas
    canvas = Image.new("RGBA", (CANVAS_WIDTH, CANVAS_HEIGHT), (0, 0, 0, 0))

    y_offset = GARMENT_PADDING
    for img in images:
        # Resize garment to fit slot while maintaining aspect ratio
        img_ratio = img.width / img.height
        slot_ratio = slot_width / slot_height

        if img_ratio > slot_ratio:
            # Wider than slot — fit to width
            new_width = slot_width
            new_height = int(slot_width / img_ratio)
        else:
            # Taller than slot — fit to height
            new_height = slot_height
            new_width = int(slot_height * img_ratio)

        resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Center in slot
        x = (CANVAS_WIDTH - new_width) // 2
        y = y_offset + (slot_height - new_height) // 2

        canvas.paste(resized, (x, y), resized)  # Use alpha for transparency
        y_offset += slot_height + GARMENT_PADDING

    # Export to bytes
    output = BytesIO()
    canvas.save(output, format="PNG")
    return output.getvalue()
