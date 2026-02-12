import os
import uvicorn
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from supabase import create_client, Client
from .veo import generate_video

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
    image_refs: list[str] = []
    duration: int = 5

async def process_video_job(job_id: str, prompt: str, image_refs: list[str], duration: int):
    try:
        print(f"Processing job {job_id}...")
        
        # Update status to processing
        supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

        # Generate video using Veo 3.1
        video_url = await generate_video(prompt, image_refs, duration)

        # Update job with result
        supabase.table("jobs").update({
            "status": "completed",
            "output_url": video_url
        }).eq("id", job_id).execute()
        
        print(f"Job {job_id} completed. URL: {video_url}")

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
    # Verify job exists or basic validation could happen here
    
    # Add to background tasks
    background_tasks.add_task(process_video_job, request.job_id, request.prompt, request.image_refs, request.duration)
    
    return {"message": "Job received", "job_id": request.job_id}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("workers.main:app", host="0.0.0.0", port=port, reload=True)
