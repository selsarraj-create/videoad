"""
Video Generation Pipeline

Production-grade orchestration for:
  Part 1 — Identity Setup: AI Director → Photoroom cleaning → Face crop
  Part 2 — Creation Flow:  Scene Gen → Audit → Outfit Prep → VTO Drape → Veo Animation
  Projects — Stateful project lifecycle with credits, rerolls, and resume
"""

from .orchestrator import VideoGenerationService
from .routes import pipeline_router, project_router
from .models import PipelineStatus, ProjectStatus

__all__ = [
    "VideoGenerationService",
    "pipeline_router",
    "project_router",
    "PipelineStatus",
    "ProjectStatus",
]

