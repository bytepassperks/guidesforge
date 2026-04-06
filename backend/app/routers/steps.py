"""Guide step CRUD and regeneration routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import Guide, GuideStep, User, WorkspaceMember, get_db
from app.schemas.guides import GuideStepResponse, GuideStepUpdate
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/guides/{guide_id}/steps", tags=["steps"])


def _verify_guide_access(guide_id: uuid.UUID, user: User, db: Session) -> Guide:
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")
    return guide


@router.get("", response_model=list[GuideStepResponse])
def list_steps(
    guide_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_guide_access(guide_id, current_user, db)
    steps = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id
    ).order_by(GuideStep.step_number).all()
    return steps


@router.get("/{step_id}", response_model=GuideStepResponse)
def get_step(
    guide_id: uuid.UUID,
    step_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_guide_access(guide_id, current_user, db)
    step = db.query(GuideStep).filter(
        GuideStep.id == step_id, GuideStep.guide_id == guide_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")
    return step


@router.put("/{step_id}", response_model=GuideStepResponse)
def update_step(
    guide_id: uuid.UUID,
    step_id: uuid.UUID,
    data: GuideStepUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_guide_access(guide_id, current_user, db)
    step = db.query(GuideStep).filter(
        GuideStep.id == step_id, GuideStep.guide_id == guide_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    if data.title is not None:
        step.title = data.title
    if data.description is not None:
        step.description = data.description
    if data.script_text is not None:
        step.script_text = data.script_text
    if data.element_selector is not None:
        step.element_selector = data.element_selector

    db.commit()
    db.refresh(step)
    return step


@router.delete("/{step_id}", status_code=204)
def delete_step(
    guide_id: uuid.UUID,
    step_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = _verify_guide_access(guide_id, current_user, db)
    step = db.query(GuideStep).filter(
        GuideStep.id == step_id, GuideStep.guide_id == guide_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    deleted_number = step.step_number
    db.delete(step)

    # Re-number remaining steps
    remaining = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id,
        GuideStep.step_number > deleted_number,
    ).order_by(GuideStep.step_number).all()
    for s in remaining:
        s.step_number -= 1

    guide.total_steps = db.query(GuideStep).filter(GuideStep.guide_id == guide_id).count()
    db.commit()


@router.post("/{step_id}/regenerate-audio")
def regenerate_step_audio(
    guide_id: uuid.UUID,
    step_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_guide_access(guide_id, current_user, db)
    step = db.query(GuideStep).filter(
        GuideStep.id == step_id, GuideStep.guide_id == guide_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    if not step.script_text:
        raise HTTPException(status_code=400, detail="Step has no script text to narrate")

    # Queue audio regeneration via Celery
    from app.services.celery_worker import regenerate_step_audio_task
    task = regenerate_step_audio_task.delay(str(guide_id), str(step_id))

    return {"message": "Audio regeneration queued", "task_id": task.id}


@router.post("/{step_id}/regenerate-callouts")
def regenerate_step_callouts(
    guide_id: uuid.UUID,
    step_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verify_guide_access(guide_id, current_user, db)
    step = db.query(GuideStep).filter(
        GuideStep.id == step_id, GuideStep.guide_id == guide_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    # Queue callout regeneration
    from app.services.celery_worker import regenerate_step_callouts_task
    task = regenerate_step_callouts_task.delay(str(guide_id), str(step_id))

    return {"message": "Callout regeneration queued", "task_id": task.id}
