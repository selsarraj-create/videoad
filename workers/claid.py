"""
Claid.ai Garment Cleaning Module

Removes background, smart-crops with 10% padding, and applies soft color
enhancement via the Claid.ai API. Results are uploaded to Supabase Storage and
the public URL is returned.
"""

import os
import httpx
import uuid
import base64
from io import BytesIO

CLAID_API_URL = "https://api.claid.ai/v1-beta1/image/edit"


def _get_claid_key() -> str:
    key = os.environ.get("CLAID_API_KEY", "")
    if not key:
        raise RuntimeError("CLAID_API_KEY not set")
    return key


def clean_garment(image_url: str, supabase_client=None) -> str:
    """
    Send image to Claid.ai for cleaning, upload result to Supabase Storage.
    Returns the public URL of the cleaned PNG.
    """
    api_key = _get_claid_key()

    # Build Claid request
    payload = {
        "input": image_url,
        "operations": {
            "background": {
                "remove": True
            },
            "padding": {
                "smart_padding": {
                    "enabled": True,
                    "percent": 10
                }
            },
            "adjustments": {
                "saturation": 5,
                "contrast": 3,
                "brightness": 2
            },
            "resizing": {
                "fit": "bounds",
                "width": 1024,
                "height": 1024
            }
        },
        "output": {
            "format": "png"
        }
    }

    print(f"[Claid] Cleaning garment: {image_url[:80]}...")

    resp = httpx.post(
        CLAID_API_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()

    # Claid returns the processed image URL in data.output.tmp_url
    output_url = result.get("data", {}).get("output", {}).get("tmp_url")
    if not output_url:
        raise RuntimeError(f"Claid response missing output URL: {result}")

    print(f"[Claid] Processed image ready: {output_url[:80]}")

    # Download the processed image
    img_resp = httpx.get(output_url, timeout=60)
    img_resp.raise_for_status()
    img_bytes = img_resp.content

    # Upload to Supabase Storage
    if supabase_client:
        file_name = f"garments-clean/{uuid.uuid4()}.png"
        supabase_client.storage.from_("raw_assets").upload(
            file_name,
            img_bytes,
            {"content-type": "image/png"},
        )
        public_url = supabase_client.storage.from_("raw_assets").get_public_url(file_name)
        print(f"[Claid] Uploaded clean garment: {public_url[:80]}")
        return public_url

    # Fallback: return Claid's temp URL (short-lived)
    return output_url
