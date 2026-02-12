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

from .provider_factory import ProviderFactory

# ... imports ...

class VideoJobRequest(BaseModel):
    job_id: str
    prompt: str
    model: str = "veo-3.1-fast"
    image_refs: list[str] = []
    duration: int = 5
    tier: str = "draft"
    provider_metadata: dict = {}

def process_video_job(job_id: str, prompt: str, model: str, tier: str, image_refs: list[str], duration: int, provider_metadata: dict):
    """
    Synchronous background task to handle Video Generation via ProviderFactory.
    """
    try:
        print(f"Processing job {job_id} ({tier}) model={model} ...")
        
        provider = ProviderFactory.get_provider(tier, model)
        
        # 1. Start Generation
        # Map specific params based on provider if needed
        task_info = provider.generate_video(prompt, model, **provider_metadata)
        
        # Handle different response structures if necessary
        # Kie returns { data: { id: ... } }
        # WaveSpeed mock returns { id: ... }
        
        task_id = task_info.get("data", {}).get("id") or task_info.get("id")
        
        if not task_id:
             raise Exception(f"Failed to get task_id from {tier} provider")

        print(f"Task started: {task_id}")

        # 2. Update Supabase
        supabase.table("jobs").update({
            "status": "processing",
            "provider_task_id": task_id,
            "model": model,
            "tier": tier,
            "provider_metadata": provider_metadata
        }).eq("id", job_id).execute()

        # 3. Poll for completion
        while True:
            status_data = provider.get_task_status(task_id)
            
            # Normalize status response
            # Kie: { data: { status: ..., results: [{url: ...}] } }
            # WaveSpeed: { status: ..., output: { url: ... } }
            
            if tier == "draft":
                status = status_data.get("data", {}).get("status")
            else:
                status = status_data.get("status")

            print(f"Job {job_id} status: {status}")
            
            if status == "completed":
                video_url = None
                if tier == "draft":
                    results = status_data.get("data", {}).get("results", [])
                    video_url = results[0].get("url") if results else None
                else:
                    video_url = status_data.get("output", {}).get("url")
                
                if not video_url:
                    raise Exception("Completed but no video URL found")
                
                supabase.table("jobs").update({
                    "status": "completed",
                    "output_url": video_url
                }).eq("id", job_id).execute()
                print(f"Job {job_id} completed. URL: {video_url}")
                break
            
            elif status == "failed":
                error_msg = status_data.get("data", {}).get("error") or status_data.get("error", "Unknown error")
                raise Exception(f"Task failed: {error_msg}")
            
            time.sleep(5)

    except Exception as e:
        print(f"Job {job_id} failed: {str(e)}")
        supabase.table("jobs").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", job_id).execute()

@app.post("/webhook/generate")
async def handle_webhook(request: VideoJobRequest, background_tasks: BackgroundTasks):
    # Extract duration from provider_metadata if not set top-level
    duration = request.duration
    if request.provider_metadata and "duration" in request.provider_metadata:
        duration = request.provider_metadata["duration"]

    background_tasks.add_task(
        process_video_job, 
        request.job_id, 
        request.prompt, 
        request.model, 
        request.tier,
        request.image_refs, 
        duration,
        request.provider_metadata
    )
    return {"message": "Job received", "job_id": request.job_id}

from moviepy.editor import VideoFileClip, concatenate_videoclips
import requests
import tempfile

from typing import Optional

class StitchRequest(BaseModel):
    project_id: str
    video_urls: list[str]
    audio_url: Optional[str] = None
    output_format: str = "mp4"

def process_stitch_job(project_id: str, video_urls: list[str], audio_url: Optional[str] = None):
    print(f"Starting stitch job for project {project_id}")
    temp_files = []
    clips = []
    
    try:
        # 1. Download Clips
        for url in video_urls:
            if not url: continue
            
            # Create temp file in binary mode
            tf = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False, mode='wb')
            temp_files.append(tf.name)
            
            # Download
            print(f"Downloading clip: {url}...")
            r = requests.get(url, stream=True)
            if r.status_code == 200:
                for chunk in r.iter_content(chunk_size=1024):
                    tf.write(chunk)
                tf.close()
                
                # Load clip
                clip = VideoFileClip(tf.name)
                # Ensure consistent resolution (e.g., 720p)
                clip = clip.resize(height=720) 
                clips.append(clip)
            else:
                print(f"Failed to download {url}")

        if not clips:
            raise Exception("No valid video clips to stitch")

        # 2. Concatenate
        print("Concatenating clips...")
        final_clip = concatenate_videoclips(clips, method="compose")

        # 3. Add Audio (Optional) - Todo
        
        # 4. Write Output
        output_tf = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        output_filename = output_tf.name
        output_tf.close()
        
        print(f"Writing final video to {output_filename}...")
        final_clip.write_videofile(output_filename, codec="libx264", audio_codec="aac", fps=24)

        # 5. Upload to Supabase
        print("Uploading to Supabase Storage...")
        file_path = f"outputs/{project_id}_mashed.mp4"
        with open(output_filename, "rb") as f:
            supabase.storage.from_("final_ads").upload(
                file=f,
                path=file_path,
                file_options={"content-type": "video/mp4", "x-upsert": "true"}
            )
            
        # Get Public URL
        public_url = supabase.storage.from_("final_ads").get_public_url(file_path)
        print(f"Upload complete: {public_url}")

        # 6. Update Project
        supabase.table("projects").update({
            "status": "completed",
            "output_url": public_url
        }).eq("id", project_id).execute()

    except Exception as e:
        print(f"Stitch job failed: {e}")
        # Ideally update project status to 'failed' here
    
    finally:
        # Cleanup
        for clip in clips:
            clip.close()
        for tf in temp_files:
            if os.path.exists(tf):
                os.remove(tf)
        if 'output_filename' in locals() and os.path.exists(output_filename):
            os.remove(output_filename)

@app.post("/webhook/stitch")
async def handle_stitch(request: StitchRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_stitch_job, request.project_id, request.video_urls, request.audio_url)
    return {"message": "Stitching started", "project_id": request.project_id}

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("workers.main:app", host="0.0.0.0", port=port, reload=True)
