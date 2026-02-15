"""
Claid.ai Integration — AI Fashion Models API
Converts flat-lay / mannequin garment photos into on-model fashion images.
"""
import os
import requests
import logging

logger = logging.getLogger(__name__)

CLAID_API_KEY = os.environ.get("CLAID_API_KEY", "")
CLAID_API_BASE = "https://api.claid.ai/v1"


def generate_on_model(garment_image_url: str, person_image_url: str = None, options: dict = None) -> dict:
    """
    Takes a garment image and optionally a person reference image, and returns
    a photorealistic on-model fashion image via Claid.ai.

    Args:
        garment_image_url: Public HTTPS URL of the garment image.
        person_image_url: Optional public HTTPS URL of the person/model reference image.
        options: Optional dict with keys like 'model_gender', 'model_ethnicity', 'pose'.

    Returns:
        dict with 'image_url' key pointing to the generated on-model image.
    """
    if not CLAID_API_KEY:
        raise Exception("CLAID_API_KEY not set")

    headers = {
        "Authorization": f"Bearer {CLAID_API_KEY}",
        "Content-Type": "application/json"
    }

    opts = options or {}

    # Build payload matching Claid's expected schema:
    # - input.clothing must be a LIST of objects with "url"
    # - input.model must have a "url" string
    # - output should specify format only (no quality)
    # - options is REQUIRED
    payload = {
        "input": {
            "clothing": [
                {"url": garment_image_url}
            ]
        },
        "output": {
            "format": "png"
        },
        "options": {}
    }

    # Add person reference image if provided
    if person_image_url:
        payload["input"]["model"] = {"url": person_image_url}

    # Optional: specify model characteristics (only if no person reference)
    if not person_image_url:
        model_opts = {}
        if opts.get("model_gender"):
            model_opts["gender"] = opts["model_gender"]
        if opts.get("model_ethnicity"):
            model_opts["ethnicity"] = opts["model_ethnicity"]
        if model_opts:
            payload["input"]["model"] = model_opts

    url = f"{CLAID_API_BASE}/image/ai-fashion-models"

    logger.info(f"Claid.ai fashion request: garment={garment_image_url[:80]}")

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        result = response.json()

        # Extract the output image URL from Claid response
        output_url = None
        if isinstance(result, dict):
            # Claid returns { data: { output: { url: "..." } } } or similar
            data = result.get("data") or result
            if isinstance(data, dict):
                output = data.get("output") or data
                if isinstance(output, dict):
                    output_url = output.get("url") or output.get("image_url")
                elif isinstance(output, list) and output:
                    output_url = output[0].get("url") if isinstance(output[0], dict) else None

        if not output_url:
            # Fallback: check top-level
            output_url = result.get("url") or result.get("image_url")

        if not output_url:
            raise Exception(f"No image URL in Claid response: {result}")

        logger.info(f"Claid.ai on-model image generated: {output_url[:80]}")
        return {"image_url": output_url, "raw_response": result}

    except requests.exceptions.HTTPError as e:
        error_body = e.response.text[:500] if e.response is not None else 'no response'
        logger.error(f"Claid.ai API error: {e.response.status_code} — {error_body}")
        logger.error(f"Claid.ai request payload was: garment={garment_image_url[:80]}, person={person_image_url[:80] if person_image_url else 'none'}")
        raise Exception(f"{e.response.status_code} {error_body}")
    except Exception as e:
        logger.error(f"Claid.ai request failed: {e}")
        raise


def generate_multi_layer(identity_url: str, garment_urls: list[str]) -> dict:
    """
    Sequentially drape multiple garments onto the identity.
    Each call uses the previous result as the base person image.

    Args:
        identity_url: Master Identity portrait URL.
        garment_urls: List of garment image URLs to layer.

    Returns:
        dict with 'image_url' — the final composite on-model image.
    """
    if not garment_urls:
        raise Exception("No garment URLs provided")

    current_base = identity_url
    result = None

    for i, garment_url in enumerate(garment_urls):
        logger.info(f"Multi-layer step {i+1}/{len(garment_urls)}: garment={garment_url[:60]}")
        result = generate_on_model(
            garment_image_url=garment_url,
            person_image_url=current_base
        )
        current_base = result["image_url"]

    logger.info(f"Multi-layer complete: {len(garment_urls)} garments applied")
    return result

