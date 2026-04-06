"""AI pipeline routes - process guide, check staleness, job status."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import Guide, User, WorkspaceMember, get_db
from app.schemas.pipeline import CheckStalenessRequest, JobStatusResponse, ProcessGuideRequest
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
    data: ProcessGuideRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Receive recording data from the Chrome extension and create a new guide."""
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

    # Queue the full AI pipeline
    from app.services.celery_worker import process_guide_task
    task = process_guide_task.delay(
        guide_id=str(data.guide_id),
        steps_data=data.steps,
    )

    return {
        "message": "Recording uploaded and processing started",
        "task_id": task.id,
        "guide_id": str(data.guide_id),
    }
