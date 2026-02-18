"""
Pydantic models and enums for the video generation pipeline.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ── Pipeline Status ──────────────────────────────────────────────────────────

class PipelineStatus(str, Enum):
    IDENTITY_SETUP = "IDENTITY_SETUP"
    SCENE_GEN = "SCENE_GEN"
    AUDITING = "AUDITING"
    OUTFIT_PREP = "OUTFIT_PREP"
    DRAPING = "DRAPING"
    ANIMATING = "ANIMATING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


# ── Audit Result ─────────────────────────────────────────────────────────────

class AuditResult(BaseModel):
    is_full_body: bool = False
    feet_visible: bool = False
    hands_visible: bool = False
    lighting_condition: str = "unknown"


# ── Identity Pose Enum ───────────────────────────────────────────────────────

class PoseAngle(str, Enum):
    FRONT = "front"
    SIDE = "side"
    THREE_QUARTER = "three_quarter"
    FACE_CLOSEUP_FRONT = "face_closeup_front"
    FACE_CLOSEUP_SIDE = "face_closeup_side"


POSE_ANGLE_LIST = [p.value for p in PoseAngle]


# ── API Request Models ───────────────────────────────────────────────────────

class IdentitySetupRequest(BaseModel):
    """Part 1: Process 5 AI-Director reference images."""
    user_id: str
    image_urls: dict[str, str] = Field(
        ...,
        description="Map of pose → image URL, e.g. {'front': 'https://...'}"
    )


class PipelineRunRequest(BaseModel):
    """Part 2: Run the full creation flow."""
    job_id: str
    user_id: str
    prompt: str = Field(..., description="Scene generation prompt")
    garment_ids: list[str] = Field(default_factory=list, description="IDs from master_assets table")


class PipelineStatusResponse(BaseModel):
    job_id: str
    status: PipelineStatus
    current_step: str = ""
    progress_pct: int = 0
    result_url: Optional[str] = None
    error: Optional[str] = None


# ── Garment ──────────────────────────────────────────────────────────────────

class GarmentInfo(BaseModel):
    id: str
    image_url: str
    category: str = "tops"  # tops, bottoms, outerwear, shoes, accessories
    is_clean: bool = False  # True if already in master_assets as cleaned


# ── Project State ────────────────────────────────────────────────────────────

class ProjectStatus(str, Enum):
    DRAFT = "DRAFT"
    SCENE_GENERATED = "SCENE_GENERATED"
    OUTFIT_SELECTED = "OUTFIT_SELECTED"
    PROCESSING_VIDEO = "PROCESSING_VIDEO"
    COMPLETED = "COMPLETED"


MAX_REROLLS = 3


class SceneHistoryEntry(BaseModel):
    id: int
    url: str
    prompt: str = ""
    created_at: str  # ISO timestamp


class ProjectStartRequest(BaseModel):
    """Pay-to-play: deduct 1 credit, create project, trigger scene gen."""
    user_id: str
    identity_id: str
    prompt: str = Field(..., description="Scene generation prompt")


class ProjectRerollRequest(BaseModel):
    """Reroll the scene — up to MAX_REROLLS times."""
    prompt: Optional[str] = None  # optional new prompt


class ProjectSelectSceneRequest(BaseModel):
    """Select a previous scene from history."""
    scene_index: int


class ProjectResponse(BaseModel):
    id: str
    user_id: str
    identity_id: Optional[str] = None
    status: ProjectStatus
    credits_paid: bool = False
    reroll_count: int = 0
    scene_history: list = Field(default_factory=list)
    active_scene_index: int = 0
    active_scene_url: Optional[str] = None
    prompt: Optional[str] = None
    fashn_render_url: Optional[str] = None
    veo_video_url: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
