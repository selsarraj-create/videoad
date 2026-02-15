import os
import time
import uvicorn
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from supabase import create_client, Client
from .kie import generate_video, get_task_status
from . import claid
from . import gemini
from .presets import get_prompt, get_preset

load_dotenv()

# Lazy Supabase client — avoids crashing at import time
_supabase_client: Client | None = None

def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _supabase_client = create_client(url, key)
    return _supabase_client

# Backwards-compatible alias — all existing code uses `supabase.table(...)`
class _LazySupabase:
    """Proxy that defers create_client until first attribute access."""
    def __getattr__(self, name):
        return getattr(get_supabase(), name)

supabase = _LazySupabase()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    print("Worker starting up...")
    yield
    # Shutdown logic
    print("Worker shutting down...")

app = FastAPI(lifespan=lifespan)

from .provider_factory import ProviderFactory


@app.get("/health")
def health_check():
    """Verify worker is running and env vars are configured."""
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    sb_url = os.environ.get("SUPABASE_URL", "")
    return {
        "status": "ok",
        "gemini_api_key_set": bool(gemini_key),
        "gemini_key_prefix": gemini_key[:8] + "..." if gemini_key else "MISSING",
        "supabase_url_set": bool(sb_url),
    }

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
        
        print(f"Provider response: {task_info}")
        
        data = task_info.get("data") or {}
        task_id = None
        if isinstance(data, dict):
            task_id = data.get("taskId") or data.get("task_id") or data.get("id")
        if not task_id:
            task_id = task_info.get("taskId") or task_info.get("task_id") or task_info.get("id")
        
        if not task_id:
             raise Exception(f"Failed to get task_id from {tier} provider. Response: {task_info}")

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
            status_data = provider.get_task_status(task_id, model)
            
            print(f"Poll response for {job_id}: {status_data}")
            
            # Normalize status response (null-safe)
            poll_data = status_data.get("data") if isinstance(status_data, dict) else None
            if not isinstance(poll_data, dict):
                poll_data = {}
            
            if tier == "draft":
                # Kie.ai uses multiple status indicators:
                # 1. data.status = "SUCCESS" / "GENERATING" / "PENDING" / "GENERATE_FAILED"
                # 2. Veo uses data.successFlag = 0 (generating), 1 (success), 2/3 (failed)
                raw_status = poll_data.get("status", "")
                success_flag = poll_data.get("successFlag")
                
                # Normalize to our internal status
                if raw_status in ("SUCCESS", "success") or success_flag == 1:
                    status = "completed"
                elif raw_status in ("GENERATE_FAILED", "CREATE_TASK_FAILED", "SENSITIVE_WORD_ERROR", "fail") or success_flag in (2, 3):
                    status = "failed"
                elif raw_status in ("GENERATING", "PENDING", "queuing", "waiting") or success_flag == 0:
                    status = "processing"
                else:
                    status = raw_status.lower() if raw_status else "processing"
            else:
                status = status_data.get("status")

            print(f"Job {job_id} status: {status} (raw: {poll_data.get('status', 'N/A')}, flag: {poll_data.get('successFlag', 'N/A')})")
            
            if status == "completed":
                video_url = None
                if tier == "draft":
                    # Kie.ai may use "results" or "works" array, with "url" or "videoUrl" keys
                    results = poll_data.get("results") or poll_data.get("works") or []
                    if results and isinstance(results, list):
                        first_result = results[0] if isinstance(results[0], dict) else {}
                        video_url = first_result.get("url") or first_result.get("videoUrl") or first_result.get("video_url")
                    # Fallback: check direct URL fields
                    if not video_url:
                        video_url = poll_data.get("videoUrl") or poll_data.get("url") or poll_data.get("video_url")
                else:
                    output = status_data.get("output") or {}
                    video_url = output.get("url") if isinstance(output, dict) else None
                
                if not video_url:
                    print(f"Completed but no URL found. Full response: {status_data}")
                    raise Exception("Completed but no video URL found")
                
                supabase.table("jobs").update({
                    "status": "completed",
                    "output_url": video_url,
                    "provider_metadata": {"task_id": task_id, "aspect_ratio": provider_metadata.get("aspect_ratio", "16:9") if provider_metadata else "16:9"}
                }).eq("id", job_id).execute()
                print(f"Job {job_id} completed. URL: {video_url}")
                break
            
            elif status == "failed":
                error_msg = poll_data.get("error") or poll_data.get("msg") or poll_data.get("failReason")
                error_msg = error_msg or status_data.get("error", "Unknown error")
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

class ExtendRequest(BaseModel):
    job_id: str
    original_task_id: str
    prompt: str
    video_url: str
    aspect_ratio: str = "16:9"

def process_extend_job(job_id: str, original_task_id: str, prompt: str, video_url: str, aspect_ratio: str):
    """Extend a Veo 3.1 video by ~7 seconds."""
    print(f"Processing extend job {job_id} (extending task {original_task_id})...")
    
    try:
        # 1. Update status to processing
        supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()
        
        # 2. Call extend API
        task_info = kie.extend_video(original_task_id, prompt, video_url, aspect_ratio)
        print(f"Extend response: {task_info}")
        
        # Extract new task ID
        data = task_info.get("data") or {}
        new_task_id = None
        if isinstance(data, dict):
            new_task_id = data.get("taskId") or data.get("task_id") or data.get("id")
        if not new_task_id:
            new_task_id = task_info.get("taskId") or task_info.get("task_id") or task_info.get("id")
        
        if not new_task_id:
            raise Exception(f"Failed to get task_id from extend response: {task_info}")
        
        print(f"Extend task started: {new_task_id}")
        
        # 3. Poll for completion (reuse same logic as generate)
        model = "veo-3.1-fast"  # Extend is always Veo
        while True:
            status_data = kie.get_task_status(new_task_id, model)
            
            poll_data = status_data.get("data") if isinstance(status_data, dict) else None
            if not isinstance(poll_data, dict):
                poll_data = {}
            
            raw_status = poll_data.get("status", "")
            success_flag = poll_data.get("successFlag")
            
            if raw_status in ("SUCCESS", "success") or success_flag == 1:
                status = "completed"
            elif raw_status in ("GENERATE_FAILED", "CREATE_TASK_FAILED", "fail") or success_flag in (2, 3):
                status = "failed"
            else:
                status = "processing"
            
            print(f"Extend job {job_id} status: {status} (raw: {raw_status}, flag: {success_flag})")
            
            if status == "completed":
                # Extract video URL
                results = poll_data.get("results") or poll_data.get("works") or []
                video_url_result = None
                if results and isinstance(results, list):
                    first = results[0] if isinstance(results[0], dict) else {}
                    video_url_result = first.get("url") or first.get("videoUrl") or first.get("video_url")
                if not video_url_result:
                    video_url_result = poll_data.get("videoUrl") or poll_data.get("url") or poll_data.get("video_url")
                
                if not video_url_result:
                    raise Exception(f"Extended but no URL found. Response: {status_data}")
                
                supabase.table("jobs").update({
                    "status": "completed",
                    "output_url": video_url_result,
                    "provider_metadata": {"extend_task_id": new_task_id, "aspect_ratio": aspect_ratio}
                }).eq("id", job_id).execute()
                print(f"Extend job {job_id} completed. URL: {video_url_result}")
                break
            
            elif status == "failed":
                error_msg = poll_data.get("error") or poll_data.get("msg") or "Unknown error"
                raise Exception(f"Extend failed: {error_msg}")
            
            time.sleep(5)
    
    except Exception as e:
        print(f"Extend job {job_id} failed: {str(e)}")
        supabase.table("jobs").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", job_id).execute()

@app.post("/webhook/extend")
async def handle_extend_webhook(request: ExtendRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        process_extend_job,
        request.job_id,
        request.original_task_id,
        request.prompt,
        request.video_url,
        request.aspect_ratio
    )
    return {"message": "Extend job received", "job_id": request.job_id}

# =========================================================================
# Try-On Only: Claid generates on-model image (no video)
# =========================================================================

class TryOnRequest(BaseModel):
    job_id: str
    person_image_url: str
    garment_image_url: str

def process_try_on_job(job_id: str, person_image_url: str, garment_image_url: str):
    """Claid-only: person + garment → on-model image. No video generation."""
    print(f"Try-on job {job_id}: person={person_image_url[:50]}, garment={garment_image_url[:50]}")

    try:
        supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

        claid_result = claid.generate_on_model(
            garment_image_url=garment_image_url,
            person_image_url=person_image_url
        )
        on_model_image_url = claid_result["image_url"]
        print(f"Try-on done: {on_model_image_url[:80]}")

        supabase.table("jobs").update({
            "status": "completed",
            "output_url": on_model_image_url,
            "provider_metadata": {
                "type": "try_on",
                "person_image_url": person_image_url,
                "garment_image_url": garment_image_url
            }
        }).eq("id", job_id).execute()

    except Exception as e:
        print(f"Try-on job {job_id} failed: {str(e)}")
        supabase.table("jobs").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", job_id).execute()

@app.post("/webhook/try-on")
async def handle_try_on_webhook(request: TryOnRequest):
    """Run synchronously so Railway keeps the container alive."""
    try:
        process_try_on_job(request.job_id, request.person_image_url, request.garment_image_url)
        return {"message": "Try-on job completed", "job_id": request.job_id}
    except Exception as e:
        print(f"Try-on endpoint error: {str(e)}")
        return {"message": f"Try-on failed: {str(e)[:200]}", "job_id": request.job_id}

# =========================================================================
# Identity Pipeline: Validate Selfie + Generate Master Identity
# =========================================================================

class ValidateSelfieRequest(BaseModel):
    identity_id: str
    selfie_url: str

def process_validate_selfie(identity_id: str, selfie_url: str):
    """Run Gemini Flash vision validation on a selfie."""
    print(f"Validating selfie for identity {identity_id}")
    try:
        result = gemini.validate_selfie(selfie_url)
        new_status = "validated" if result.get("passed") else "pending"
        supabase.table("identities").update({
            "validation_result": result,
            "status": new_status
        }).eq("id", identity_id).execute()
        print(f"Validation done: passed={result.get('passed')}")
    except Exception as e:
        print(f"Validation failed for {identity_id}: {str(e)}")
        supabase.table("identities").update({
            "validation_result": {"error": str(e)},
            "status": "failed"
        }).eq("id", identity_id).execute()

@app.post("/webhook/validate-selfie")
async def handle_validate_selfie(request: ValidateSelfieRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_validate_selfie, request.identity_id, request.selfie_url)
    return {"message": "Validation started", "identity_id": request.identity_id}


# Real-time validation — synchronous, no DB write
class RealtimeValidateRequest(BaseModel):
    image_data: str  # base64 data URL from camera

@app.post("/webhook/validate-selfie-realtime")
async def handle_validate_selfie_realtime(request: RealtimeValidateRequest):
    """Synchronous validation that returns checklist immediately."""
    try:
        result = gemini.validate_selfie_realtime(request.image_data)
        return result
    except Exception as e:
        err_msg = str(e)[:80]
        print(f"Realtime validation error: {str(e)}")
        return {
            "passed": False,
            "error": err_msg,
            "checks": [
                {"name": "pose", "passed": False, "message": f"Error: {err_msg[:40]}"},
                {"name": "lighting", "passed": False, "message": "Analysis failed"},
                {"name": "attire", "passed": False, "message": "See worker logs"},
                {"name": "resolution", "passed": False, "message": "Retry soon"},
            ]
        }


class GenerateIdentityRequest(BaseModel):
    identity_id: str
    selfie_url: str

def process_generate_identity(identity_id: str, selfie_url: str):
    """Generate 3 master identity portraits (front, profile, 3/4) using Gemini."""
    print(f"Generating master identities for {identity_id}")
    try:
        supabase.table("identities").update({"status": "generating"}).eq("id", identity_id).execute()

        # Fetch all validated views for this identity
        views_resp = supabase.table("identity_views").select("*").eq(
            "identity_id", identity_id
        ).eq("status", "validated").execute()

        views = views_resp.data if views_resp.data else []
        print(f"Found {len(views)} validated views for identity {identity_id}")

        # Fallback: if no views found, use the selfie_url as front view
        if not views:
            views = [{"angle": "front", "image_url": selfie_url, "id": None}]

        master_urls = {}
        front_master_url = None

        for view in views:
            angle = view.get("angle", "front")
            image_url = view.get("image_url")
            view_id = view.get("id")

            if not image_url:
                print(f"Skipping view {angle}: no image_url")
                continue

            print(f"Generating master for angle: {angle}")

            try:
                result = gemini.generate_master_identity(image_url)
                image_bytes = result["image_bytes"]
                mime_type = result["mime_type"]
                ext = "png" if "png" in mime_type else "jpeg"

                # Upload to Supabase storage with angle in filename
                file_path = f"identities/{identity_id}/master_{angle}.{ext}"
                supabase.storage.from_("raw_assets").upload(
                    file_path, image_bytes,
                    file_options={"content-type": mime_type, "upsert": "true"}
                )
                public_url = supabase.storage.from_("raw_assets").get_public_url(file_path)
                master_urls[angle] = public_url

                # Update identity_views with the master URL
                if view_id:
                    supabase.table("identity_views").update({
                        "master_url": public_url
                    }).eq("id", view_id).execute()

                if angle == "front":
                    front_master_url = public_url

                print(f"Master for {angle} ready: {public_url[:80]}")

            except Exception as angle_err:
                print(f"Master generation failed for {angle}: {str(angle_err)}")
                # Continue with other angles even if one fails

        if not master_urls:
            raise Exception("No masters were generated successfully")

        # Use front master as the primary, or first available
        primary_url = front_master_url or next(iter(master_urls.values()))

        supabase.table("identities").update({
            "master_identity_url": primary_url,
            "status": "ready"
        }).eq("id", identity_id).execute()
        print(f"All masters ready ({len(master_urls)} angles): {list(master_urls.keys())}")

    except Exception as e:
        print(f"Identity generation failed for {identity_id}: {str(e)}")
        supabase.table("identities").update({
            "status": "failed"
        }).eq("id", identity_id).execute()

@app.post("/webhook/generate-identity")
async def handle_generate_identity(request: GenerateIdentityRequest):
    """Run generation synchronously so Railway keeps the container alive."""
    try:
        process_generate_identity(request.identity_id, request.selfie_url)
        return {"message": "Identity generation completed", "identity_id": request.identity_id}
    except Exception as e:
        print(f"Generate identity endpoint error: {str(e)}")
        return {"message": f"Generation failed: {str(e)[:100]}", "identity_id": request.identity_id}


# =========================================================================
# Multi-Angle Identity Vault — Pose Detection, Upload Validation, View Storage
# =========================================================================

class PoseAngleRequest(BaseModel):
    image_data: str  # base64 data URL from camera

@app.post("/webhook/validate-pose-angle")
async def handle_validate_pose_angle(request: PoseAngleRequest):
    """Detect pose angle for AI-Director auto-shutter."""
    try:
        result = gemini.validate_pose_angle(request.image_data)
        return result
    except Exception as e:
        print(f"Pose angle detection error: {str(e)}")
        return {
            "angle": "unknown",
            "confidence": 0.0,
            "full_body_visible": False,
            "arms_clear": False,
            "no_phone": True,
            "silhouette_clear": False,
            "coaching_tip": f"Detection error: {str(e)[:40]}"
        }


class UploadValidateRequest(BaseModel):
    image_data: str  # base64 data URL from uploaded file

@app.post("/webhook/validate-upload")
async def handle_validate_upload(request: UploadValidateRequest):
    """Full 2026-standard suitability validation for uploaded photos."""
    try:
        result = gemini.validate_upload_suitability(request.image_data)
        return result
    except Exception as e:
        print(f"Upload validation error: {str(e)}")
        return {
            "suitable": False,
            "angle": "other",
            "checks": {
                "whole_product": {"passed": False, "message": "Analysis failed"},
                "texture_clarity": {"passed": False, "message": "Analysis failed"},
                "blur": {"passed": False, "message": "Analysis failed"},
                "lighting": {"passed": False, "message": "Analysis failed"},
                "pose": {"passed": False, "message": "Analysis failed"},
            },
            "issues": [f"Validation error: {str(e)[:60]}"],
            "overall_message": "Could not analyze image. Please try again."
        }


class SaveIdentityViewRequest(BaseModel):
    identity_id: str
    angle: str  # front, profile, three_quarter
    image_url: str
    validation_result: dict = {}
    source: str = "camera"  # camera or upload

@app.post("/webhook/save-identity-view")
async def handle_save_identity_view(request: SaveIdentityViewRequest):
    """Store a validated angle photo in the identity_views table."""
    try:
        # Upsert — replace if same angle already exists
        supabase.table("identity_views").upsert({
            "identity_id": request.identity_id,
            "angle": request.angle,
            "image_url": request.image_url,
            "validation_result": request.validation_result,
            "status": "validated",
            "source": request.source,
        }, on_conflict="identity_id,angle").execute()

        # Check which angles are now complete
        views = supabase.table("identity_views").select("angle").eq(
            "identity_id", request.identity_id
        ).eq("status", "validated").execute()

        collected = [v["angle"] for v in views.data] if views.data else []
        required = {"front", "profile", "three_quarter"}
        missing = list(required - set(collected))

        return {
            "success": True,
            "collected_angles": collected,
            "missing_angles": missing,
            "profile_complete": len(missing) == 0,
        }
    except Exception as e:
        print(f"Save identity view error: {str(e)}")
        return {"success": False, "error": str(e)[:100]}

# =========================================================================
# Outfit Try-On: Multi-layer Claid draping
# =========================================================================

class OutfitTryOnRequest(BaseModel):
    look_id: str
    identity_url: str
    garment_urls: list[str]

def process_outfit_tryon(look_id: str, identity_url: str, garment_urls: list[str]):
    """Multi-layer Claid: drape each garment sequentially onto the identity."""
    print(f"Outfit try-on for look {look_id}: {len(garment_urls)} garments")
    try:
        supabase.table("current_looks").update({"status": "rendering"}).eq("id", look_id).execute()

        result = claid.generate_multi_layer(identity_url, garment_urls)
        composite_url = result["image_url"]
        print(f"Outfit composite ready: {composite_url[:80]}")

        supabase.table("current_looks").update({
            "claid_result_url": composite_url,
            "status": "ready"
        }).eq("id", look_id).execute()

    except Exception as e:
        print(f"Outfit try-on failed for {look_id}: {str(e)}")
        supabase.table("current_looks").update({
            "status": "failed"
        }).eq("id", look_id).execute()

@app.post("/webhook/outfit-tryon")
async def handle_outfit_tryon(request: OutfitTryOnRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(process_outfit_tryon, request.look_id, request.identity_url, request.garment_urls)
    return {"message": "Outfit try-on started", "look_id": request.look_id}


# =========================================================================
# Two-Stage Fashion Pipeline: Claid (on-model image) → Kie (video)
# =========================================================================

class FashionJobRequest(BaseModel):
    job_id: str
    garment_image_url: str
    preset_id: str
    aspect_ratio: str = "9:16"
    model_options: dict = {}  # gender, ethnicity for Claid
    identity_id: str = ""  # If set, use all 3 master angle views

def process_fashion_job(job_id: str, garment_image_url: str, preset_id: str, aspect_ratio: str, model_options: dict, identity_id: str = ""):
    """
    Multi-angle fashion pipeline:
    1. Fetch 3 master identity images (front, profile, 3/4) from identity_views
    2. Claid.ai: each master + garment → 3 on-model fashion images
    3. Kie.ai: all 3 images as ingredients → REFERENCE_2_VIDEO → fashion video
    """
    print(f"Fashion job {job_id}: preset={preset_id}, garment={garment_image_url[:60]}...")

    try:
        # Stage 0: Update status
        supabase.table("jobs").update({"status": "processing"}).eq("id", job_id).execute()

        # Collect master identity URLs (all 3 angles)
        master_urls = []
        if identity_id:
            views_resp = supabase.table("identity_views").select("angle, master_url").eq(
                "identity_id", identity_id
            ).execute()
            if views_resp.data:
                for v in views_resp.data:
                    if v.get("master_url"):
                        master_urls.append(v["master_url"])
                        print(f"  Found master for {v.get('angle')}: {v['master_url'][:60]}")

        # Fallback: if no identity_id or no masters, check identities table
        if not master_urls and identity_id:
            ident_resp = supabase.table("identities").select("master_identity_url").eq("id", identity_id).single().execute()
            if ident_resp.data and ident_resp.data.get("master_identity_url"):
                master_urls = [ident_resp.data["master_identity_url"]]
                print(f"  Fallback to single master: {master_urls[0][:60]}")

        # Stage 1: Claid.ai — generate on-model images (one per master angle)
        on_model_urls = []

        if master_urls:
            print(f"Stage 1: Running Claid for {len(master_urls)} master angle(s) + garment...")
            for i, person_url in enumerate(master_urls):
                print(f"  Claid call {i+1}/{len(master_urls)}: person={person_url[:50]}")
                try:
                    claid_result = claid.generate_on_model(
                        garment_image_url=garment_image_url,
                        person_image_url=person_url
                    )
                    url = claid_result["image_url"]
                    on_model_urls.append(url)
                    print(f"  Claid {i+1} done: {url[:80]}")
                except Exception as claid_err:
                    print(f"  Claid {i+1} failed (continuing): {str(claid_err)[:100]}")
        else:
            # No identity — use Claid with just the garment (AI model)
            print(f"Stage 1: No identity — Claid with garment only + AI model...")
            claid_result = claid.generate_on_model(garment_image_url, options=model_options)
            on_model_urls = [claid_result["image_url"]]
            print(f"Stage 1 done: {on_model_urls[0][:80]}")

        if not on_model_urls:
            raise Exception("No on-model images generated by Claid")

        # Update job with intermediate results
        supabase.table("jobs").update({
            "provider_metadata": {
                "stage": "video_generation",
                "on_model_image_urls": on_model_urls,
                "on_model_image_url": on_model_urls[0],  # backwards compat
                "preset_id": preset_id
            }
        }).eq("id", job_id).execute()

        # Stage 2: Kie.ai — generate video from ALL on-model images + preset prompt
        preset = get_preset(preset_id)
        hidden_prompt = preset["prompt"]
        print(f"Stage 2: Calling Kie.ai Veo with {len(on_model_urls)} reference image(s)")
        print(f"  Preset '{preset_id}': {hidden_prompt[:60]}...")

        from .kie import generate_video as kie_generate
        task_info = kie_generate(
            prompt=hidden_prompt,
            model="veo-3.1-fast",
            aspectRatio=aspect_ratio,
            duration=preset.get("duration", 8),
            imageUrls=on_model_urls  # ALL on-model images as REFERENCE_2_VIDEO ingredients
        )

        print(f"Kie response: {task_info}")

        # Extract task ID
        data = task_info.get("data") or {}
        task_id = None
        if isinstance(data, dict):
            task_id = data.get("taskId") or data.get("task_id") or data.get("id")
        if not task_id:
            task_id = task_info.get("taskId") or task_info.get("task_id") or task_info.get("id")

        if not task_id:
            raise Exception(f"No task_id from Kie response: {task_info}")

        print(f"Video task started: {task_id}")

        # Stage 3: Poll for video completion
        model = "veo-3.1-fast"
        while True:
            from .kie import get_task_status as kie_status
            status_data = kie_status(task_id, model)

            poll_data = status_data.get("data") if isinstance(status_data, dict) else None
            if not isinstance(poll_data, dict):
                poll_data = {}

            raw_status = poll_data.get("status", "")
            success_flag = poll_data.get("successFlag")

            if raw_status in ("SUCCESS", "success") or success_flag == 1:
                status = "completed"
            elif raw_status in ("GENERATE_FAILED", "CREATE_TASK_FAILED", "fail") or success_flag in (2, 3):
                status = "failed"
            else:
                status = "processing"

            print(f"Fashion job {job_id} poll: {status} (raw={raw_status}, flag={success_flag})")

            if status == "completed":
                results = poll_data.get("results") or poll_data.get("works") or []
                video_url = None
                if results and isinstance(results, list):
                    first = results[0] if isinstance(results[0], dict) else {}
                    video_url = first.get("url") or first.get("videoUrl") or first.get("video_url")
                if not video_url:
                    video_url = poll_data.get("videoUrl") or poll_data.get("url") or poll_data.get("video_url")

                if not video_url:
                    raise Exception(f"Video completed but no URL: {status_data}")

                supabase.table("jobs").update({
                    "status": "completed",
                    "output_url": video_url,
                    "provider_metadata": {
                        "task_id": task_id,
                        "preset_id": preset_id,
                        "on_model_image_urls": on_model_urls,
                        "on_model_image_url": on_model_urls[0],
                        "aspect_ratio": aspect_ratio
                    }
                }).eq("id", job_id).execute()
                print(f"Fashion job {job_id} completed: {video_url}")
                break

            elif status == "failed":
                error_msg = poll_data.get("error") or poll_data.get("msg") or "Unknown error"
                raise Exception(f"Video generation failed: {error_msg}")

            time.sleep(5)

    except Exception as e:
        print(f"Fashion job {job_id} failed: {str(e)}")
        supabase.table("jobs").update({
            "status": "failed",
            "error_message": str(e)
        }).eq("id", job_id).execute()

@app.post("/webhook/fashion-generate")
async def handle_fashion_webhook(request: FashionJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        process_fashion_job,
        request.job_id,
        request.garment_image_url,
        request.preset_id,
        request.aspect_ratio,
        request.model_options,
        request.identity_id
    )
    return {"message": "Fashion job received", "job_id": request.job_id}

import requests
import tempfile

from typing import Optional

class StitchRequest(BaseModel):
    project_id: str
    video_urls: list[str]
    audio_url: Optional[str] = None
    output_format: str = "mp4"

def process_stitch_job(project_id: str, video_urls: list[str], audio_url: Optional[str] = None):
    # Lazy import to avoid crashing if ffmpeg is not installed
    from moviepy.editor import VideoFileClip, concatenate_videoclips
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
