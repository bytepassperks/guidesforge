"""Guide processing pipeline - orchestrates AI steps via Celery."""
import base64
import io
import json
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from app.utils.s3 import (
    get_s3_client,
    upload_annotated_screenshot,
    upload_screenshot,
    upload_video,
)

# Modal app name must match modal/app.py: modal.App("guidesforge")
MODAL_APP_NAME = "guidesforge"


def _get_presigned_url(s3_url: str, expiration: int = 3600) -> str:
    """Convert an S3 public URL to a presigned URL for authenticated access.

    iDrive E2's public endpoint returns 302 redirects for unauthenticated GET
    requests, so we generate presigned URLs that go through the S3 API.
    """
    from app.config import settings

    if not s3_url or not s3_url.startswith("http"):
        return s3_url

    # Extract S3 key from URL: {endpoint}/{bucket}/{key}
    prefix = f"{settings.S3_ENDPOINT}/{settings.S3_BUCKET}/"
    if s3_url.startswith(prefix):
        key = s3_url[len(prefix):]
    else:
        return s3_url  # Not our S3 URL, return as-is

    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expiration,
    )


def enrich_guide_steps(guide_id: str, db: Session):
    """Enrich existing guide steps created by upload_recording.

    Works with EXISTING GuideStep records in the DB (no duplicates).
    Full AI processing pipeline:
    1. Upload screenshots to S3 (convert data URLs -> S3)
    2. Describe each screenshot (via Modal or metadata fallback)
    3. Generate TTS audio per step (Kokoro via Modal)
    4. Annotate screenshots (click coordinates + Pillow)
    5. Assemble final MP4 video (FFmpeg via Modal or local)
    6. Generate embedding for semantic search
    """
    from app.models.database import Guide, GuideStep

    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise ValueError(f"Guide {guide_id} not found")

    try:
        # Load existing steps from DB (created by upload_recording)
        existing_steps = (
            db.query(GuideStep)
            .filter(GuideStep.guide_id == guide_id)
            .order_by(GuideStep.step_number)
            .all()
        )

        if not existing_steps:
            print(f"[PIPELINE] No steps found for guide {guide_id}")
            guide.status = "ready"
            guide.updated_at = datetime.utcnow()
            db.commit()
            return

        # Step 1: Upload screenshot data URLs to S3
        print(f"[PIPELINE] Step 1: Uploading screenshots to S3 for guide {guide_id}")
        _upload_screenshots_to_s3(existing_steps, str(guide_id), db)

        # Step 2: Describe screenshots
        print(f"[PIPELINE] Step 2: Describing screenshots for guide {guide_id}")
        _describe_screenshots(existing_steps, db)

        # Step 3: Generate TTS audio
        print(f"[PIPELINE] Step 3: Generating TTS audio for guide {guide_id}")
        _generate_tts_audio(guide, existing_steps, db)

        # Step 4: Annotate screenshots using click coordinates
        print(f"[PIPELINE] Step 4: Annotating screenshots for guide {guide_id}")
        _annotate_screenshots(existing_steps, db)

        # Step 5: Assemble video
        print(f"[PIPELINE] Step 5: Assembling video for guide {guide_id}")
        _assemble_video(guide, existing_steps, db)

        # Step 6: Generate embedding for semantic search
        print(f"[PIPELINE] Step 6: Generating embedding for guide {guide_id}")
        _generate_embedding(guide, existing_steps, db)

    except Exception as e:
        print(f"[PIPELINE] Pipeline error for guide {guide_id}: {e}")
        guide.status = "failed"
        guide.updated_at = datetime.utcnow()
        db.commit()
        print(f"[PIPELINE] Guide {guide_id} marked as failed")
        raise
    else:
        guide.status = "ready"
        guide.updated_at = datetime.utcnow()
        db.commit()
        print(f"[PIPELINE] Guide {guide_id} marked as ready")


def _upload_screenshots_to_s3(steps: List, guide_id: str, db: Session):
    """Convert data URL screenshots to S3 uploads."""
    for step in steps:
        if not step.screenshot_url:
            continue

        # Check if already an S3 URL (not a data URL)
        if step.screenshot_url.startswith("http"):
            continue

        try:
            # Handle data URL format: data:image/png;base64,iVBOR...
            screenshot_data = step.screenshot_url
            if screenshot_data.startswith("data:"):
                # Strip data URL prefix
                _, encoded = screenshot_data.split(",", 1)
                screenshot_bytes = base64.b64decode(encoded)
            else:
                # Try raw base64
                screenshot_bytes = base64.b64decode(screenshot_data)

            s3_url = upload_screenshot(screenshot_bytes, guide_id, step.step_number)
            step.screenshot_url = s3_url
            step.baseline_screenshot_url = s3_url
        except Exception as e:
            print(f"[PIPELINE] Error uploading screenshot for step {step.step_number}: {e}")

    db.commit()


def _describe_screenshots(steps: List, db: Session):
    """Describe each screenshot using Modal AI vision (moondream2)."""
    import modal
    describe_fn = modal.Function.from_name(MODAL_APP_NAME, "describe_screenshot")
    print("[PIPELINE] Using Modal describe_screenshot for AI descriptions")

    described = 0
    for step in steps:
        try:
            if step.screenshot_url and step.screenshot_url.startswith("http"):
                # Generate presigned URL so Modal can download the screenshot
                # (iDrive E2 public URLs return 302 redirects)
                presigned_url = _get_presigned_url(step.screenshot_url)
                # Use Modal AI vision to describe the screenshot
                result = describe_fn.remote(
                    screenshot_url=presigned_url,
                    context=f"Step {step.step_number} of a how-to guide. The user clicked at coordinates ({step.click_x}, {step.click_y}).",
                )
                step.title = f"Step {step.step_number}"
                step.description = result
                step.script_text = result
                described += 1
                print(f"[PIPELINE] AI described step {step.step_number}: {result[:60]}...")
            else:
                # No screenshot URL available yet — use upload metadata
                _describe_step_from_metadata(step)
        except Exception as e:
            print(f"[PIPELINE] Error describing step {step.step_number}: {e}")
            raise

    print(f"[PIPELINE] Described {described}/{len(steps)} steps")
    db.commit()


def _describe_step_from_metadata(step):
    """Generate description from step metadata (existing description, page URL)."""
    # Use existing description from upload_recording if available
    # (e.g. 'Click on "Login"' from the extension's describeClick function)
    if step.description and step.description.strip():
        description = step.description.strip()
    elif step.page_url:
        description = f"Perform action on {step.page_url}"
    else:
        description = f"Perform the action shown in step {step.step_number}"

    step.title = f"Step {step.step_number}"
    step.description = description
    step.script_text = f"In step {step.step_number}, {description.lower()}."


def _generate_tts_audio(guide, steps: List, db: Session):
    """Generate TTS audio for each step using Modal (Kokoro)."""
    try:
        import modal
        # Modal function name must match modal/app.py: text_to_speech
        tts_fn = modal.Function.from_name(MODAL_APP_NAME, "text_to_speech")

        voice = "af_heart"
        # Check if user has a voice profile for cloning
        use_clone = guide.creator and hasattr(guide.creator, 'voice_profile_url') and guide.creator.voice_profile_url
        clone_fn = None
        if use_clone:
            try:
                # Modal function name: voice_clone_tts
                clone_fn = modal.Function.from_name(MODAL_APP_NAME, "voice_clone_tts")
            except Exception:
                use_clone = False

        for step in steps:
            if not step.script_text:
                continue
            try:
                if use_clone and clone_fn:
                    audio_url = clone_fn.remote(
                        text=step.script_text,
                        reference_audio_url=guide.creator.voice_profile_url,
                        guide_id=str(guide.id),
                        step_number=step.step_number,
                    )
                else:
                    audio_url = tts_fn.remote(
                        text=step.script_text,
                        voice=voice,
                        guide_id=str(guide.id),
                        step_number=step.step_number,
                    )
                step.audio_url = audio_url
                print(f"[PIPELINE] TTS generated for step {step.step_number}: {audio_url[:80] if audio_url else 'None'}...")
            except Exception as e:
                print(f"[PIPELINE] TTS failed for step {step.step_number}: {e}")

        db.commit()
    except Exception as e:
        print(f"[PIPELINE] Modal TTS not available: {e}")


def _annotate_screenshots(steps: List, db: Session):
    """Annotate screenshots with click indicators using Pillow (no API cost).

    Uses click_x, click_y coordinates captured by the extension to draw
    a red circle/arrow annotation on each screenshot.
    """
    try:
        import requests as req
        from PIL import Image, ImageDraw
    except ImportError:
        print("[PIPELINE] Pillow not available, skipping annotations")
        for step in steps:
            step.annotated_screenshot_url = step.screenshot_url
        db.commit()
        return

    for step in steps:
        try:
            if not step.screenshot_url or not step.screenshot_url.startswith("http"):
                step.annotated_screenshot_url = step.screenshot_url
                continue

            # Download the screenshot using presigned URL
            # (iDrive E2 public URLs return 302 redirects)
            presigned_url = _get_presigned_url(step.screenshot_url)
            img_resp = req.get(presigned_url, timeout=30)
            if img_resp.status_code != 200:
                step.annotated_screenshot_url = step.screenshot_url
                continue

            img = Image.open(io.BytesIO(img_resp.content))
            draw = ImageDraw.Draw(img)
            w, h = img.size

            # Use click coordinates to draw annotation
            click_x = step.click_x
            click_y = step.click_y

            if click_x is not None and click_y is not None and click_x > 0 and click_y > 0:
                # Scale coordinates to image dimensions if needed
                cx = int(click_x)
                cy = int(click_y)

                # Clamp to image bounds
                cx = max(0, min(cx, w - 1))
                cy = max(0, min(cy, h - 1))

                # Draw a red circle around the click point
                radius = max(20, min(w, h) // 40)
                for offset in range(3):
                    r = radius + offset
                    draw.ellipse(
                        [cx - r, cy - r, cx + r, cy + r],
                        outline="#EF4444",
                        width=2,
                    )

                # Draw an arrow pointing down to the click point
                arrow_top_y = max(0, cy - radius - 30)
                draw.line(
                    [(cx, arrow_top_y), (cx, cy - radius - 5)],
                    fill="#EF4444", width=3,
                )
                # Arrowhead
                draw.polygon(
                    [
                        (cx, cy - radius - 2),
                        (cx - 6, cy - radius - 12),
                        (cx + 6, cy - radius - 12),
                    ],
                    fill="#EF4444",
                )

                # Draw step number label
                try:
                    label = str(step.step_number)
                    label_x = cx + radius + 8
                    label_y = cy - 10
                    draw.rectangle(
                        [label_x - 2, label_y - 2, label_x + 18, label_y + 18],
                        fill="#EF4444",
                    )
                    draw.text((label_x + 2, label_y), label, fill="white")
                except Exception:
                    pass

            # Save annotated screenshot
            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            annotated_url = upload_annotated_screenshot(
                buffer.getvalue(), str(step.guide_id), step.step_number
            )
            step.annotated_screenshot_url = annotated_url
            print(f"[PIPELINE] Annotated step {step.step_number}")

        except Exception as e:
            print(f"[PIPELINE] Error annotating step {step.step_number}: {e}")
            step.annotated_screenshot_url = step.screenshot_url

    db.commit()


def _assemble_video(guide, steps: List, db: Session):
    """Assemble MP4 video from annotated screenshots + audio via Modal."""
    import modal
    assemble_fn = modal.Function.from_name(MODAL_APP_NAME, "assemble_video")

    steps_data = []
    for step in steps:
        # Use presigned URLs so Modal can download files
        # (iDrive E2 public URLs return 302 redirects)
        screenshot = step.annotated_screenshot_url or step.screenshot_url
        audio = step.audio_url
        steps_data.append({
            "step_number": step.step_number,
            "screenshot_url": _get_presigned_url(screenshot) if screenshot else None,
            "audio_url": _get_presigned_url(audio) if audio else None,
            "title": step.title,
        })

    video_url = assemble_fn.remote(
        guide_id=str(guide.id),
        steps=steps_data,
    )

    if video_url:
        guide.video_url = video_url
        guide.total_duration_seconds = len(steps) * 5
        db.commit()
        print(f"[PIPELINE] Video assembled via Modal: {video_url[:80]}...")
    else:
        print(f"[PIPELINE] Video assembly returned empty URL for guide {guide.id}")


def _assemble_video_local(guide, steps: List, db: Session):
    """Local FFmpeg video assembly fallback."""
    import os
    import subprocess
    import tempfile

    import requests as req

    temp_dir = tempfile.mkdtemp()
    try:
        clips = []
        for i, step in enumerate(steps):
            # Download screenshot
            img_url = step.annotated_screenshot_url or step.screenshot_url
            if not img_url or not img_url.startswith("http"):
                continue
            img_resp = req.get(_get_presigned_url(img_url), timeout=30)
            if img_resp.status_code != 200:
                continue
            img_path = os.path.join(temp_dir, f"step_{i}.png")
            with open(img_path, "wb") as f:
                f.write(img_resp.content)

            # If audio exists, download it
            duration = 5.0
            audio_path = None
            if step.audio_url:
                audio_resp = req.get(_get_presigned_url(step.audio_url), timeout=30)
                if audio_resp.status_code == 200:
                    audio_path = os.path.join(temp_dir, f"step_{i}.wav")
                    with open(audio_path, "wb") as f:
                        f.write(audio_resp.content)
                    # Get actual duration
                    try:
                        result = subprocess.run(
                            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", audio_path],
                            capture_output=True, text=True, timeout=10,
                        )
                        duration = float(json.loads(result.stdout)["format"]["duration"])
                    except Exception:
                        pass

            # Create clip with zoompan effect
            out_clip = os.path.join(temp_dir, f"clip_{i}.mp4")
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1", "-i", img_path,
                "-t", str(duration + 0.5),
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
            ]
            if audio_path:
                cmd.extend(["-i", audio_path, "-c:a", "aac", "-shortest"])
            cmd.append(out_clip)
            subprocess.run(cmd, capture_output=True, timeout=60)
            if os.path.exists(out_clip):
                clips.append(out_clip)

        if clips:
            # Concat all clips
            concat_file = os.path.join(temp_dir, "concat.txt")
            with open(concat_file, "w") as f:
                for clip in clips:
                    f.write(f"file '{clip}'\n")

            output_path = os.path.join(temp_dir, "final.mp4")
            subprocess.run([
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", concat_file, "-c:v", "libx264", "-c:a", "aac",
                "-movflags", "+faststart", output_path,
            ], capture_output=True, timeout=120)

            if os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    video_bytes = f.read()
                video_url = upload_video(video_bytes, str(guide.id))
                guide.video_url = video_url

                # Calculate total duration
                try:
                    result = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", output_path],
                        capture_output=True, text=True, timeout=10,
                    )
                    guide.total_duration_seconds = int(float(json.loads(result.stdout)["format"]["duration"]))
                except Exception:
                    guide.total_duration_seconds = len(steps) * 5

                db.commit()
    except Exception as e:
        print(f"[PIPELINE] Local video assembly failed: {e}")
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def _generate_embedding(guide, steps: List, db: Session):
    """Generate pgvector embedding for semantic search."""
    try:
        from app.services.embedding_service import get_embedding

        # Combine guide title + description + all step text
        text_parts = [guide.title or ""]
        if guide.description:
            text_parts.append(guide.description)
        for step in steps:
            if step.title:
                text_parts.append(step.title)
            if step.description:
                text_parts.append(step.description)

        full_text = " ".join(text_parts)
        embedding = get_embedding(full_text)
        if embedding:
            guide.embedding = embedding
            db.commit()
    except Exception as e:
        print(f"[PIPELINE] Embedding generation failed: {e}")
