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


def _extract_output_url(data: dict) -> str | None:
    """Extract the output image URL from various Claid response structures."""
    # Claid's actual format: result.output_objects[0].tmp_url
    result = data.get("result")
    if isinstance(result, dict):
        output_objects = result.get("output_objects")
        if isinstance(output_objects, list) and output_objects:
            obj = output_objects[0]
            if isinstance(obj, dict):
                for key in ("tmp_url", "url", "image_url", "claid_storage_uri", "object_uri"):
                    val = obj.get(key)
                    if val and isinstance(val, str) and val.startswith("http"):
                        return val
    # Check data.output nesting (seen in DONE responses)
    data_inner = data.get("data", data)
    if isinstance(data_inner, dict) and data_inner is not data:
        found = _extract_output_url(data_inner)
        if found:
            return found
    # Check output.tmp_url / output.url
    output = data.get("output")
    if isinstance(output, dict):
        for key in ("tmp_url", "url", "image_url"):
            val = output.get(key)
            if val and isinstance(val, str) and val.startswith("http"):
                return val
    # Fallback: try common top-level paths
    for key in ("output_url", "url", "image_url", "tmp_url", "result_url"):
        val = data.get(key)
        if val and isinstance(val, str) and val.startswith("http"):
            return val
    return None


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

    # Validate URLs — Claid returns 422 for non-public URLs
    def _validate_url(url: str, label: str):
        if not url or not isinstance(url, str):
            raise Exception(f"Claid {label} URL is empty or invalid")
        if not url.startswith("https://"):
            raise Exception(
                f"Claid {label} URL must be a public HTTPS URL, got: {url[:80]}"
            )

    _validate_url(garment_image_url, "garment")
    if person_image_url:
        _validate_url(person_image_url, "person/model")

    # Build payload matching Claid's expected schema:
    # - input.clothing must be a LIST of URL strings
    # - input.model must be a URL string
    # - output should specify format only (no quality)
    # - options is REQUIRED
    payload = {
        "input": {
            "clothing": [garment_image_url]
        },
        "output": {
            "format": "png"
        },
        "options": {}
    }

    # Add person reference image if provided
    if person_image_url:
        payload["input"]["model"] = person_image_url

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

        # Claid returns async: {data: {status: "ACCEPTED", result_url: "..."}}
        # We need to poll result_url until the image is ready
        data = result.get("data", result)
        status = data.get("status", "")
        result_url = data.get("result_url")

        if status == "ACCEPTED" and result_url:
            logger.info(f"Claid.ai job accepted, polling {result_url}")
            import time
            for attempt in range(24):  # 24 × 5s = 2 min max
                time.sleep(5)
                poll_resp = requests.get(result_url, headers=headers, timeout=30)
                if poll_resp.status_code == 200:
                    poll_data = poll_resp.json()
                    poll_inner = poll_data.get("data", poll_data)
                    poll_status = poll_inner.get("status", "")
                    logger.info(f"Claid.ai poll attempt {attempt+1}: status={poll_status}")

                    if poll_status in ("COMPLETED", "completed", "DONE", "done", "SUCCESS", "success"):
                        # Extract output URL
                        output_url = _extract_output_url(poll_inner)
                        if output_url:
                            logger.info(f"Claid.ai on-model image generated: {output_url[:80]}")
                            return {"image_url": output_url, "raw_response": poll_data}
                        else:
                            raise Exception(f"Claid completed but no output URL found: {poll_data}")

                    if poll_status in ("FAILED", "failed", "ERROR", "error"):
                        raise Exception(f"Claid.ai job failed: {poll_data}")
                elif poll_resp.status_code == 202:
                    # Still processing
                    logger.info(f"Claid.ai poll attempt {attempt+1}: still processing (202)")
                    continue
                else:
                    logger.warning(f"Claid.ai poll returned {poll_resp.status_code}: {poll_resp.text[:200]}")

            raise Exception("Claid.ai job timed out after 2 minutes of polling")

        # If response already contains the output (non-async path)
        output_url = _extract_output_url(data)
        if output_url:
            logger.info(f"Claid.ai on-model image generated: {output_url[:80]}")
            return {"image_url": output_url, "raw_response": result}

        raise Exception(f"No image URL in Claid response: {result}")

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

