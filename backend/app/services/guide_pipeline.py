"""Guide processing pipeline - orchestrates AI steps via Celery."""
import base64
import io
import json
from datetime import datetime
from typing import Dict, List

from sqlalchemy.orm import Session

from app.config import settings
from app.utils.s3 import upload_annotated_screenshot, upload_audio, upload_screenshot, upload_video


def process_guide_steps(guide_id: str, steps_data: List[Dict], db: Session):
    """Full AI processing pipeline for a guide:
    1. Upload screenshots to S3
    2. Describe each screenshot (GPT-4o-mini)
    3. Assemble narration script
    4. Generate TTS audio per step (Kokoro)
    5. Annotate screenshots (OmniParser)
    6. Assemble final MP4 video (FFmpeg)
    """
    from app.models.database import Guide, GuideStep

    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise ValueError(f"Guide {guide_id} not found")

    try:
        # Step 1: Upload screenshots and create step records
        created_steps = []
        for step_data in steps_data:
            screenshot_bytes = base64.b64decode(step_data["screenshot_data"])
            screenshot_url = upload_screenshot(screenshot_bytes, str(guide_id), step_data["step_number"])

            step = GuideStep(
                guide_id=guide_id,
                step_number=step_data["step_number"],
                page_url=step_data["page_url"],
                element_selector=step_data.get("element_selector"),
                click_x=step_data.get("click_x"),
                click_y=step_data.get("click_y"),
                screenshot_url=screenshot_url,
                baseline_screenshot_url=screenshot_url,
            )
            db.add(step)
            db.flush()
            created_steps.append(step)

        guide.total_steps = len(created_steps)
        db.commit()

        # Step 2: Describe screenshots via AI
        _describe_screenshots(created_steps, db)

        # Step 3: Assemble narration script
        _assemble_script(guide, created_steps, db)

        # Step 4: Generate TTS audio
        _generate_tts_audio(guide, created_steps, db)

        # Step 5: Annotate screenshots
        _annotate_screenshots(created_steps, db)

        # Step 6: Assemble video
        _assemble_video(guide, created_steps, db)

        # Mark guide as ready
        guide.status = "ready"
        guide.updated_at = datetime.utcnow()
        db.commit()

        # Step 7: Generate embedding for semantic search
        _generate_embedding(guide, created_steps, db)

    except Exception as e:
        guide.status = "failed"
        db.commit()
        raise e


def _describe_screenshots(steps: List, db: Session):
    """Use GPT-4o-mini to describe each screenshot."""
    try:
        import openai
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        for step in steps:
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"""You are writing step {step.step_number} of a how-to guide.
Describe the action in ONE clear sentence. Start with an action verb.
Return JSON: {{"title": "...", "description": "...", "script_text": "..."}}
The script_text should be a natural narration sentence for TTS.""",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": step.screenshot_url, "detail": "high"},
                            },
                        ],
                    }],
                    response_format={"type": "json_object"},
                    max_tokens=300,
                )
                result = json.loads(response.choices[0].message.content)
                step.title = result.get("title", f"Step {step.step_number}")
                step.description = result.get("description", "")
                step.script_text = result.get("script_text", step.description)
            except Exception as e:
                print(f"[PIPELINE] Error describing step {step.step_number}: {e}")
                step.title = f"Step {step.step_number}"
                step.description = "Click action performed"
                step.script_text = f"In step {step.step_number}, perform the indicated action."

        db.commit()
    except ImportError:
        print("[PIPELINE] OpenAI not available, using fallback descriptions")
        for step in steps:
            step.title = f"Step {step.step_number}"
            step.description = "Action performed"
            step.script_text = f"In step {step.step_number}, perform the indicated action."
        db.commit()


def _assemble_script(guide, steps: List, db: Session):
    """Assemble a cohesive narration script from individual step descriptions."""
    try:
        import openai
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        steps_text = "\n".join([
            f"Step {s.step_number}: {s.script_text or s.description}"
            for s in steps
        ])

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": f"""You are writing a narration script for a how-to video guide titled "{guide.title}".
Here are the individual step descriptions:

{steps_text}

Rewrite each step's narration to flow naturally as a continuous guide.
Keep each step's narration to 1-2 sentences. Be clear and instructional.
Return JSON: {{"steps": [{{"step_number": 1, "script_text": "..."}}]}}""",
            }],
            response_format={"type": "json_object"},
            max_tokens=1000,
        )
        result = json.loads(response.choices[0].message.content)
        for step_script in result.get("steps", []):
            for step in steps:
                if step.step_number == step_script["step_number"]:
                    step.script_text = step_script["script_text"]
                    break
        db.commit()
    except Exception as e:
        print(f"[PIPELINE] Error assembling script: {e}")


def _generate_tts_audio(guide, steps: List, db: Session):
    """Generate TTS audio for each step using Modal (Kokoro) or fallback."""
    try:
        import modal
        generate_tts = modal.Function.lookup("guidesforge-inference", "generate_tts")

        voice = "af_heart"
        # Check if user has a voice profile for cloning
        if guide.creator and guide.creator.voice_profile_url:
            clone_voice = modal.Function.lookup("guidesforge-inference", "clone_voice")
            for step in steps:
                if step.script_text:
                    try:
                        audio_bytes = clone_voice.remote(
                            text=step.script_text,
                            reference_audio_url=guide.creator.voice_profile_url,
                        )
                        audio_url = upload_audio(audio_bytes, str(guide.id), step.step_number)
                        step.audio_url = audio_url
                    except Exception as e:
                        print(f"[PIPELINE] Voice clone failed for step {step.step_number}, falling back to Kokoro: {e}")
                        audio_bytes = generate_tts.remote(text=step.script_text, voice=voice)
                        audio_url = upload_audio(audio_bytes, str(guide.id), step.step_number)
                        step.audio_url = audio_url
        else:
            for step in steps:
                if step.script_text:
                    try:
                        audio_bytes = generate_tts.remote(text=step.script_text, voice=voice)
                        audio_url = upload_audio(audio_bytes, str(guide.id), step.step_number)
                        step.audio_url = audio_url
                    except Exception as e:
                        print(f"[PIPELINE] TTS failed for step {step.step_number}: {e}")

        db.commit()
    except Exception as e:
        print(f"[PIPELINE] Modal TTS not available: {e}")


def _annotate_screenshots(steps: List, db: Session):
    """Use GPT-4o-mini to detect UI elements and annotate screenshots."""
    try:
        import openai
        from PIL import Image, ImageDraw

        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)

        for step in steps:
            try:
                # Detect UI elements
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": """Identify the main interactive UI element that was clicked in this screenshot.
Return JSON: {"elements": [{"type": "button|input|link|menu", "label": "...", "bbox": [x1, y1, x2, y2], "is_target": true}]}
Coordinates should be approximate percentages (0-100) of the image dimensions.""",
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": step.screenshot_url, "detail": "high"},
                            },
                        ],
                    }],
                    response_format={"type": "json_object"},
                    max_tokens=500,
                )
                elements = json.loads(response.choices[0].message.content)
                step.detected_elements = elements

                # Draw annotations on screenshot
                import requests as req
                img_resp = req.get(step.screenshot_url)
                img = Image.open(io.BytesIO(img_resp.content))
                draw = ImageDraw.Draw(img)

                for elem in elements.get("elements", []):
                    bbox = elem.get("bbox", [])
                    if len(bbox) == 4 and elem.get("is_target"):
                        # Convert percentage to pixels
                        w, h = img.size
                        x1 = int(bbox[0] * w / 100)
                        y1 = int(bbox[1] * h / 100)
                        x2 = int(bbox[2] * w / 100)
                        y2 = int(bbox[3] * h / 100)
                        # Draw red rectangle around target
                        for offset in range(3):
                            draw.rectangle(
                                [x1 - offset, y1 - offset, x2 + offset, y2 + offset],
                                outline="#EF4444",
                            )
                        # Draw arrow pointing to element
                        center_x = (x1 + x2) // 2
                        arrow_start_y = max(0, y1 - 40)
                        draw.line(
                            [(center_x, arrow_start_y), (center_x, y1 - 5)],
                            fill="#EF4444", width=3,
                        )

                # Save annotated screenshot
                buffer = io.BytesIO()
                img.save(buffer, format="PNG")
                annotated_url = upload_annotated_screenshot(
                    buffer.getvalue(), str(step.guide_id), step.step_number
                )
                step.annotated_screenshot_url = annotated_url

            except Exception as e:
                print(f"[PIPELINE] Error annotating step {step.step_number}: {e}")
                step.annotated_screenshot_url = step.screenshot_url

        db.commit()
    except Exception as e:
        print(f"[PIPELINE] Annotation service not available: {e}")
        for step in steps:
            step.annotated_screenshot_url = step.screenshot_url
        db.commit()


def _assemble_video(guide, steps: List, db: Session):
    """Assemble MP4 video from annotated screenshots + audio using FFmpeg."""
    try:
        import modal
        assemble = modal.Function.lookup("guidesforge-inference", "assemble_video")

        steps_data = []
        for step in steps:
            steps_data.append({
                "step_number": step.step_number,
                "annotated_screenshot_url": step.annotated_screenshot_url or step.screenshot_url,
                "audio_url": step.audio_url,
                "title": step.title,
                "click_x": step.click_x,
                "click_y": step.click_y,
            })

        video_url = assemble.remote(
            guide_id=str(guide.id),
            steps=steps_data,
            output_bucket=settings.S3_BUCKET,
        )
        guide.video_url = video_url

        # Calculate total duration
        total_duration = 0
        for step in steps:
            if step.audio_url:
                total_duration += 5  # Approximate 5 seconds per step
        guide.total_duration_seconds = total_duration

        db.commit()
    except Exception as e:
        print(f"[PIPELINE] Video assembly not available via Modal: {e}")
        # Fallback: try local FFmpeg
        _assemble_video_local(guide, steps, db)


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
            img_resp = req.get(img_url)
            img_path = os.path.join(temp_dir, f"step_{i}.png")
            with open(img_path, "wb") as f:
                f.write(img_resp.content)

            # If audio exists, download it
            duration = 5.0
            audio_path = None
            if step.audio_url:
                audio_resp = req.get(step.audio_url)
                audio_path = os.path.join(temp_dir, f"step_{i}.wav")
                with open(audio_path, "wb") as f:
                    f.write(audio_resp.content)
                # Get actual duration
                try:
                    result = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", audio_path],
                        capture_output=True, text=True,
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
                "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30",
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
            ]
            if audio_path:
                cmd.extend(["-i", audio_path, "-c:a", "aac", "-shortest"])
            cmd.append(out_clip)
            subprocess.run(cmd, capture_output=True, timeout=120)
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
            ], capture_output=True, timeout=300)

            if os.path.exists(output_path):
                with open(output_path, "rb") as f:
                    video_bytes = f.read()
                video_url = upload_video(video_bytes, str(guide.id))
                guide.video_url = video_url

                # Calculate total duration
                try:
                    result = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", output_path],
                        capture_output=True, text=True,
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
