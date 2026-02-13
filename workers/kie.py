import os
import time
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KIE_API_KEY = os.getenv("KIE_API_KEY", "19297022e69b70a833da6ac91c822f8b")
KIE_API_BASE = "https://api.kie.ai/api/v1"

# Map model names to their API path segments for GENERATION
MODEL_ENDPOINTS = {
    "veo-3.1-fast": "veo",
    "veo-3.1-quality": "veo",
    "sora-2": "runway",          # Sora uses /runway/ endpoint on Kie.ai
    "kling-2.6-quality": "kling",
    "kling-2.6-pro": "kling",
    "hailuo-2.3": "hailuo",
    "grok-imagine": "grok-imagine",
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
    "product-showcase-1": "veo3_fast",
}

def generate_video(prompt: str, model: str, **kwargs) -> dict:
    """
    Starts a video generation task on Kie.ai.
    Returns the task info (including task_id).
    """
    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Determine the correct endpoint for this model
    endpoint_segment = MODEL_ENDPOINTS.get(model, "veo")
    url = f"{KIE_API_BASE}/{endpoint_segment}/generate"
    
    # Map internal model ID to Kie.ai API model name
    api_model_name = MODEL_API_NAMES.get(model, model)
    
    payload = {
        "model": api_model_name,
        "prompt": prompt,
        "aspectRatio": kwargs.get("aspect_ratio", "16:9"),
    }
    
    # Add optional params if provided
    if kwargs.get("duration"):
        payload["duration"] = kwargs["duration"]
    if kwargs.get("resolution"):
        payload["quality"] = kwargs["resolution"]
    
    logger.info(f"Kie.ai request to {url}: {payload}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to start Kie.ai generation: {e}")
        raise

def get_task_status(task_id: str, model: str = "") -> dict:
    """
    Checks the status of a task using the model-specific record-info/record-detail endpoint.
    """
    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}"
    }
    
    # Use the model-specific status endpoint
    status_path = MODEL_STATUS_PATHS.get(model, "veo/record-info")
    url = f"{KIE_API_BASE}/{status_path}"
    
    logger.info(f"Polling status at {url}?taskId={task_id}")
    
    try:
        response = requests.get(url, headers=headers, params={"taskId": task_id})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to get task status for {task_id}: {e}")
        raise
