"""
Project State & Reroll Service.

Manages the lifecycle of a generation project:
  - Create (pay-to-play credit gate)
  - Scene reroll (up to 3 times)
  - Select previous scene (undo)
  - Resume (save & continue later)

All mutations go through Supabase service role for RLS bypass.
Credit deductions are transactional with project creation.
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from supabase import create_client, Client

from .models import (
    ProjectStatus,
    ProjectResponse,
    SceneHistoryEntry,
    MAX_REROLLS,
)
from .scene_gen import generate_base_scene

logger = logging.getLogger(__name__)

# ── Supabase Service Client (bypasses RLS) ───────────────────────────────────

_service_client: Optional[Client] = None


def _get_service_client() -> Client:
    """Lazy-init Supabase client using service role key."""
    global _service_client
    if _service_client is None:
        url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _service_client = create_client(url, key)
    return _service_client


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _project_to_response(row: dict) -> ProjectResponse:
    """Convert a Supabase row dict to a ProjectResponse."""
    history = row.get("scene_history", [])
    active_idx = row.get("active_scene_index", 0)

    # Resolve active scene URL from history
    active_url = None
    if history and 0 <= active_idx < len(history):
        active_url = history[active_idx].get("url")

    return ProjectResponse(
        id=row["id"],
        user_id=row["user_id"],
        identity_id=row.get("identity_id"),
        status=row.get("pipeline_status", "DRAFT"),
        credits_paid=row.get("credits_paid", False),
        reroll_count=row.get("reroll_count", 0),
        scene_history=history,
        active_scene_index=active_idx,
        active_scene_url=active_url,
        prompt=row.get("prompt"),
        fashn_render_url=row.get("fashn_render_url"),
        veo_video_url=row.get("veo_video_url"),
        created_at=row.get("created_at"),
        updated_at=row.get("updated_at"),
    )


# ═════════════════════════════════════════════════════════════════════════════
# A. Create Project (Pay-to-Play Gate)
# ═════════════════════════════════════════════════════════════════════════════

async def create_project(
    user_id: str,
    identity_id: str,
    prompt: str,
) -> ProjectResponse:
    """
    POST /projects/start

    1. Check user has >= 1 credit
    2. TRANSACTION: Deduct 1 credit AND create Project with credits_paid=True
    3. Trigger Step 1: Gemini Scene Render
    4. Save result to scene_history, set active_scene_index = 0
    5. Return Project JSON
    """
    sb = _get_service_client()
    project_id = str(uuid4())

    # ── 1. Check credit balance ──────────────────────────────────────
    profile = sb.table("profiles").select("credit_balance").eq("id", user_id).single().execute()
    balance = profile.data.get("credit_balance", 0)

    if balance < 1:
        raise ValueError("Insufficient credits. You need at least 1 credit to start a project.")

    # ── 2. Transactional: deduct credit + create project ─────────────
    new_balance = balance - 1

    # Deduct credit
    sb.table("profiles").update({
        "credit_balance": new_balance,
    }).eq("id", user_id).execute()

    # Record credit transaction
    sb.table("credit_transactions").insert({
        "user_id": user_id,
        "amount": -1,
        "balance_after": new_balance,
        "reason": "generation",
        "job_id": project_id,
        "metadata": json.dumps({"type": "project_start", "identity_id": identity_id}),
    }).execute()

    # Create project in DRAFT status first
    sb.table("projects").insert({
        "id": project_id,
        "user_id": user_id,
        "identity_id": identity_id,
        "pipeline_status": "DRAFT",
        "credits_paid": True,
        "prompt": prompt,
        "scene_history": [],
        "active_scene_index": 0,
        "reroll_count": 0,
    }).execute()

    # ── 3. Generate scene ────────────────────────────────────────────
    try:
        scene_url = await generate_base_scene(user_id, prompt)
    except Exception as e:
        # Mark project as failed but DON'T refund yet — let user retry
        logger.error(f"Scene generation failed for project {project_id}: {e}")
        raise RuntimeError(f"Scene generation failed: {e}")

    # ── 4. Save scene to history ─────────────────────────────────────
    entry = SceneHistoryEntry(
        id=0,
        url=scene_url,
        prompt=prompt,
        created_at=_now_iso(),
    )

    sb.table("projects").update({
        "pipeline_status": "SCENE_GENERATED",
        "scene_history": [entry.dict()],
        "active_scene_index": 0,
    }).eq("id", project_id).execute()

    # ── 5. Return project ────────────────────────────────────────────
    result = sb.table("projects").select("*").eq("id", project_id).single().execute()
    return _project_to_response(result.data)


# ═════════════════════════════════════════════════════════════════════════════
# B. Scene Reroll (Try Again)
# ═════════════════════════════════════════════════════════════════════════════

async def reroll_scene(
    project_id: str,
    user_id: str,
    new_prompt: Optional[str] = None,
) -> ProjectResponse:
    """
    POST /projects/{id}/reroll_scene

    1. Fetch project. Verify ownership + status == SCENE_GENERATED
    2. Check reroll_count < MAX_REROLLS
    3. Increment reroll_count, call Gemini again
    4. Append to scene_history, update active_scene_index
    """
    sb = _get_service_client()

    # Fetch project
    result = sb.table("projects").select("*").eq("id", project_id).single().execute()
    project = result.data

    if not project:
        raise ValueError("Project not found.")
    if project["user_id"] != user_id:
        raise PermissionError("You don't own this project.")
    if project.get("pipeline_status") != "SCENE_GENERATED":
        raise ValueError(
            f"Reroll only allowed in SCENE_GENERATED status. Current: {project.get('pipeline_status')}"
        )

    reroll_count = project.get("reroll_count", 0)
    if reroll_count >= MAX_REROLLS:
        raise ValueError(
            f"Reroll limit reached ({MAX_REROLLS}). Buy more credits or pick a scene."
        )

    # Use new prompt or fall back to original
    prompt = new_prompt or project.get("prompt", "")

    # Generate new scene
    scene_url = await generate_base_scene(user_id, prompt)

    # Update history
    history = project.get("scene_history", [])
    new_index = len(history)
    entry = SceneHistoryEntry(
        id=new_index,
        url=scene_url,
        prompt=prompt,
        created_at=_now_iso(),
    )
    history.append(entry.dict())

    # Persist
    sb.table("projects").update({
        "reroll_count": reroll_count + 1,
        "scene_history": history,
        "active_scene_index": new_index,
    }).eq("id", project_id).execute()

    # Return updated project
    result = sb.table("projects").select("*").eq("id", project_id).single().execute()
    return _project_to_response(result.data)


# ═════════════════════════════════════════════════════════════════════════════
# C. Select Previous Scene (Undo)
# ═════════════════════════════════════════════════════════════════════════════

async def select_scene(
    project_id: str,
    user_id: str,
    scene_index: int,
) -> ProjectResponse:
    """
    POST /projects/{id}/select_scene

    Update active_scene_index so the next steps (Audit, VTO) use the chosen scene.
    """
    sb = _get_service_client()

    result = sb.table("projects").select("*").eq("id", project_id).single().execute()
    project = result.data

    if not project:
        raise ValueError("Project not found.")
    if project["user_id"] != user_id:
        raise PermissionError("You don't own this project.")

    history = project.get("scene_history", [])
    if scene_index < 0 or scene_index >= len(history):
        raise ValueError(
            f"Invalid scene_index {scene_index}. Valid range: 0–{len(history) - 1}"
        )

    sb.table("projects").update({
        "active_scene_index": scene_index,
    }).eq("id", project_id).execute()

    result = sb.table("projects").select("*").eq("id", project_id).single().execute()
    return _project_to_response(result.data)


# ═════════════════════════════════════════════════════════════════════════════
# D. Get / Resume Project (Save & Continue)
# ═════════════════════════════════════════════════════════════════════════════

async def get_project(
    project_id: str,
    user_id: str,
) -> ProjectResponse:
    """
    GET /projects/{id}

    Returns full project state for the frontend to resume at the correct step.
    If status == SCENE_GENERATED → show Outfit Builder with active scene.
    """
    sb = _get_service_client()

    result = sb.table("projects").select("*").eq("id", project_id).single().execute()
    project = result.data

    if not project:
        raise ValueError("Project not found.")
    if project["user_id"] != user_id:
        raise PermissionError("You don't own this project.")

    return _project_to_response(project)


async def list_user_projects(user_id: str) -> list:
    """
    GET /projects — List all projects for a user, newest first.
    """
    sb = _get_service_client()

    result = (
        sb.table("projects")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return [_project_to_response(row) for row in result.data]


# ═════════════════════════════════════════════════════════════════════════════
# E. Update Project Status (internal — called by orchestrator)
# ═════════════════════════════════════════════════════════════════════════════

async def update_project_status(
    project_id: str,
    status: str,
    fashn_render_url: Optional[str] = None,
    veo_video_url: Optional[str] = None,
):
    """Update project status and pipeline outputs (called internally)."""
    sb = _get_service_client()

    update: dict = {"pipeline_status": status}
    if fashn_render_url:
        update["fashn_render_url"] = fashn_render_url
    if veo_video_url:
        update["veo_video_url"] = veo_video_url

    sb.table("projects").update(update).eq("id", project_id).execute()
    logger.info(f"Project {project_id} → {status}")
