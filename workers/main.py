import os
import time
import uvicorn
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from supabase import create_client, Client
from .kie import generate_video, get_task_status

load_dotenv()

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("Worker starting up...")
    yield
    # Shutdown logic
    print("Worker shutting down...")

app = FastAPI(lifespan=lifespan)

class VideoJobRequest(BaseModel):
    job_id: str
    prompt: str
    model: str = "veo-3.1-fast"
    image_refs: list[str] = []
    duration: int = 5

def process_video_job(job_id: str, prompt: str, model: str, image_refs: list[str], duration: int):
    """
    Synchronous background task to handle Kie.ai interaction.
    Runs in a thread pool to avoid blocking the main event loop.
    """
    try:
        print(f"Processing job {job_id} for model {model}...")
        
        # 1. Start Generation
        task_info = generate_video(prompt, model)
        task_id = task_info.get("data", {}).get("id")
        
        if not task_id:
            raise Exception("Failed to get task_id from Kie.ai")

        print(f"Kie.ai task started: {task_id}")

        # 2. Update Supabase with task_id
        supabase.table("jobs").update({
            "status": "processing",
            "provider_task_id": task_id,
            "model": model
        }).eq("id", job_id).execute()

        # 3. Poll for completion
        while True:
            status_data = get_task_status(task_id)
            status = status_data.get("data", {}).get("status")
            
            print(f"Job {job_id} (Task {task_id}) status: {status}")
            
            if status == "completed":
                # Get result URL
                results = status_data.get("data", {}).get("results", [])
                video_url = results[0].get("url") if results else None
                
                if not video_url:
                    raise Exception("Completed but no video URL found")
                
                # Update Supabase
                supabase.table("jobs").update({
                    "status": "completed",
                    "output_url": video_url
                }).eq("id", job_id).execute()
                
                print(f"Job {job_id} successfully completed. URL: {video_url}")
                break
            
            elif status == "failed":
                error_msg = status_data.get("data", {}).get("error", "Unknown error")
                raise Exception(f"Kie.ai task failed: {error_msg}")
            
            # Wait before next poll
            time.sleep(5)

    except Exception as e:
        print(f"Job {job_id} failed: {str(e)}")
        supabase.table("jobs").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", job_id).execute()

@app.post("/webhook/generate")
async def handle_webhook(request: VideoJobRequest, background_tasks: BackgroundTasks):
    """
    Receives a webhook from Vercel to start video generation.
    Returns immediately while processing happens in background.
    """
    # Add to background tasks
    background_tasks.add_task(
        process_video_job, 
        request.job_id, 
        request.prompt, 
        request.model, 
        request.image_refs, 
        request.duration
    )
    
    return {"message": "Job received", "job_id": request.job_id}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("workers.main:app", host="0.0.0.0", port=port, reload=True)
