"""
FastAPI routes for the video generation pipeline.

Pipeline Endpoints:
  POST /pipeline/identity     — Part 1: Setup identity (process 5 reference images)
  POST /pipeline/run          — Part 2: Run full creation flow
  GET  /pipeline/status/{id}  — Get pipeline job status

Project Endpoints:
  POST /projects/start                  — Create project (pay 1 credit)
  GET  /projects                        — List user's projects
  GET  /projects/{id}                   — Get / resume project
  POST /projects/{id}/reroll_scene      — Reroll scene (max 3)
  POST /projects/{id}/select_scene      — Select a previous scene
"""

import uuid
import logging

from fastapi import APIRouter, HTTPException

from .models import (
    IdentitySetupRequest,
    PipelineRunRequest,
    PipelineStatusResponse,
    GarmentInfo,
    ProjectStartRequest,
    ProjectRerollRequest,
    ProjectSelectSceneRequest,
    ProjectResponse,
)
from .orchestrator import VideoGenerationService
from . import project_service

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# Pipeline Router
# ═════════════════════════════════════════════════════════════════════════════

pipeline_router = APIRouter(prefix="/pipeline", tags=["pipeline"])

# Singleton service instance
_service = VideoGenerationService()


@pipeline_router.post("/identity")
async def setup_identity(request: IdentitySetupRequest):
    """Part 1: Process 5 AI-Director reference images."""
    try:
        cleaned = await _service.setup_identity(
            user_id=request.user_id,
            image_urls=request.image_urls,
        )
        return {
            "status": "ok",
            "user_id": request.user_id,
            "cleaned_images": cleaned,
        }
    except Exception as e:
        logger.error(f"Identity setup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@pipeline_router.post("/run", response_model=PipelineStatusResponse)
async def run_pipeline(request: PipelineRunRequest):
    """Part 2: Start the full video generation pipeline (async)."""
    job_id = request.job_id or str(uuid.uuid4())

    garments = [
        GarmentInfo(id=gid, image_url="", category="tops")
        for gid in request.garment_ids
    ]

    await _service.run_pipeline_background(
        job_id=job_id,
        user_id=request.user_id,
        prompt=request.prompt,
        garments=garments,
    )

    return PipelineStatusResponse(
        job_id=job_id,
        status="SCENE_GEN",
        current_step="Pipeline started — generating scene...",
        progress_pct=5,
    )


@pipeline_router.get("/status/{job_id}", response_model=PipelineStatusResponse)
async def get_pipeline_status(job_id: str):
    """Get the current status of a pipeline job."""
    status = _service.get_status(job_id)
    if status.error == "Job not found":
        raise HTTPException(status_code=404, detail="Job not found")
    return status


# ═════════════════════════════════════════════════════════════════════════════
# Project Router — Stateful project lifecycle
# ═════════════════════════════════════════════════════════════════════════════

project_router = APIRouter(prefix="/projects", tags=["projects"])


# ── A. Create Project (Pay-to-Play) ─────────────────────────────────────────

@project_router.post("/start", response_model=ProjectResponse)
async def start_project(request: ProjectStartRequest):
    """
    Pay 1 credit → create project → generate scene → return project state.

    Errors:
      - 402: Insufficient credits
      - 500: Scene generation failed
    """
    try:
        project = await project_service.create_project(
            user_id=request.user_id,
            identity_id=request.identity_id,
            prompt=request.prompt,
        )
        return project
    except ValueError as e:
        # Insufficient credits or validation error
        raise HTTPException(status_code=402, detail=str(e))
    except Exception as e:
        logger.error(f"Project start failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── B. Scene Reroll ──────────────────────────────────────────────────────────

@project_router.post("/{project_id}/reroll_scene", response_model=ProjectResponse)
async def reroll_scene(project_id: str, request: ProjectRerollRequest):
    """
    Reroll the scene (max 3 times). Must be in SCENE_GENERATED status.

    Errors:
      - 402: Reroll limit reached
      - 400: Wrong status or invalid project
      - 403: Not your project
    """
    try:
        # TODO: Extract user_id from auth middleware in production
        # For now, fetch from project itself for the service call
        sb = project_service._get_service_client()
        proj = sb.table("projects").select("user_id").eq("id", project_id).single().execute()
        if not proj.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project = await project_service.reroll_scene(
            project_id=project_id,
            user_id=proj.data["user_id"],
            new_prompt=request.prompt,
        )
        return project
    except ValueError as e:
        code = 402 if "limit" in str(e).lower() else 400
        raise HTTPException(status_code=code, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Reroll failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── C. Select Previous Scene ────────────────────────────────────────────────

@project_router.post("/{project_id}/select_scene", response_model=ProjectResponse)
async def select_scene(project_id: str, request: ProjectSelectSceneRequest):
    """
    Select a previous scene from history (undo).

    Errors:
      - 400: Invalid scene_index
      - 403: Not your project
    """
    try:
        sb = project_service._get_service_client()
        proj = sb.table("projects").select("user_id").eq("id", project_id).single().execute()
        if not proj.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project = await project_service.select_scene(
            project_id=project_id,
            user_id=proj.data["user_id"],
            scene_index=request.scene_index,
        )
        return project
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Select scene failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── D. Get / Resume Project ─────────────────────────────────────────────────

@project_router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str):
    """
    Get full project state for resuming.

    Frontend Instructions:
      - DRAFT → waiting for scene gen
      - SCENE_GENERATED → show Outfit Builder with scene_history[active_scene_index]
      - OUTFIT_SELECTED → show processing screen
      - PROCESSING_VIDEO → show progress
      - COMPLETED → show video player
    """
    try:
        sb = project_service._get_service_client()
        proj = sb.table("projects").select("user_id").eq("id", project_id).single().execute()
        if not proj.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project = await project_service.get_project(
            project_id=project_id,
            user_id=proj.data["user_id"],
        )
        return project
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Get project failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── E. List User Projects ───────────────────────────────────────────────────

@project_router.get("", response_model=list)
async def list_projects(user_id: str):
    """List all projects for a user, newest first."""
    try:
        projects = await project_service.list_user_projects(user_id)
        return projects
    except Exception as e:
        logger.error(f"List projects failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
