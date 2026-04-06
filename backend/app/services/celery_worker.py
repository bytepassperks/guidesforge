"""Celery worker for async guide processing tasks."""
import os
from celery import Celery

from app.config import settings

celery_app = Celery(
    "guidesforge",
    broker=settings.REDIS_URL or "redis://localhost:6379/0",
    backend=settings.REDIS_URL or "redis://localhost:6379/0",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minute hard limit
    task_soft_time_limit=540,  # 9 minute soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
)


@celery_app.task(bind=True, name="process_guide")
def process_guide_task(self, guide_id: str, steps_data: list):
    """Process a guide through the full AI pipeline."""
    from app.models.database import SessionLocal
    from app.services.guide_pipeline import process_guide_steps

    db = SessionLocal()
    try:
        self.update_state(state="PROCESSING", meta={"guide_id": guide_id, "step": "starting"})
        process_guide_steps(guide_id, steps_data, db)
        return {"guide_id": guide_id, "status": "completed"}
    except Exception as e:
        self.update_state(state="FAILED", meta={"guide_id": guide_id, "error": str(e)})
        raise
    finally:
        db.close()


@celery_app.task(bind=True, name="check_staleness")
def check_staleness_task(self, guide_id: str):
    """Run staleness detection for a single guide."""
    import asyncio
    from app.models.database import SessionLocal
    from app.services.staleness_service import run_staleness_check_for_guide

    db = SessionLocal()
    try:
        self.update_state(state="PROCESSING", meta={"guide_id": guide_id})
        max_diff = asyncio.run(run_staleness_check_for_guide(guide_id, db))
        return {"guide_id": guide_id, "max_diff_percentage": max_diff}
    except Exception as e:
        self.update_state(state="FAILED", meta={"guide_id": guide_id, "error": str(e)})
        raise
    finally:
        db.close()


@celery_app.task(bind=True, name="check_all_staleness")
def check_all_staleness_task(self):
    """Nightly cron: check staleness for all enabled guides."""
    import asyncio
    from app.models.database import SessionLocal, Guide
    from app.services.staleness_service import run_staleness_check_for_guide
    from app.services.email_service import send_staleness_notification

    db = SessionLocal()
    try:
        guides = db.query(Guide).filter(
            Guide.staleness_detection_enabled == True,
            Guide.status.in_(["ready", "stale"]),
        ).all()

        results = []
        for guide in guides:
            try:
                max_diff = asyncio.run(run_staleness_check_for_guide(str(guide.id), db))
                results.append({"guide_id": str(guide.id), "max_diff": max_diff})

                # Send notification if stale
                if max_diff > 15.0 and guide.creator:
                    send_staleness_notification(
                        to=guide.creator.email,
                        guide_title=guide.title,
                        diff_percentage=max_diff,
                        guide_id=str(guide.id),
                        workspace_slug="",
                    )
            except Exception as e:
                results.append({"guide_id": str(guide.id), "error": str(e)})

        return {"checked": len(results), "results": results}
    finally:
        db.close()


@celery_app.task(bind=True, name="regenerate_step_audio")
def regenerate_step_audio_task(self, guide_id: str, step_id: str):
    """Regenerate TTS audio for a single step."""
    from app.models.database import SessionLocal, Guide, GuideStep
    from app.utils.s3 import upload_audio

    db = SessionLocal()
    try:
        step = db.query(GuideStep).filter(GuideStep.id == step_id).first()
        if not step or not step.script_text:
            return {"error": "Step not found or no script text"}

        guide = db.query(Guide).filter(Guide.id == guide_id).first()

        try:
            import modal
            generate_tts = modal.Function.lookup("guidesforge-inference", "generate_tts")
            audio_bytes = generate_tts.remote(text=step.script_text, voice="af_heart")
            audio_url = upload_audio(audio_bytes, guide_id, step.step_number)
            step.audio_url = audio_url
            db.commit()
            return {"step_id": step_id, "audio_url": audio_url}
        except Exception as e:
            return {"step_id": step_id, "error": str(e)}
    finally:
        db.close()


@celery_app.task(bind=True, name="regenerate_step_callouts")
def regenerate_step_callouts_task(self, guide_id: str, step_id: str):
    """Regenerate annotated screenshot for a single step."""
    import io
    import json
    from PIL import Image, ImageDraw
    from app.models.database import SessionLocal, GuideStep
    from app.utils.s3 import upload_annotated_screenshot

    db = SessionLocal()
    try:
        step = db.query(GuideStep).filter(GuideStep.id == step_id).first()
        if not step or not step.screenshot_url:
            return {"error": "Step not found or no screenshot"}

        try:
            import openai
            import requests

            client = openai.OpenAI()
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Identify the main interactive UI element in this screenshot.
Return JSON: {"elements": [{"type": "button|input|link|menu", "label": "...", "bbox": [x1, y1, x2, y2], "is_target": true}]}
Coordinates as percentages (0-100).""",
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

            # Draw annotations
            img_resp = requests.get(step.screenshot_url)
            img = Image.open(io.BytesIO(img_resp.content))
            draw = ImageDraw.Draw(img)

            for elem in elements.get("elements", []):
                bbox = elem.get("bbox", [])
                if len(bbox) == 4 and elem.get("is_target"):
                    w, h = img.size
                    x1 = int(bbox[0] * w / 100)
                    y1 = int(bbox[1] * h / 100)
                    x2 = int(bbox[2] * w / 100)
                    y2 = int(bbox[3] * h / 100)
                    for offset in range(3):
                        draw.rectangle(
                            [x1 - offset, y1 - offset, x2 + offset, y2 + offset],
                            outline="#EF4444",
                        )

            buffer = io.BytesIO()
            img.save(buffer, format="PNG")
            annotated_url = upload_annotated_screenshot(
                buffer.getvalue(), guide_id, step.step_number
            )
            step.annotated_screenshot_url = annotated_url
            db.commit()
            return {"step_id": step_id, "annotated_url": annotated_url}
        except Exception as e:
            return {"step_id": step_id, "error": str(e)}
    finally:
        db.close()
