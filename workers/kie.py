import os
import time
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KIE_API_KEY = os.getenv("KIE_API_KEY", "19297022e69b70a833da6ac91c822f8b")
KIE_API_URL = "https://api.kie.ai/api/v1/generate"

def generate_video(prompt: str, model: str, **kwargs) -> dict:
    """
    Starts a video generation task on Kie.ai.
    Returns the task info (including task_id).
    """
    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": model,
        "prompt": prompt,
        "customMode": False,
    }
    
    try:
        response = requests.post(KIE_API_URL, json=payload, headers=headers)
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
