"""
Gemini integration for selfie validation and master identity generation.

- Validation: Google Gemini 2.0 Flash (vision) via REST — text/JSON analysis only
- Image Generation: Gemini 3 Pro Image via Kie.ai (Nano Banana Pro) — all image gen
"""

import os
import json
import time
import base64
import httpx
import logging
import requests as req_lib

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
API_BASE = "https://generativelanguage.googleapis.com/v1beta"

# ── Kie.ai config for image generation ────────────────────────────────────
KIE_API_KEY = os.environ.get("KIE_API_KEY", "")
KIE_API_BASE = "https://api.kie.ai/api/v1"


def _api_url(model: str) -> str:
    return f"{API_BASE}/models/{model}:generateContent?key={GEMINI_API_KEY}"


def _download_image_bytes(url: str) -> bytes:
    """Download image from URL and return raw bytes."""
    resp = httpx.get(url, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    return resp.content


def _guess_mime(url: str) -> str:
    lower = url.lower()
    if ".png" in lower:
        return "image/png"
    if ".webp" in lower:
        return "image/webp"
    return "image/jpeg"


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Gemini response, handling markdown code blocks."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        if "```" in text:
            json_block = text.split("```")[1]
            if json_block.startswith("json"):
                json_block = json_block[4:]
            return json.loads(json_block.strip())
        raise Exception(f"Gemini returned invalid JSON: {text[:200]}")


def _generate_content(model: str, parts: list, config: dict | None = None) -> dict:
    """Call Gemini generateContent REST endpoint."""
    if not GEMINI_API_KEY:
        raise Exception("GEMINI_API_KEY not set")

    body: dict = {
        "contents": [{"parts": parts}],
    }
    if config:
        body["generationConfig"] = config

    resp = httpx.post(
        _api_url(model),
        json=body,
        timeout=60,
    )

    if resp.status_code != 200:
        raise Exception(f"Gemini API error {resp.status_code}: {resp.text[:500]}")

    return resp.json()


# =========================================================================
# 1. Validate Selfie — Gemini Flash (Vision) — Full validation from URL
# =========================================================================

VALIDATION_PROMPT = """You are a professional photography quality inspector for a fashion AI platform.

Analyze this selfie and evaluate these 4 criteria:

1. **A-Pose** — Is the person standing with arms slightly away from the body, palms visible or facing forward? Arms must NOT be at the side or crossed. Think "airport security scanner" pose.
2. **Lighting** — Is the lighting even and natural? No harsh shadows on the face, no extreme backlighting. Soft, diffused light is ideal.
3. **Attire** — Is the person wearing form-fitting clothes? No baggy, oversized, or layered outfits. The AI needs to see body contour clearly.
4. **Resolution** — Does the image appear to be at least 2K resolution (i.e. looks detailed, not pixelated or heavily compressed)?

Return your analysis as a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "passed": true/false,
  "checks": [
    {"name": "pose", "passed": true/false, "message": "brief friendly feedback"},
    {"name": "lighting", "passed": true/false, "message": "brief friendly feedback"},
    {"name": "attire", "passed": true/false, "message": "brief friendly feedback"},
    {"name": "resolution", "passed": true/false, "message": "brief friendly feedback"}
  ]
}

"passed" is true only if ALL 4 checks pass. Be encouraging but honest. Keep messages under 12 words."""


def validate_selfie(image_url: str) -> dict:
    """
    Use Gemini Flash to validate a selfie against quality criteria.
    Returns { passed: bool, checks: [...] }
    """
    image_bytes = _download_image_bytes(image_url)
    mime = _guess_mime(image_url)

    parts = [
        {"inlineData": {"mimeType": mime, "data": base64.b64encode(image_bytes).decode()}},
        {"text": VALIDATION_PROMPT},
    ]

    result = _generate_content(
        model="gemini-2.0-flash",
        parts=parts,
        config={"temperature": 0.1, "responseMimeType": "application/json"},
    )

    text = result["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_json_response(text)


# =========================================================================
# 1b. Real-time Validation — Gemini Flash from base64 frame (no URL)
# =========================================================================

REALTIME_VALIDATION_PROMPT = """You are a live camera quality coach for a fashion AI platform.
Analyze this camera frame QUICKLY and evaluate:

1. **pose** — A-Pose? Arms away from body, palms visible? (NOT arms at sides or crossed)
2. **lighting** — Even, soft light? No harsh shadows or backlighting?
3. **attire** — Form-fitting clothes? Body contour visible? (NOT baggy or layered)
4. **resolution** — Image clear and detailed? Not blurry or pixelated?

Return ONLY this JSON (no markdown):
{
  "passed": true/false,
  "checks": [
    {"name": "pose", "passed": true/false, "message": "max 8 words coaching tip"},
    {"name": "lighting", "passed": true/false, "message": "max 8 words coaching tip"},
    {"name": "attire", "passed": true/false, "message": "max 8 words coaching tip"},
    {"name": "resolution", "passed": true/false, "message": "max 8 words coaching tip"}
  ]
}

"passed" = true only if ALL pass. Be concise. Give actionable coaching tips."""


def validate_selfie_realtime(image_base64: str) -> dict:
    """
    Validate a base64-encoded camera frame for real-time feedback.
    Optimized for speed — shorter prompt, lower token usage.
    """
    # Parse base64 data URL
    if image_base64.startswith("data:"):
        header, b64data = image_base64.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
    else:
        b64data = image_base64
        mime = "image/jpeg"

    parts = [
        {"inlineData": {"mimeType": mime, "data": b64data}},
        {"text": REALTIME_VALIDATION_PROMPT},
    ]

    result = _generate_content(
        model="gemini-2.0-flash",
        parts=parts,
        config={"temperature": 0.05, "responseMimeType": "application/json"},
    )

    text = result["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_json_response(text)


# =========================================================================
# 2. Generate Master Identity — Gemini Flash Image Generation
# =========================================================================

IDENTITY_PROMPT = """Transform this person into a professional 4K studio portrait on a pure white cyclorama background.

CRITICAL Requirements:
- Pure white (#FFFFFF) cyclorama background with professional studio lighting
- Preserve EXACT facial features, skin tone, hair color/style, and body proportions
- Full body shot, relaxed A-pose (arms slightly away from torso)
- Form-fitting neutral clothing (simple grey or black)
- 4K detail: sharp eyes, skin texture, hair strands
- High-contrast three-point lighting setup
- Fashion photography quality: clean, crisp, commercial-grade

This is a "Master Identity" reference portrait for virtual garment try-on. Anatomical accuracy is critical — do NOT alter the person's appearance, only improve the background, lighting, and composition."""


def _kie_generate_image(prompt: str, image_urls: list[str]) -> dict:
    """
    Submit an image generation/editing job to Kie.ai Nano Banana Pro (Gemini 3 Pro Image),
    poll for completion, and return { image_bytes, mime_type }.
    """
    if not KIE_API_KEY:
        raise Exception("KIE_API_KEY not set — cannot generate images via Kie.ai")

    url = f"{KIE_API_BASE}/nano-banana/generate"
    payload = {
        "prompt": prompt,
        "model": "nano_banana_pro",
        "imageUrls": image_urls,
        "mode": "IMAGE_EDIT",
    }
    headers = {
        "Authorization": f"Bearer {KIE_API_KEY}",
        "Content-Type": "application/json",
    }

    logger.info(f"Kie.ai image gen request: {len(image_urls)} image(s), prompt={prompt[:60]}...")
    resp = req_lib.post(url, json=payload, headers=headers, timeout=60)
    resp.raise_for_status()
    result = resp.json()

    # Extract task ID
    data = result.get("data") or {}
    task_id = None
    if isinstance(data, dict):
        task_id = data.get("taskId") or data.get("task_id") or data.get("id")
    if not task_id:
        task_id = result.get("taskId") or result.get("task_id") or result.get("id")
    if not task_id:
        raise Exception(f"No task_id from Kie.ai image gen response: {result}")

    logger.info(f"Kie.ai image task started: {task_id}")

    # Poll for completion (max 5 minutes)
    status_url = f"{KIE_API_BASE}/nano-banana/record-info"
    for _ in range(60):
        time.sleep(5)
        status_resp = req_lib.get(
            status_url,
            params={"taskId": task_id},
            headers={"Authorization": f"Bearer {KIE_API_KEY}"},
            timeout=30,
        )
        status_resp.raise_for_status()
        status_data = status_resp.json()

        poll_data = status_data.get("data") or {}
        raw_status = poll_data.get("status", "")
        success_flag = poll_data.get("successFlag")

        if raw_status in ("SUCCESS", "success") or success_flag == 1:
            # Extract output URL
            output_url = None
            results = poll_data.get("results") or poll_data.get("images") or []
            if results and isinstance(results, list):
                first = results[0]
                if isinstance(first, dict):
                    output_url = first.get("url") or first.get("imageUrl")
                elif isinstance(first, str):
                    output_url = first
            if not output_url:
                output_url = poll_data.get("imageUrl") or poll_data.get("url")

            if not output_url:
                raise Exception(f"Kie.ai image gen completed but no output URL: {status_data}")

            logger.info(f"Kie.ai image gen complete: {output_url[:80]}")

            # Download the generated image
            img_resp = req_lib.get(output_url, timeout=30)
            img_resp.raise_for_status()
            content_type = img_resp.headers.get("Content-Type", "image/png")

            return {
                "image_bytes": img_resp.content,
                "mime_type": content_type.split(";")[0],  # strip charset if present
            }

        elif raw_status in ("GENERATE_FAILED", "CREATE_TASK_FAILED", "fail") or success_flag in (2, 3):
            error_msg = poll_data.get("error") or poll_data.get("msg") or "Unknown"
            raise Exception(f"Kie.ai image gen failed: {error_msg}")

    raise Exception("Kie.ai image gen timed out after 5 minutes")


def generate_master_identity(image_url: str) -> dict:
    """
    Use Gemini 3 Pro Image (via Kie.ai Nano Banana Pro) to create a 4K studio portrait
    from a selfie. Returns { image_bytes: bytes, mime_type: str }.
    """
    return _kie_generate_image(IDENTITY_PROMPT, [image_url])


# =========================================================================
# 2b. Generate Body Collage — Nano Banana Pro (Gemini 3 Pro Image) via Kie.ai
# =========================================================================

COLLAGE_PROMPT = """Combine these 3 images into a single horizontal character sheet collage on a plain white background. Ensure consistent lighting and spacing between the three views."""


def generate_body_collage(image_urls: list[str]) -> dict:
    """
    Use Gemini 3 Pro Image (via Kie.ai Nano Banana Pro) to combine master identity
    angle images into a single horizontal character sheet collage.
    Returns { image_bytes: bytes, mime_type: str }.
    """
    if not image_urls:
        raise Exception("No image URLs provided for collage generation")

    return _kie_generate_image(COLLAGE_PROMPT, image_urls)


# =========================================================================
# 3. Pose Angle Detection — for AI-Director auto-shutter
# =========================================================================

POSE_ANGLE_PROMPT = """You are a computer vision pose angle detector for a fashion AI platform.

Analyze this camera frame and determine the person's body angle relative to the camera.

Classify as ONE of:
- "front" — Full body, person facing camera directly (chest and face visible, symmetrical shoulders)
- "profile" — Full body, person turned ~90° to camera (one shoulder visible, side of face)
- "three_quarter" — Full body, person at ~45° angle (both eyes visible but body slightly turned)
- "face_front" — Close-up of face only (head and shoulders, facing camera directly)
- "face_side" — Close-up of face only (head and shoulders, turned ~90° showing side profile)
- "unknown" — No person detected, or angle is ambiguous

Also evaluate capture quality:
- Is the FULL BODY visible for body shots, or HEAD AND SHOULDERS for face close-ups?
- Are arms away from body (A-pose or arms slightly spread) for body shots?
- Is the person NOT holding a phone or object?
- Is the silhouette clearly visible against the background?

Return ONLY this JSON (no markdown):
{
  "angle": "front|profile|three_quarter|face_front|face_side|unknown",
  "confidence": 0.0 to 1.0,
  "full_body_visible": true/false,
  "arms_clear": true/false,
  "no_phone": true/false,
  "silhouette_clear": true/false,
  "coaching_tip": "max 10 words of advice"
}"""


def validate_pose_angle(image_base64: str) -> dict:
    """
    Detect person's pose angle for AI-Director auto-shutter.
    Returns angle classification with confidence score.
    """
    if image_base64.startswith("data:"):
        header, b64data = image_base64.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
    else:
        b64data = image_base64
        mime = "image/jpeg"

    parts = [
        {"inlineData": {"mimeType": mime, "data": b64data}},
        {"text": POSE_ANGLE_PROMPT},
    ]

    result = _generate_content(
        model="gemini-2.0-flash",
        parts=parts,
        config={"temperature": 0.05, "responseMimeType": "application/json"},
    )

    text = result["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_json_response(text)


# =========================================================================
# 4. Upload Suitability — 2026-standard validation for manual imports
# =========================================================================

UPLOAD_SUITABILITY_PROMPT = """You are an expert image quality inspector for a premium fashion AI platform (2026 standard).

This image will be used to drape virtual garments onto the person using AI. Fabric rendering requires pixel-perfect body masks. Analyze this uploaded photo against these STRICT criteria:

1. **WHOLE PRODUCT** — Is the person's ENTIRE body visible? Head to feet, no body parts or clothing edges cut off at the frame boundary. Arms must not be cropped.

2. **TEXTURE CLARITY** — Are fabrics and skin textures crisp and detailed? The AI needs high-resolution detail to render drape correctly. Reject if image is compressed, noisy, or low-res.

3. **BLUR DETECTION** — Is the image sharp? Check for motion blur, focus blur, or camera shake. Any significant blur means the AI cannot create accurate masks.

4. **LIGHTING QUALITY** — Is lighting sufficient to see fabric textures and skin detail? No harsh shadows obscuring body contours. No extreme backlighting. Even, soft lighting preferred.

5. **POSE VERIFICATION** — Is the person:
   - NOT holding a phone, bag, or any object?
   - NOT hiding their silhouette (arms crossed, hands in pockets)?
   - Standing in a clear, unobstructed pose?
   (For face close-ups: head and shoulders clearly visible, face well-lit)

6. **ANGLE CLASSIFICATION** — What angle is this photo taken from?
   - "front" — Full body, facing camera, symmetrical shoulders
   - "profile" — Full body, turned ~90°, one shoulder visible
   - "three_quarter" — Full body, ~45° angle, both eyes but body turned
   - "face_front" — Close-up of face, head and shoulders, facing camera directly
   - "face_side" — Close-up of face, head and shoulders, turned ~90° showing side profile
   - "other" — back shot, overhead, etc. (REJECT)

Return ONLY this JSON:
{
  "suitable": true/false,
  "angle": "front|profile|three_quarter|face_front|face_side|other",
  "checks": {
    "whole_product": {"passed": true/false, "message": "max 12 words"},
    "texture_clarity": {"passed": true/false, "message": "max 12 words"},
    "blur": {"passed": true/false, "message": "max 12 words"},
    "lighting": {"passed": true/false, "message": "max 12 words"},
    "pose": {"passed": true/false, "message": "max 12 words"}
  },
  "issues": ["list of specific issues if any, empty if suitable"],
  "overall_message": "one-line summary, max 15 words"
}

IMPORTANT: For face close-ups (face_front, face_side), the "whole_product" check should pass if head and shoulders are clearly visible — full body is NOT required.
"suitable" is true ONLY if ALL checks pass AND angle is not "other"."""


def validate_upload_suitability(image_base64: str) -> dict:
    """
    Full 2026-standard suitability check for manually uploaded photos.
    Returns detailed pass/fail with specific issues.
    """
    if image_base64.startswith("data:"):
        header, b64data = image_base64.split(",", 1)
        mime = header.split(":")[1].split(";")[0]
    else:
        b64data = image_base64
        mime = "image/jpeg"

    parts = [
        {"inlineData": {"mimeType": mime, "data": b64data}},
        {"text": UPLOAD_SUITABILITY_PROMPT},
    ]

    result = _generate_content(
        model="gemini-2.0-flash",
        parts=parts,
        config={"temperature": 0.1, "responseMimeType": "application/json"},
    )

    text = result["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_json_response(text)

