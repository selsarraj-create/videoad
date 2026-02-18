"""
VideoGenerationService — Main pipeline orchestrator.

Chains all 6 steps with status tracking, full asyncio support:
  Step 0: Identity Setup (Photoroom + Face Verify)
  Step 1: Scene Generation (Gemini 3 Pro)
  Step 2: Audit (Gemini 1.5 Flash)
  Step 3/4: Outfit Prep (Photoroom + PIL composite)
  Step 5: VTO Drape (Fashn.ai tryon-max)
  Step 6: Animation (Veo 3.1 via Kie.ai)
"""

import logging
import asyncio
from typing import Optional

from .models import (
    PipelineStatus,
    AuditResult,
    GarmentInfo,
    PipelineStatusResponse,
)
from .photoroom import clean_reference_images
from .face_crop import verify_face_resolution
from .scene_gen import generate_base_scene
from .audit import audit_scene
from .outfit_prep import prepare_garment_layer
from .drape import execute_vto
from .animate import animate_video

logger = logging.getLogger(__name__)


class VideoGenerationService:
    """
    Production-grade pipeline orchestrator.

    Usage:
        service = VideoGenerationService()

        # Part 1: Identity setup (run once per user)
        await service.setup_identity(user_id, image_urls)

        # Part 2: Creation flow (run per video)
        result = await service.run_pipeline(job_id, user_id, prompt, garment_ids)
    """

    def __init__(self):
        self._jobs: dict[str, PipelineStatusResponse] = {}

    def get_status(self, job_id: str) -> PipelineStatusResponse:
        """Get the current status of a pipeline job."""
        return self._jobs.get(job_id, PipelineStatusResponse(
            job_id=job_id,
            status=PipelineStatus.FAILED,
            error="Job not found",
        ))

    def _update_status(
        self,
        job_id: str,
        status: PipelineStatus,
        step: str = "",
        progress: int = 0,
        result_url: Optional[str] = None,
        error: Optional[str] = None,
    ):
        self._jobs[job_id] = PipelineStatusResponse(
            job_id=job_id,
            status=status,
            current_step=step,
            progress_pct=progress,
            result_url=result_url,
            error=error,
        )
        logger.info(f"[{job_id}] {status.value} → {step} ({progress}%)")

    # ── Part 1: Identity Setup ───────────────────────────────────────────

    async def setup_identity(
        self,
        user_id: str,
        image_urls: dict[str, str],
    ) -> dict[str, str]:
        """
        Part 1: Process the 5 AI-Director reference images.

        1. Send all 5 through Photoroom for cleaning
        2. Verify face_closeup_front is high-resolution
        3. Store as master references

        Args:
            user_id:    The user's unique ID.
            image_urls: Map of pose → raw image URL.

        Returns:
            Map of pose → cleaned public URL.
        """
        logger.info(f"Starting identity setup for user {user_id}")

        # Step 1: Photoroom clean all 5 images
        cleaned_urls = await clean_reference_images(user_id, image_urls)

        # Step 2: Verify face anchor resolution
        face_url = cleaned_urls.get("face_closeup_front")
        if face_url:
            await verify_face_resolution(user_id, face_url)
        else:
            logger.warning("No face_closeup_front in reference images!")

        logger.info(f"Identity setup complete for user {user_id}: {len(cleaned_urls)} masters")
        return cleaned_urls

    # ── Part 2: The Creation Flow ────────────────────────────────────────

    async def run_pipeline(
        self,
        job_id: str,
        user_id: str,
        prompt: str,
        garments: list[GarmentInfo],
    ) -> PipelineStatusResponse:
        """
        Part 2: Run the full video generation pipeline.

        Steps:
          1. Scene Generation (Gemini 3 Pro)
          2. Audit (Gemini 1.5 Flash)
          3/4. Outfit Prep (Photoroom + PIL)
          5. VTO Drape (Fashn.ai)
          6. Animation (Veo 3.1)

        Args:
            job_id:   Unique job identifier.
            user_id:  The user's unique ID.
            prompt:   Scene generation prompt.
            garments: List of GarmentInfo objects.

        Returns:
            Final PipelineStatusResponse with video URL.
        """
        try:
            # ── Step 1: Scene Generation ─────────────────────────────
            self._update_status(
                job_id, PipelineStatus.SCENE_GEN,
                "Generating base scene with Gemini 3 Pro...", 10
            )
            scene_url = await generate_base_scene(user_id, prompt)

            # ── Step 2: Audit ────────────────────────────────────────
            self._update_status(
                job_id, PipelineStatus.AUDITING,
                "Auditing scene for VTO suitability...", 25
            )
            audit_result = await audit_scene(scene_url)

            # ── Steps 3/4: Outfit Prep ───────────────────────────────
            self._update_status(
                job_id, PipelineStatus.OUTFIT_PREP,
                "Preparing garment layers...", 40
            )
            composite_url = await prepare_garment_layer(
                user_id, garments, audit_result
            )

            # ── Step 5: VTO Drape ────────────────────────────────────
            self._update_status(
                job_id, PipelineStatus.DRAPING,
                "Draping outfit onto scene via Fashn.ai...", 60
            )
            fashn_render_url = await execute_vto(
                user_id, scene_url, composite_url
            )

            # ── Step 6: Animation ────────────────────────────────────
            self._update_status(
                job_id, PipelineStatus.ANIMATING,
                "Animating fashion video via Veo 3.1...", 80
            )
            video_url = await animate_video(user_id, fashn_render_url)

            # ── Done ─────────────────────────────────────────────────
            self._update_status(
                job_id, PipelineStatus.COMPLETED,
                "Pipeline complete!", 100,
                result_url=video_url,
            )

            return self.get_status(job_id)

        except Exception as e:
            logger.error(f"Pipeline failed for job {job_id}: {e}", exc_info=True)
            self._update_status(
                job_id, PipelineStatus.FAILED,
                error=str(e),
            )
            return self.get_status(job_id)

    async def run_pipeline_background(
        self,
        job_id: str,
        user_id: str,
        prompt: str,
        garments: list[GarmentInfo],
    ):
        """Fire-and-forget wrapper for run_pipeline."""
        asyncio.create_task(self.run_pipeline(job_id, user_id, prompt, garments))
