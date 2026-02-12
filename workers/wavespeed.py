import os
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock WaveSpeed SDK wrapper since we don't have the actual package installed in this environment
# In a real scenario, this would import wavespeed from wavespeed-python

class WaveSpeedClient:
    def __init__(self, api_key=None):
        self.api_key = api_key or os.getenv("WAVESPEED_API_KEY")
        
    def generate(self, model: str, prompt: str, **kwargs):
        """
        Simulates generation request to WaveSpeed AI.
        Supports 'seedance-2.0-pro' and 'wan-2.2'.
        """
        logger.info(f"WaveSpeed Generation: Model={model}, Prompt={prompt}, Extra={kwargs}")
        
        # Simulate network request
        time.sleep(1)
        
        # Return mock task ID
        return {
            "id": f"ws_{int(time.time())}",
            "status": "pending"
        }

    def get_status(self, task_id: str):
        """
        Simulates status check.
        """
        # In a real app, strictly check API
        return {
            "id": task_id,
            "status": "completed", # Auto-complete for demo
            "output": {
                "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" # Placeholder
            }
        }

# Global client
client = WaveSpeedClient()

def generate_video(prompt: str, model: str, **kwargs) -> dict:
    return client.generate(model, prompt, **kwargs)

def get_task_status(task_id: str) -> dict:
    return client.get_status(task_id)
