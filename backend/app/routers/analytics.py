"""Analytics routes."""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.database import Guide, GuideAnalytics, GuideStep, User, Workspace, WorkspaceMember, get_db
from app.schemas.analytics import AnalyticsOverview, GuideAnalyticsDetail, StalenessReport
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def get_overview(
    workspace_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if workspace_id:
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    else:
        ws = db.query(Workspace).filter(Workspace.owner_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == ws.id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    since = datetime.utcnow() - timedelta(days=days)
    guide_ids = [g.id for g in db.query(Guide.id).filter(Guide.workspace_id == ws.id).all()]

    total_guides = len(guide_ids)
    total_views = db.query(func.count(GuideAnalytics.id)).filter(
        GuideAnalytics.guide_id.in_(guide_ids),
        GuideAnalytics.created_at >= since,
    ).scalar() or 0

    total_completions = db.query(func.count(GuideAnalytics.id)).filter(
        GuideAnalytics.guide_id.in_(guide_ids),
        GuideAnalytics.completed.is_(True),
        GuideAnalytics.created_at >= since,
    ).scalar() or 0

    avg_watch_time = db.query(func.avg(GuideAnalytics.watch_duration_seconds)).filter(
        GuideAnalytics.guide_id.in_(guide_ids),
        GuideAnalytics.created_at >= since,
    ).scalar() or 0

    stale_guides = db.query(func.count(Guide.id)).filter(
        Guide.workspace_id == ws.id,
        Guide.status == "stale",
    ).scalar() or 0

    # Daily views for chart
    daily_views = []
    for i in range(min(days, 30)):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(GuideAnalytics.id)).filter(
            GuideAnalytics.guide_id.in_(guide_ids),
            GuideAnalytics.created_at >= day_start,
            GuideAnalytics.created_at < day_end,
        ).scalar() or 0
        daily_views.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "views": count,
        })

    daily_views.reverse()

    # Top guides
    top_guides = db.query(
        Guide.id, Guide.title, func.count(GuideAnalytics.id).label("views")
    ).outerjoin(GuideAnalytics).filter(
        Guide.workspace_id == ws.id,
        GuideAnalytics.created_at >= since,
    ).group_by(Guide.id, Guide.title).order_by(
        func.count(GuideAnalytics.id).desc()
    ).limit(5).all()

    return AnalyticsOverview(
        total_guides=total_guides,
        total_views=total_views,
        total_completions=total_completions,
        completion_rate=round(total_completions / total_views * 100, 1) if total_views > 0 else 0,
        avg_watch_time=round(float(avg_watch_time), 1),
        stale_guides=stale_guides,
        daily_views=daily_views,
        top_guides=[
            {"id": str(g.id), "title": g.title, "views": g.views}
            for g in top_guides
        ],
    )


@router.get("/guides/{guide_id}", response_model=GuideAnalyticsDetail)
def get_guide_analytics(
    guide_id: uuid.UUID,
    days: int = Query(30, ge=1, le=365),
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

    since = datetime.utcnow() - timedelta(days=days)

    views = db.query(GuideAnalytics).filter(
        GuideAnalytics.guide_id == guide_id,
        GuideAnalytics.created_at >= since,
    ).all()

    total_views = len(views)
    completions = sum(1 for v in views if v.completed)
    avg_duration = sum(v.watch_duration_seconds or 0 for v in views) / total_views if total_views else 0

    # Step drop-off analysis
    step_completions = {}
    for v in views:
        steps_done = v.steps_completed or 0
        for i in range(1, steps_done + 1):
            step_completions[i] = step_completions.get(i, 0) + 1

    steps = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id
    ).order_by(GuideStep.step_number).all()

    step_dropoff = []
    for step in steps:
        reached = step_completions.get(step.step_number, 0)
        step_dropoff.append({
            "step_number": step.step_number,
            "title": step.title or f"Step {step.step_number}",
            "viewers_reached": reached,
            "percentage": round(reached / total_views * 100, 1) if total_views > 0 else 0,
        })

    # Source breakdown
    sources = {}
    for v in views:
        src = v.source or "direct"
        sources[src] = sources.get(src, 0) + 1

    return GuideAnalyticsDetail(
        guide_id=str(guide_id),
        guide_title=guide.title,
        total_views=total_views,
        completions=completions,
        completion_rate=round(completions / total_views * 100, 1) if total_views > 0 else 0,
        avg_watch_duration=round(avg_duration, 1),
        step_dropoff=step_dropoff,
        sources=[{"source": k, "count": v} for k, v in sources.items()],
    )


@router.get("/staleness", response_model=StalenessReport)
def get_staleness_report(
    workspace_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if workspace_id:
        ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    else:
        ws = db.query(Workspace).filter(Workspace.owner_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    guides = db.query(Guide).filter(
        Guide.workspace_id == ws.id,
        Guide.staleness_detection_enabled.is_(True),
    ).all()

    stale_guides = []
    healthy_guides = []
    for guide in guides:
        info = {
            "id": str(guide.id),
            "title": guide.title,
            "staleness_score": guide.staleness_score or 0,
            "last_check": guide.last_staleness_check.isoformat() if guide.last_staleness_check else None,
            "status": guide.status,
        }
        if guide.status == "stale" or (guide.staleness_score and guide.staleness_score > 0.15):
            stale_guides.append(info)
        else:
            healthy_guides.append(info)

    return StalenessReport(
        total_monitored=len(guides),
        stale_count=len(stale_guides),
        healthy_count=len(healthy_guides),
        stale_guides=stale_guides,
        healthy_guides=healthy_guides,
    )
