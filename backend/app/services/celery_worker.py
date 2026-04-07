"""Celery worker for async guide processing tasks."""
from celery import Celery
from celery.schedules import crontab

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

celery_app.conf.beat_schedule = {
    "check-all-staleness-nightly": {
        "task": "check_all_staleness",
        "schedule": crontab(hour=20, minute=30),  # 8:30 PM UTC = 2 AM IST
    },
    "expire-trials-nightly": {
        "task": "expire_trials",
        "schedule": crontab(hour=0, minute=0),  # Midnight UTC
    },
}


@celery_app.task(bind=True, name="process_guide")
def process_guide_task(self, guide_id: str):
    """Process a guide through the full AI pipeline.

    Enriches existing GuideStep records (created by upload_recording)
    with S3 screenshots, AI descriptions, TTS audio, annotations, and video.
    """
    from app.models.database import SessionLocal
    from app.services.guide_pipeline import enrich_guide_steps

    db = SessionLocal()
    try:
        self.update_state(state="PROCESSING", meta={"guide_id": guide_id, "step": "starting"})
        enrich_guide_steps(guide_id, db)
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

    from app.models.database import Guide, SessionLocal
    from app.services.email_service import send_staleness_notification
    from app.services.staleness_service import run_staleness_check_for_guide

    db = SessionLocal()
    try:
        guides = db.query(Guide).filter(
            Guide.staleness_detection_enabled.is_(True),
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


@celery_app.task(bind=True, name="expire_trials")
def expire_trials_task(self):
    """Nightly cron: downgrade expired Pro trial users to the free plan."""
    from datetime import datetime

    from app.models.database import SessionLocal, Subscription, User

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        expired_users = db.query(User).filter(
            User.trial_ends_at.isnot(None),
            User.trial_ends_at < now,
            User.plan != "free",
        ).all()

        downgraded = 0
        for user in expired_users:
            # Check if user has an active paid subscription
            active_sub = db.query(Subscription).filter(
                Subscription.workspace_id.in_(
                    db.query(User.id).filter(User.id == user.id)
                ),
                Subscription.status == "active",
            ).first()

            if not active_sub:
                user.plan = "free"
                user.trial_ends_at = None
                downgraded += 1

                # Send notification email
                try:
                    from app.services.email_service import send_email_mailgun
                    send_email_mailgun(
                        to=user.email,
                        subject="[GuidesForge] Your Pro trial has ended",
                        html=f"""
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0C0D14; color: #FFFFFF; padding: 40px; border-radius: 16px;">
                            <h1 style="color: #6366F1;">GuidesForge</h1>
                            <h2>Your Pro trial has ended</h2>
                            <p style="color: #94A3B8;">Hi {user.full_name or 'there'},</p>
                            <p style="color: #94A3B8;">Your 14-day Pro trial has expired. You've been moved to the Free plan (10 guides/month).</p>
                            <p style="color: #94A3B8;">Upgrade anytime to keep all Pro features.</p>
                            <div style="text-align: center; margin-top: 32px;">
                                <a href="https://guidesforge.org/billing"
                                   style="background: #6366F1; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
                                    Upgrade Now
                                </a>
                            </div>
                        </div>
                        """,
                    )
                except Exception as e:
                    print(f"[TRIAL] Error sending trial expiry email to {user.email}: {e}")

        db.commit()
        return {"expired_users_checked": len(expired_users), "downgraded": downgraded}
    except Exception as e:
        print(f"[TRIAL] Error in expire_trials_task: {e}")
        raise
    finally:
        db.close()


@celery_app.task(bind=True, name="regenerate_step_audio")
def regenerate_step_audio_task(self, guide_id: str, step_id: str):
    """Regenerate TTS audio for a single step."""
    from app.models.database import GuideStep, SessionLocal
    from app.utils.s3 import upload_audio

    db = SessionLocal()
    try:
        step = db.query(GuideStep).filter(GuideStep.id == step_id).first()
        if not step or not step.script_text:
            return {"error": "Step not found or no script text"}

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

    from app.models.database import GuideStep, SessionLocal
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
