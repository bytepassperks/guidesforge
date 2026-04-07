"""Guide CRUD routes."""
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.database import Guide, GuideAnalytics, GuideStep, User, Workspace, WorkspaceMember, get_db
from app.schemas.guides import (
    EmbedCodeResponse,
    GuideCreate,
    GuideListResponse,
    GuideResponse,
    GuideStepResponse,
    GuideUpdate,
    TrackViewRequest,
)
from app.services.plan_limits import check_guide_limit, get_plan_limits
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/guides", tags=["guides"])


def _get_user_workspace(user: User, db: Session, workspace_id: Optional[str] = None) -> Workspace:
    if workspace_id:
        ws = db.query(Workspace).join(WorkspaceMember).filter(
            Workspace.id == workspace_id,
            WorkspaceMember.user_id == user.id,
        ).first()
    else:
        ws = db.query(Workspace).filter(Workspace.owner_id == user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.get("", response_model=GuideListResponse)
def list_guides(
    workspace_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = _get_user_workspace(current_user, db, workspace_id)

    query = db.query(Guide).filter(Guide.workspace_id == ws.id)
    if search:
        query = query.filter(Guide.title.ilike(f"%{search}%"))
    if status_filter:
        query = query.filter(Guide.status == status_filter)

    total = query.count()
    guides = query.order_by(Guide.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return GuideListResponse(
        guides=[GuideResponse.model_validate(g) for g in guides],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.post("", response_model=GuideResponse, status_code=201)
def create_guide(
    data: GuideCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ws = _get_user_workspace(current_user, db, str(data.workspace_id) if data.workspace_id else None)

    # Check plan limits
    current_count = db.query(Guide).filter(Guide.workspace_id == ws.id).count()
    plan = current_user.plan or "free"
    if not check_guide_limit(plan, current_count):
        limits = get_plan_limits(plan)
        raise HTTPException(
            status_code=403,
            detail=f"Guide limit reached ({limits['total_guides']}). Upgrade your plan.",
        )

    guide = Guide(
        workspace_id=ws.id,
        creator_id=current_user.id,
        title=data.title,
        description=data.description,
        status="processing",
        staleness_detection_enabled=data.staleness_detection_enabled if data.staleness_detection_enabled is not None else True,
    )
    db.add(guide)
    db.commit()
    db.refresh(guide)

    return guide


@router.get("/{guide_id}", response_model=GuideResponse)
def get_guide(
    guide_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    # Verify access
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    return guide


@router.put("/{guide_id}", response_model=GuideResponse)
def update_guide(
    guide_id: uuid.UUID,
    data: GuideUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    if data.title is not None:
        guide.title = data.title
    if data.description is not None:
        guide.description = data.description
    if data.status is not None:
        guide.status = data.status
    if data.staleness_detection_enabled is not None:
        guide.staleness_detection_enabled = data.staleness_detection_enabled
    if data.is_public is not None:
        guide.is_public = data.is_public
    if data.help_center_published is not None:
        guide.help_center_published = data.help_center_published

    guide.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(guide)
    return guide


@router.delete("/{guide_id}", status_code=204)
def delete_guide(
    guide_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can delete guides")

    # Delete steps first
    db.query(GuideStep).filter(GuideStep.guide_id == guide_id).delete()
    db.query(GuideAnalytics).filter(GuideAnalytics.guide_id == guide_id).delete()
    db.delete(guide)
    db.commit()


@router.post("/{guide_id}/publish")
def publish_guide(
    guide_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == guide.workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    guide.is_public = True
    guide.help_center_published = True
    guide.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Guide published to help center", "guide_id": str(guide_id)}


@router.get("/{guide_id}/embed-code", response_model=EmbedCodeResponse)
def get_embed_code(
    guide_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    ws = db.query(Workspace).filter(Workspace.id == guide.workspace_id).first()

    # iframe embed
    iframe_code = f'<iframe src="https://guidesforge.org/embed/{guide_id}" width="100%" height="600" frameborder="0" allow="fullscreen"></iframe>'

    # SDK embed
    sdk_code = f"""<script src="https://cdn.guidesforge.org/sdk.js"></script>
<script>
  GuidesForge.init({{
    apiKey: '{ws.sdk_key if ws else "YOUR_SDK_KEY"}',
    guideId: '{guide_id}'
  }});
</script>"""

    # React component
    react_code = f"""import {{ GuidesForgeEmbed }} from '@guidesforge/react';

<GuidesForgeEmbed guideId="{guide_id}" apiKey="{ws.sdk_key if ws else 'YOUR_SDK_KEY'}" />"""

    return EmbedCodeResponse(
        iframe=iframe_code,
        sdk=sdk_code,
        react=react_code,
    )


@router.post("/{guide_id}/track-view")
def track_view(
    guide_id: uuid.UUID,
    data: TrackViewRequest,
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    analytics = GuideAnalytics(
        guide_id=guide_id,
        viewer_ip=data.viewer_ip,
        viewer_user_agent=data.viewer_user_agent,
        steps_completed=data.steps_completed or 0,
        total_steps=guide.total_steps or 0,
        watch_duration_seconds=data.watch_duration_seconds or 0,
        completed=data.completed or False,
        source=data.source or "direct",
        referrer=data.referrer,
    )
    db.add(analytics)

    # Increment view count
    guide.view_count = (guide.view_count or 0) + 1
    db.commit()

    return {"message": "View tracked"}


@router.get("/{guide_id}/steps", response_model=list[GuideStepResponse])
def get_guide_steps(
    guide_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    steps = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id
    ).order_by(GuideStep.step_number).all()

    return steps
