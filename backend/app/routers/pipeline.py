"""AI pipeline routes - process guide, check staleness, job status."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import Guide, GuideStep, User, Workspace, WorkspaceMember, get_db
from app.schemas.pipeline import CheckStalenessRequest, JobStatusResponse, ProcessGuideRequest, UploadRecordingRequest
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.post("/process-guide")
def process_guide(
    data: ProcessGuideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == data.guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    guide.status = "processing"
    db.commit()

    # Queue processing via Celery
    from app.services.celery_worker import process_guide_task
    task = process_guide_task.delay(
        guide_id=str(data.guide_id),
        steps_data=data.steps,
    )

    return {
        "message": "Guide processing started",
        "task_id": task.id,
        "guide_id": str(data.guide_id),
    }


@router.post("/check-staleness")
def check_staleness(
    data: CheckStalenessRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == data.guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    # Queue staleness check via Celery
    from app.services.celery_worker import check_staleness_task
    task = check_staleness_task.delay(guide_id=str(data.guide_id))

    return {
        "message": "Staleness check started",
        "task_id": task.id,
        "guide_id": str(data.guide_id),
    }


@router.get("/job/{task_id}", response_model=JobStatusResponse)
def get_job_status(task_id: str):
    from celery.result import AsyncResult

    from app.services.celery_worker import celery_app

    result = AsyncResult(task_id, app=celery_app)

    return JobStatusResponse(
        task_id=task_id,
        status=result.status,
        result=result.result if result.ready() else None,
    )


@router.post("/upload-recording")
async def upload_recording(
    data: UploadRecordingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Receive recording data from the Chrome extension.

    Creates a new guide automatically from the recording title and steps,
    then queues the AI pipeline for processing.
    """
    # Find the user's workspace
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=400, detail="No workspace found for user")

    workspace = db.query(Workspace).filter(Workspace.id == member.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=400, detail="Workspace not found")

    # Create the guide
    guide = Guide(
        workspace_id=workspace.id,
        creator_id=current_user.id,
        title=data.title or "Untitled Guide",
        description=f"Recorded via Chrome extension ({len(data.steps)} steps)",
        status="ready",
        total_steps=len(data.steps),
        total_duration_seconds=(data.duration_ms // 1000) if data.duration_ms else 0,
    )
    db.add(guide)
    db.flush()

    # Create guide steps from the recording data
    for step_data in data.steps:
        step = GuideStep(
            guide_id=guide.id,
            step_number=step_data.get("step_number", 0),
            description=step_data.get("description", ""),
            page_url=step_data.get("page_url", ""),
            element_selector=step_data.get("dom_selector"),
            screenshot_url=step_data.get("screenshot_data_url", ""),
        )
        db.add(step)

    db.commit()
    db.refresh(guide)

    # Try to queue the AI pipeline (Celery/Redis) for enrichment.
    # If Celery is not available, the guide is already saved with steps
    # and marked as "ready" so the user can see it in the dashboard.
    task_id = None
    try:
        from app.services.celery_worker import process_guide_task
        task = process_guide_task.delay(
            guide_id=str(guide.id),
            steps_data=data.steps,
        )
        task_id = task.id
        # Mark as processing only if Celery accepted the task
        guide.status = "processing"
        db.commit()
    except Exception as e:
        # Celery/Redis not available - guide stays "ready" with basic steps
        print(f"[UPLOAD] Celery not available, skipping AI pipeline: {e}")

    return {
        "message": "Recording uploaded successfully",
        "task_id": task_id,
        "guide_id": str(guide.id),
    }
