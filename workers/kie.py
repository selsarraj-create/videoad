import os
import time
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KIE_API_KEY = os.getenv("KIE_API_KEY", "19297022e69b70a833da6ac91c822f8b")
KIE_API_BASE = "https://api.kie.ai/api/v1"

# Map model names to their API path segments
MODEL_ENDPOINTS = {
    "veo-3.1-fast": "veo",
    "sora-2": "sora",
    "kling-2.6-quality": "kling",
    "hailuo-2.3": "hailuo",
}

# Map our internal model IDs to Kie.ai API model names
MODEL_API_NAMES = {
    "veo-3.1-fast": "veo3_fast",
    "sora-2": "sora2",
    "kling-2.6-quality": "kling2.6",
    "hailuo-2.3": "hailuo2.3",
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

def get_task_status(task_id: str) -> dict:
    """
    Checks the status of a task.
    """
    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}"
    }
    url = f"https://api.kie.ai/api/v1/tasks/{task_id}"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Failed to get task status for {task_id}: {e}")
        raise
