import os
import time
import random
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KIE_API_KEY = os.environ.get("KIE_API_KEY", "")
KIE_API_BASE = "https://api.kie.ai/api/v1"

# ── Retry configuration ──────────────────────────────────────────────────────
MAX_RETRIES = 5
BASE_DELAY = 2.0       # seconds — doubles each retry: 2, 4, 8, 16, 32
JITTER_MAX = 1.0        # random jitter 0–1s added to each delay
RETRYABLE_STATUS_CODES = {429, 502, 503, 504}

# Map model names to their API path segments for GENERATION
MODEL_ENDPOINTS = {
    "veo-3.1-fast": "veo",
    "veo-3.1-quality": "veo",
    "sora-2": "runway",          # Sora uses /runway/ endpoint on Kie.ai
    "kling-2.6-quality": "kling",
    "kling-2.6-pro": "kling",
    "hailuo-2.3": "hailuo",
    "grok-imagine": "grok-imagine",
    "seedance-1.5-pro": "seedance",
    "product-showcase-1": "veo",
}

# Map model names to their STATUS polling path
# Some models use record-info, others use record-detail
MODEL_STATUS_PATHS = {
    "veo-3.1-fast": "veo/record-info",
    "veo-3.1-quality": "veo/record-info",
    "sora-2": "runway/record-detail",     # Sora/Runway uses record-detail
    "kling-2.6-quality": "kling/record-info",
    "kling-2.6-pro": "kling/record-info",
    "hailuo-2.3": "hailuo/record-info",
    "grok-imagine": "grok-imagine/record-info",
    "seedance-1.5-pro": "seedance/record-info",
    "product-showcase-1": "veo/record-info",
}

# Map our internal model IDs to Kie.ai API model names
MODEL_API_NAMES = {
    "veo-3.1-fast": "veo3_fast",
    "veo-3.1-quality": "veo3",
    "sora-2": "sora2",
    "kling-2.6-quality": "kling2.6",
    "kling-2.6-pro": "kling2.6_pro",
    "hailuo-2.3": "hailuo2.3",
    "grok-imagine": "grok-imagine",
    "seedance-1.5-pro": "seedance1.5_pro",
    "product-showcase-1": "veo3_fast",
}


def _request_with_backoff(method: str, url: str, **kwargs) -> requests.Response:
    """
    Make an HTTP request with exponential backoff on retryable errors (429, 5xx).
    
    Uses: base_delay * 2^attempt + random jitter
    Max retries: 5 → delays of ~2s, 4s, 8s, 16s, 32s
    """
    headers = kwargs.pop("headers", {})
    headers.setdefault("Authorization", f"Bearer {KIE_API_KEY}")

    last_exception = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = requests.request(method, url, headers=headers, **kwargs)

            # Success — return immediately
            if response.status_code not in RETRYABLE_STATUS_CODES:
                response.raise_for_status()
                return response

            # Retryable error
            retry_after = response.headers.get("Retry-After")
            if retry_after and retry_after.isdigit():
                delay = int(retry_after)
            else:
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, JITTER_MAX)

            logger.warning(
                f"Kie.ai {response.status_code} on attempt {attempt + 1}/{MAX_RETRIES + 1} "
                f"— retrying in {delay:.1f}s (url={url})"
            )

            if attempt < MAX_RETRIES:
                time.sleep(delay)
            else:
                # Last attempt — raise
                response.raise_for_status()

        except requests.exceptions.RequestException as e:
            last_exception = e
            if attempt < MAX_RETRIES:
                delay = BASE_DELAY * (2 ** attempt) + random.uniform(0, JITTER_MAX)
                logger.warning(
                    f"Kie.ai request error on attempt {attempt + 1}/{MAX_RETRIES + 1}: {e} "
                    f"— retrying in {delay:.1f}s"
                )
                time.sleep(delay)
            else:
                raise

    # Should not reach here, but just in case
    if last_exception:
        raise last_exception
    raise Exception(f"Request to {url} failed after {MAX_RETRIES + 1} attempts")


def generate_video(prompt: str, model: str, **kwargs) -> dict:
    """
    Starts a video generation task on Kie.ai.
    Returns the task info (including task_id).
    
    When image URLs are provided, uses REFERENCE_2_VIDEO mode with veo3_fast
    so Veo uses the reference image instead of ignoring it.
    
    Automatically retries on 429 / 5xx with exponential backoff.
    """
    # Determine the correct endpoint for this model
    endpoint_segment = MODEL_ENDPOINTS.get(model, "veo")
    url = f"{KIE_API_BASE}/{endpoint_segment}/generate"
    
    # Map internal model ID to Kie.ai API model name
    api_model_name = MODEL_API_NAMES.get(model, model)
    
    # Collect image URLs from various kwargs
    image_urls = []
    if kwargs.get("imageUrls"):
        image_urls = kwargs["imageUrls"] if isinstance(kwargs["imageUrls"], list) else [kwargs["imageUrls"]]
    elif kwargs.get("image_url"):
        image_urls = [kwargs["image_url"]]
    elif kwargs.get("image_refs"):
        image_urls = kwargs["image_refs"]
    
    payload = {
        "prompt": prompt,
        "aspectRatio": kwargs.get("aspectRatio", kwargs.get("aspect_ratio", "9:16")),
    }
    
    if image_urls:
        # REFERENCE_2_VIDEO mode — must use veo3_fast for 9:16 compatibility
        payload["mode"] = "REFERENCE_2_VIDEO"
        payload["model"] = "veo3_fast"
        payload["imageUrls"] = image_urls
        logger.info(f"Kie.ai REFERENCE_2_VIDEO mode with {len(image_urls)} image(s)")
    else:
        # Standard TEXT_2_VIDEO mode
        payload["model"] = api_model_name
    
    # Add callback URL if provided
    if kwargs.get("callBackUrl"):
        payload["callBackUrl"] = kwargs["callBackUrl"]
    
    # Add optional params if provided
    if kwargs.get("duration"):
        payload["duration"] = kwargs["duration"]
    if kwargs.get("resolution"):
        payload["quality"] = kwargs["resolution"]
    
    logger.info(f"Kie.ai request to {url}: model={payload.get('model')}, mode={payload.get('mode', 'TEXT_2_VIDEO')}")
    
    response = _request_with_backoff("POST", url, json=payload)
    return response.json()


def get_task_status(task_id: str, model: str = "") -> dict:
    """
    Checks the status of a task using the model-specific record-info/record-detail endpoint.
    Automatically retries on 429 / 5xx with exponential backoff.
    """
    # Use the model-specific status endpoint
    status_path = MODEL_STATUS_PATHS.get(model, "veo/record-info")
    url = f"{KIE_API_BASE}/{status_path}"
    
    logger.info(f"Polling status at {url}?taskId={task_id}")
    
    response = _request_with_backoff("GET", url, params={"taskId": task_id})
    return response.json()


def extend_video(task_id: str, prompt: str, video_url: str, aspect_ratio: str = "16:9") -> dict:
    """
    Extends a Veo 3.1 video by ~7 seconds using the extend endpoint.
    Requires the original taskId, a continuation prompt, and the video URL.
    Can be chained up to 20 times (max ~148s total). 720p only.
    Automatically retries on 429 / 5xx with exponential backoff.
    """
    url = f"{KIE_API_BASE}/veo/extend"
    
    payload = {
        "taskId": task_id,
        "prompt": prompt,
        "video_url": video_url,
        "aspectRatio": aspect_ratio,
    }
    
    logger.info(f"Kie.ai extend request to {url}: taskId={task_id}, prompt={prompt[:80]}...")
    
    response = _request_with_backoff("POST", url, json=payload)
    return response.json()
