#!/usr/bin/env python3
"""
Mac Mini Build Agent — polls Supabase for pending garments,
processes them via Style3D (stubbed), and syncs results back.

Usage:
    export SUPABASE_URL="https://your-project.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."
    python3 mac_agent.py

Requirements:
    pip install supabase httpx Pillow
"""

import os
import sys
import time
import json
import tempfile
import traceback
from pathlib import Path

import httpx

# ── Supabase Client ──────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
POLL_INTERVAL = 30  # seconds

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

client = httpx.Client(timeout=60)


def supabase_get(path: str, params: dict = {}) -> list:
    """GET from Supabase REST API."""
    resp = client.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers=HEADERS,
        params=params,
    )
    resp.raise_for_status()
    return resp.json()


def supabase_patch(path: str, match: dict, body: dict) -> list:
    """PATCH (update) rows matching criteria."""
    params = {f"{k}": f"eq.{v}" for k, v in match.items()}
    resp = client.patch(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers=HEADERS,
        params=params,
        json=body,
    )
    resp.raise_for_status()
    return resp.json()


def supabase_upload(bucket: str, file_path: str, local_path: str, content_type: str = "image/png") -> str:
    """Upload a file to Supabase Storage and return its public URL."""
    with open(local_path, "rb") as f:
        data = f.read()

    resp = client.post(
        f"{SUPABASE_URL}/storage/v1/object/{bucket}/{file_path}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        content=data,
    )
    resp.raise_for_status()

    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{file_path}"


# ── Style3D Stubs ────────────────────────────────────────────────────────────
# Replace these with actual Style3D SDK calls once installed.

def import_as_garment(image_path: str) -> dict:
    """
    STUB: Import a 2D garment image into Style3D Studio.
    Replace with: style3d.import_as_garment(image_path)
    """
    print(f"  [STUB] import_as_garment({image_path})")
    return {"garment_id": "stub_garment", "status": "imported"}


def auto_stitch(garment_data: dict) -> dict:
    """
    STUB: Auto-stitch the garment pattern.
    Replace with: style3d.auto_stitch(garment_data)
    """
    print(f"  [STUB] auto_stitch(garment={garment_data.get('garment_id')})")
    return {"stitched": True}


def simulate_physics(garment_data: dict) -> dict:
    """
    STUB: Run physics simulation for drape.
    Replace with: style3d.simulate_physics(garment_data)
    """
    print(f"  [STUB] simulate_physics(garment={garment_data.get('garment_id')})")
    return {"simulated": True}


def render_png(garment_data: dict, output_path: str) -> str:
    """
    STUB: Render high-res transparent PNG.
    Replace with: style3d.render(garment_data, output_path, format='png', transparent=True)
    For now, creates a placeholder file.
    """
    print(f"  [STUB] render_png → {output_path}")
    # Create a simple placeholder PNG (1x1 pixel)
    from PIL import Image
    img = Image.new("RGBA", (512, 512), (200, 200, 200, 255))
    img.save(output_path, "PNG")
    return output_path


def export_glb(garment_data: dict, output_path: str) -> str:
    """
    STUB: Export .glb 3D model.
    Replace with: style3d.export(garment_data, output_path, format='glb')
    For now, creates a placeholder file.
    """
    print(f"  [STUB] export_glb → {output_path}")
    with open(output_path, "wb") as f:
        f.write(b"placeholder_glb")
    return output_path


# ── Processing Pipeline ──────────────────────────────────────────────────────

def download_image(url: str, dest: str):
    """Download an image from a URL to a local path."""
    resp = client.get(url)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        f.write(resp.content)
    print(f"  Downloaded: {url} → {dest}")


def process_item(item: dict):
    """Process a single garment through the Style3D pipeline."""
    item_id = item["id"]
    name = item.get("name", "unknown")
    raw_url = item["raw_image_url"]

    print(f"\n{'='*60}")
    print(f"Processing: {name} ({item_id[:8]}...)")
    print(f"{'='*60}")

    # 1. Mark as processing
    supabase_patch("clothes", {"id": item_id}, {
        "build_status": "processing",
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # 2. Download raw image
            raw_path = os.path.join(tmpdir, "raw.jpg")
            download_image(raw_url, raw_path)

            # 3. Style3D Pipeline
            garment = import_as_garment(raw_path)
            auto_stitch(garment)
            simulate_physics(garment)

            # 4. Render outputs
            png_path = os.path.join(tmpdir, "render.png")
            glb_path = os.path.join(tmpdir, "model.glb")
            render_png(garment, png_path)
            export_glb(garment, glb_path)

            # 5. Upload to Supabase
            ts = int(time.time())
            png_url = supabase_upload(
                "wardrobe-assets",
                f"processed/{item_id}/{ts}_render.png",
                png_path,
                "image/png",
            )
            glb_url = supabase_upload(
                "wardrobe-assets",
                f"processed/{item_id}/{ts}_model.glb",
                glb_path,
                "model/gltf-binary",
            )

            # 6. Update DB → ready
            supabase_patch("clothes", {"id": item_id}, {
                "build_status": "ready",
                "processed_3d_url": png_url,
                "glb_url": glb_url,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })
            print(f"  ✅ Done: {name}")

        except Exception as e:
            error_msg = str(e)[:200]
            print(f"  ❌ Failed: {error_msg}")
            traceback.print_exc()
            supabase_patch("clothes", {"id": item_id}, {
                "build_status": "failed",
                "error_message": error_msg,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })


# ── Main Loop ────────────────────────────────────────────────────────────────

def poll():
    """Check for pending items and process them."""
    items = supabase_get("clothes", {
        "build_status": "eq.pending",
        "order": "created_at.asc",
        "limit": "10",
    })

    if not items:
        return 0

    print(f"\n🔍 Found {len(items)} pending item(s)")
    for item in items:
        process_item(item)

    return len(items)


def main():
    print("╔══════════════════════════════════════════════╗")
    print("║   Mac Mini Build Agent — Style3D Pipeline    ║")
    print("╚══════════════════════════════════════════════╝")
    print(f"  Supabase: {SUPABASE_URL[:40]}...")
    print(f"  Poll interval: {POLL_INTERVAL}s")
    print(f"  Press Ctrl+C to stop\n")

    while True:
        try:
            processed = poll()
            if processed == 0:
                print(f"  💤 No pending items. Sleeping {POLL_INTERVAL}s...", end="\r")
        except KeyboardInterrupt:
            print("\n\n👋 Agent stopped.")
            break
        except Exception as e:
            print(f"\n⚠️  Poll error: {e}")
            traceback.print_exc()

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
