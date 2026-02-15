"""
4K Upscaling Orchestrator — Gemini 3 Pro Image via Kie.ai

Uses the Kie.ai image editing API with Gemini 3 Pro (Nano Banana Pro) to
upscale images to 4096px. Two modes:
  - "gentle"  : Face-refinement — increases resolution without altering
                facial structure or skin texture (identity preservation).
  - "fabric"  : Text & fabric texture — preserves garment weaves, labels,
                and text while upscaling.

The upscaler downloads the source image, sends it to Kie.ai's image
generation endpoint with a resolution-boosting prompt, then uploads the
result to Supabase storage and returns the public URL.
"""

import os
import time
import base64
import logging
import requests

logger = logging.getLogger(__name__)

KIE_API_KEY = os.environ.get("KIE_API_KEY", "")
KIE_API_BASE = "https://api.kie.ai/api/v1"

# ── Upscale prompts by mode ──────────────────────────────────────────────────

UPSCALE_PROMPTS = {
    "gentle": (
        "Upscale this image to 4K resolution (4096px on the longest edge). "
        "Preserve the exact facial features, skin texture, hairstyle, and body proportions. "
        "Do NOT alter the person's appearance. Only increase resolution and sharpness. "
        "Maintain the original lighting, colors, and background."
    ),
    "fabric": (
        "Upscale this image to 4K resolution (4096px on the longest edge). "
        "Focus on preserving fabric texture, garment weaves, stitching details, and any text or labels. "
        "Maintain the exact colors, lighting, and composition. Enhance textile detail and clarity."
    ),
}


def _download_as_base64(url: str) -> str:
    """Download an image URL and return as a base64 data URI."""
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    content_type = resp.headers.get("Content-Type", "image/jpeg")
    b64 = base64.b64encode(resp.content).decode("utf-8")
    return f"data:{content_type};base64,{b64}"


def upscale_image(
    image_url: str,
    mode: str = "gentle",
    supabase_client=None,
    storage_path: str = "",
) -> str:
    """
    Upscale an image to 4K via Kie.ai Gemini 3 Pro Image (Nano Banana Pro).

    Args:
        image_url:       Public URL of the source image.
        mode:            "gentle" (face preservation) or "fabric" (texture preservation).
        supabase_client: Optional Supabase client for uploading the result.
        storage_path:    Optional storage path for the upscaled image.

    Returns:
        str: Public URL of the upscaled image, or the original URL on failure.
    """
    if not KIE_API_KEY:
        logger.warning("KIE_API_KEY not set — skipping upscale, returning original URL")
        return image_url

    prompt = UPSCALE_PROMPTS.get(mode, UPSCALE_PROMPTS["gentle"])

    try:
        logger.info(f"Upscaling image ({mode}): {image_url[:60]}...")

        # Call Kie.ai image generation/editing endpoint
        url = f"{KIE_API_BASE}/nano-banana/generate"

        payload = {
            "prompt": prompt,
            "model": "nano_banana_pro",
            "imageUrls": [image_url],
            "mode": "IMAGE_EDIT",
        }

        headers = {
            "Authorization": f"Bearer {KIE_API_KEY}",
            "Content-Type": "application/json",
        }

        response = requests.post(url, json=payload, headers=headers, timeout=60)
        response.raise_for_status()
        result = response.json()

        # Extract task ID
        data = result.get("data") or {}
        task_id = None
        if isinstance(data, dict):
            task_id = data.get("taskId") or data.get("task_id") or data.get("id")
        if not task_id:
            task_id = result.get("taskId") or result.get("task_id") or result.get("id")

        if not task_id:
            logger.warning(f"No task_id from upscale response: {result}")
            return image_url

        logger.info(f"Upscale task started: {task_id}")

        # Poll for completion
        status_url = f"{KIE_API_BASE}/nano-banana/record-info"
        for _ in range(60):  # Max 5 minutes
            time.sleep(5)

            status_resp = requests.get(
                status_url,
                params={"taskId": task_id},
                headers={"Authorization": f"Bearer {KIE_API_KEY}"},
                timeout=30,
            )
            status_resp.raise_for_status()
            status_data = status_resp.json()

            poll_data = status_data.get("data") or {}
            raw_status = poll_data.get("status", "")
            success_flag = poll_data.get("successFlag")

            if raw_status in ("SUCCESS", "success") or success_flag == 1:
                # Extract output URL
                output_url = None
                results = poll_data.get("results") or poll_data.get("images") or []
                if results and isinstance(results, list):
                    first = results[0] if isinstance(results[0], dict) else results[0]
                    if isinstance(first, dict):
                        output_url = first.get("url") or first.get("imageUrl")
                    elif isinstance(first, str):
                        output_url = first
                if not output_url:
                    output_url = poll_data.get("imageUrl") or poll_data.get("url")

                if output_url:
                    logger.info(f"Upscale complete ({mode}): {output_url[:80]}")

                    # Upload to Supabase if client and path provided
                    if supabase_client and storage_path:
                        try:
                            img_bytes = requests.get(output_url, timeout=30).content
                            supabase_client.storage.from_("raw_assets").upload(
                                storage_path, img_bytes,
                                file_options={"content-type": "image/png", "upsert": "true"}
                            )
                            public_url = supabase_client.storage.from_("raw_assets").get_public_url(storage_path)
                            logger.info(f"Upscaled image stored: {public_url[:80]}")
                            return public_url
                        except Exception as upload_err:
                            logger.warning(f"Failed to store upscaled image: {upload_err}")

                    return output_url
                else:
                    logger.warning(f"Upscale completed but no URL found: {status_data}")
                    return image_url

            elif raw_status in ("GENERATE_FAILED", "CREATE_TASK_FAILED", "fail") or success_flag in (2, 3):
                error_msg = poll_data.get("error") or poll_data.get("msg") or "Unknown"
                logger.warning(f"Upscale task failed: {error_msg}")
                return image_url

            logger.debug(f"Upscale polling... status={raw_status}")

        logger.warning("Upscale timed out after 5 minutes")
        return image_url

    except Exception as e:
        logger.warning(f"Upscale failed ({mode}): {e}")
        return image_url


def upscale_batch(
    image_urls: list[str],
    mode: str = "gentle",
    supabase_client=None,
    storage_prefix: str = "",
) -> list[str]:
    """
    Upscale a batch of images sequentially.
    Returns a list of upscaled URLs (or originals on failure).
    """
    results = []
    for i, url in enumerate(image_urls):
        path = f"{storage_prefix}/upscaled_{i}.png" if storage_prefix else ""
        upscaled = upscale_image(url, mode, supabase_client, path)
        results.append(upscaled)
    return results
