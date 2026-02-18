"""
S3/R2 storage helpers for the pipeline.

All master assets are stored under:
  product-images/{user_id}_master_{pose}.png

Uses httpx for async uploads and the existing R2 client pattern.
"""

import os
import logging
from io import BytesIO

import httpx

logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────

R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "")
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "assets")


# ── Helpers ──────────────────────────────────────────────────────────────────

def master_key(user_id: str, pose: str) -> str:
    """Generate the S3 key for a master reference image."""
    return f"product-images/{user_id}_master_{pose}.png"


def face_anchor_key(user_id: str) -> str:
    """The FACE_ANCHOR_REF key — the high-res face closeup for Veo."""
    return master_key(user_id, "face_closeup_front")


def master_url(user_id: str, pose: str) -> str:
    """Public URL for a master reference image."""
    base = R2_PUBLIC_URL.rstrip("/")
    return f"{base}/{master_key(user_id, pose)}"


def face_anchor_url(user_id: str) -> str:
    """Public URL for the FACE_ANCHOR_REF."""
    return master_url(user_id, "face_closeup_front")


async def download_image_bytes(url: str) -> bytes:
    """Download an image from a public URL and return raw bytes."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.content


async def upload_to_r2(key: str, data: bytes, content_type: str = "image/png") -> str:
    """
    Upload bytes to R2 via pre-signed URL or S3 API.
    
    For production, this would use boto3/aioboto3 with the R2 endpoint.
    Returns the public URL of the uploaded object.
    """
    # NOTE: In production, replace with actual S3 PutObject call.
    # This uses the pattern from /api/upload/product-image.
    try:
        import boto3
        from botocore.config import Config as BotoConfig

        s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=R2_ACCESS_KEY_ID,
            aws_secret_access_key=R2_SECRET_ACCESS_KEY,
            config=BotoConfig(signature_version="s3v4"),
            region_name="auto",
        )

        s3.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

        public_url = f"{R2_PUBLIC_URL.rstrip('/')}/{key}"
        logger.info(f"Uploaded to R2: {public_url}")
        return public_url

    except Exception as e:
        logger.error(f"R2 upload failed for key={key}: {e}")
        raise


async def upload_pipeline_artifact(
    user_id: str, filename: str, data: bytes, content_type: str = "image/png"
) -> str:
    """Upload a pipeline intermediate artifact (scene, composite, render, etc.)."""
    key = f"pipeline/{user_id}/{filename}"
    return await upload_to_r2(key, data, content_type)
