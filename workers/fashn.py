"""
Fashn.ai Integration via fal.ai REST API

Two-step fashion pipeline:
  Step 1 — Golden Master: tryon/v1.6 quality mode bakes garments onto mannequins.
  Step 2 — Identity Lock: model-swap transfers Golden Masters onto the user's identity.

Both endpoints use fal.ai's queue-based REST API (submit → poll → result).
"""
import os
import time
import random
import requests
import logging

logger = logging.getLogger(__name__)

FAL_API_KEY = os.environ.get("FAL_API_KEY", "")
FAL_API_BASE = "https://queue.fal.run"

# ── Retry configuration ──────────────────────────────────────────────────────
MAX_RETRIES = 5
BASE_DELAY = 2.0
JITTER_MAX = 1.0
RETRYABLE_STATUS_CODES = {429, 502, 503, 504}

# ── fal.ai endpoints ─────────────────────────────────────────────────────────
TRYON_ENDPOINT = "fal-ai/fashn/tryon/v1.6"
MODEL_SWAP_ENDPOINT = "fal-ai/fashn/model-swap"


def _get_headers() -> dict:
    """Return auth headers for fal.ai."""
    if not FAL_API_KEY:
        raise Exception("FAL_API_KEY not set")
    return {
        "Authorization": f"Key {FAL_API_KEY}",
        "Content-Type": "application/json",
    }


def _fal_submit_and_poll(endpoint: str, input_data: dict, timeout_seconds: int = 300) -> dict:
    """
    Submit a job to fal.ai queue and poll until completion.

    fal.ai queue protocol:
      POST /{endpoint}  → { request_id, ... }
      GET  /{endpoint}/requests/{request_id}/status  → { status: IN_QUEUE|IN_PROGRESS|COMPLETED }
      GET  /{endpoint}/requests/{request_id}  → result payload

    Returns the result payload on success.
    """
    headers = _get_headers()
    submit_url = f"{FAL_API_BASE}/{endpoint}"

    # Submit
    logger.info(f"[Fashn] Submitting to {endpoint}...")
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = requests.post(submit_url, json=input_data, headers=headers, timeout=60)
            if resp.status_code in RETRYABLE_STATUS_CODES and attempt < MAX_RETRIES:
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, JITTER_MAX)
                logger.warning(f"[Fashn] {resp.status_code} on submit attempt {attempt+1} — retrying in {delay:.1f}s")
                time.sleep(delay)
                continue
            resp.raise_for_status()
            break
        except requests.exceptions.RequestException as e:
            if attempt < MAX_RETRIES:
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, JITTER_MAX)
                logger.warning(f"[Fashn] Submit error attempt {attempt+1}: {e} — retrying in {delay:.1f}s")
                time.sleep(delay)
            else:
                raise

    submit_data = resp.json()
    request_id = submit_data.get("request_id")
    if not request_id:
        # Synchronous response (some endpoints return result directly)
        if submit_data.get("images"):
            return submit_data
        raise Exception(f"No request_id in fal.ai response: {submit_data}")

    logger.info(f"[Fashn] Queued: request_id={request_id}")

    # Poll for completion
    status_url = f"{FAL_API_BASE}/{endpoint}/requests/{request_id}/status"
    result_url = f"{FAL_API_BASE}/{endpoint}/requests/{request_id}"
    start_time = time.time()

    while time.time() - start_time < timeout_seconds:
        time.sleep(3)
        try:
            status_resp = requests.get(status_url, headers=headers, timeout=30)
            if status_resp.status_code in RETRYABLE_STATUS_CODES:
                logger.warning(f"[Fashn] Status poll {status_resp.status_code} — retrying...")
                continue
            status_resp.raise_for_status()
            status_data = status_resp.json()
            status = status_data.get("status", "")

            if status == "COMPLETED":
                # Fetch full result
                result_resp = requests.get(result_url, headers=headers, timeout=30)
                result_resp.raise_for_status()
                result = result_resp.json()
                logger.info(f"[Fashn] Completed: request_id={request_id}")
                return result

            elif status in ("FAILED", "ERROR"):
                error = status_data.get("error", "Unknown error")
                raise Exception(f"Fashn job failed: {error}")

            # IN_QUEUE or IN_PROGRESS — keep polling
            logger.debug(f"[Fashn] Status: {status}")

        except requests.exceptions.RequestException as e:
            logger.warning(f"[Fashn] Poll error: {e}")

    raise Exception(f"Fashn job timed out after {timeout_seconds}s (request_id={request_id})")


# ═══════════════════════════════════════════════════════════════════════════════
# Step 1: Golden Master — Fashn tryon/v1.6 (Quality Mode)
# ═══════════════════════════════════════════════════════════════════════════════

def tryon_quality(
    model_image_url: str,
    garment_image_url: str,
    category: str = "auto",
    garment_photo_type: str = "auto",
) -> dict:
    """
    Bake a garment onto a model/mannequin image using Fashn tryon v1.6 quality mode.

    Args:
        model_image_url:    Public URL of the model/mannequin image.
        garment_image_url:  Public URL of the garment image (flat-lay or on-model).
        category:           Garment category: 'tops', 'bottoms', 'one-pieces', or 'auto'.
        garment_photo_type: 'model', 'flat-lay', or 'auto'.

    Returns:
        dict with 'image_url' key pointing to the generated VTO image.
    """
    if not FAL_API_KEY:
        raise Exception("FAL_API_KEY not set")

    _validate_url(model_image_url, "model")
    _validate_url(garment_image_url, "garment")

    input_data = {
        "model_image": model_image_url,
        "garment_image": garment_image_url,
        "category": category,
        "mode": "quality",
        "garment_photo_type": garment_photo_type,
        "output_format": "png",
        "num_samples": 1,
    }

    result = _fal_submit_and_poll(TRYON_ENDPOINT, input_data)

    images = result.get("images", [])
    if not images:
        raise Exception(f"Fashn tryon returned no images: {result}")

    image_url = images[0].get("url", "")
    if not image_url:
        raise Exception(f"Fashn tryon image has no URL: {images[0]}")

    logger.info(f"[Fashn] Tryon quality result: {image_url[:80]}")
    return {"image_url": image_url, "raw_response": result}


# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: Identity Lock — Fashn model-swap
# ═══════════════════════════════════════════════════════════════════════════════

def model_swap(
    model_image_url: str,
    face_reference_url: str,
) -> dict:
    """
    Transfer a Golden Master garment image onto a real user's identity.

    Uses Fashn model-swap with face_reference_mode: match_reference to
    preserve the garment pixels while 100% locking the user's face and body.

    Args:
        model_image_url:    The Golden Master (mannequin wearing the garment).
        face_reference_url: The user's selfie / identity photo.

    Returns:
        dict with 'image_url' key pointing to the identity-locked VTO image.
    """
    if not FAL_API_KEY:
        raise Exception("FAL_API_KEY not set")

    _validate_url(model_image_url, "model")
    _validate_url(face_reference_url, "face_reference")

    input_data = {
        "model_image": model_image_url,
        "face_reference": face_reference_url,
        "face_reference_mode": "match_reference",
    }

    result = _fal_submit_and_poll(MODEL_SWAP_ENDPOINT, input_data)

    images = result.get("images", [])
    if not images:
        raise Exception(f"Fashn model-swap returned no images: {result}")

    image_url = images[0].get("url", "")
    if not image_url:
        raise Exception(f"Fashn model-swap image has no URL: {images[0]}")

    logger.info(f"[Fashn] Model-swap result: {image_url[:80]}")
    return {"image_url": image_url, "raw_response": result}


# ═══════════════════════════════════════════════════════════════════════════════
# Composite Functions
# ═══════════════════════════════════════════════════════════════════════════════

def generate_golden_masters(
    garment_image_url: str,
    mannequin_urls: list[str],
    category: str = "auto",
) -> list[str]:
    """
    Step 1 pipeline: Bake a garment onto each mannequin angle to create Golden Masters.

    Args:
        garment_image_url: The raw product image.
        mannequin_urls:    List of Universal Mannequin URLs (front, side, 3/4).
        category:          Garment category hint.

    Returns:
        List of Golden Master image URLs.
    """
    golden_masters = []
    for i, mannequin_url in enumerate(mannequin_urls):
        logger.info(f"[Fashn] Golden Master {i+1}/{len(mannequin_urls)}: mannequin={mannequin_url[:60]}")
        result = tryon_quality(
            model_image_url=mannequin_url,
            garment_image_url=garment_image_url,
            category=category,
            garment_photo_type="flat-lay",
        )
        golden_masters.append(result["image_url"])
    logger.info(f"[Fashn] {len(golden_masters)} Golden Masters created")
    return golden_masters


def identity_lock_transfer(
    golden_master_urls: list[str],
    user_selfie_url: str,
) -> list[str]:
    """
    Step 2 pipeline: Transfer Golden Masters onto the user's identity.

    Args:
        golden_master_urls: List of Golden Master images (mannequin + garment).
        user_selfie_url:    The user's selfie / identity photo.

    Returns:
        List of identity-locked VTO image URLs.
    """
    locked_urls = []
    for i, gm_url in enumerate(golden_master_urls):
        logger.info(f"[Fashn] Identity Lock {i+1}/{len(golden_master_urls)}: gm={gm_url[:60]}")
        result = model_swap(
            model_image_url=gm_url,
            face_reference_url=user_selfie_url,
        )
        locked_urls.append(result["image_url"])
    logger.info(f"[Fashn] {len(locked_urls)} identity-locked images created")
    return locked_urls


def generate_multi_layer(identity_url: str, garment_urls: list[str]) -> dict:
    """
    Sequentially drape multiple garments onto the identity.
    Each call uses the previous result as the base model image.

    Drop-in replacement for claid.generate_multi_layer().

    Args:
        identity_url: Master Identity portrait URL.
        garment_urls: List of garment image URLs to layer.

    Returns:
        dict with 'image_url' — the final composite VTO image.
    """
    if not garment_urls:
        raise Exception("No garment URLs provided")

    current_base = identity_url
    result = None

    for i, garment_url in enumerate(garment_urls):
        logger.info(f"Multi-layer step {i+1}/{len(garment_urls)}: garment={garment_url[:60]}")
        result = tryon_quality(
            model_image_url=current_base,
            garment_image_url=garment_url,
        )
        current_base = result["image_url"]

    logger.info(f"Multi-layer complete: {len(garment_urls)} garments applied")
    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_url(url: str, label: str):
    """Validate that a URL is a public HTTPS URL."""
    if not url or not isinstance(url, str):
        raise Exception(f"Fashn {label} URL is empty or invalid")
    if not url.startswith("https://"):
        raise Exception(
            f"Fashn {label} URL must be a public HTTPS URL, got: {url[:80]}"
        )
