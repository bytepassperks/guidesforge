"""Admin panel routes - full CRUD for users, workspaces, guides, subscriptions, analytics."""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.database import (
    Guide,
    GuideAnalytics,
    GuideStep,
    SDKSession,
    Subscription,
    User,
    Workspace,
    WorkspaceMember,
    get_db,
)
from app.utils.auth import get_admin_user, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---- Dashboard / Stats ----

@router.get("/stats")
def admin_stats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get platform-wide stats for admin dashboard."""
    total_users = db.query(func.count(User.id)).scalar() or 0
    total_workspaces = db.query(func.count(Workspace.id)).scalar() or 0
    total_guides = db.query(func.count(Guide.id)).scalar() or 0
    total_subscriptions = db.query(func.count(Subscription.id)).filter(
        Subscription.status == "active"
    ).scalar() or 0

    # Users by plan
    plan_breakdown = db.query(
        User.plan, func.count(User.id)
    ).group_by(User.plan).all()

    # New users in last 7 / 30 days
    now = datetime.utcnow()
    new_users_7d = db.query(func.count(User.id)).filter(
        User.created_at >= now - timedelta(days=7)
    ).scalar() or 0
    new_users_30d = db.query(func.count(User.id)).filter(
        User.created_at >= now - timedelta(days=30)
    ).scalar() or 0

    # Guides by status
    status_breakdown = db.query(
        Guide.status, func.count(Guide.id)
    ).group_by(Guide.status).all()

    # Total views in last 30 days
    total_views_30d = db.query(func.count(GuideAnalytics.id)).filter(
        GuideAnalytics.created_at >= now - timedelta(days=30)
    ).scalar() or 0

    # Daily signups for last 30 days
    daily_signups = []
    for i in range(30):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(User.id)).filter(
            User.created_at >= day_start,
            User.created_at < day_end,
        ).scalar() or 0
        daily_signups.append({"date": day_start.strftime("%Y-%m-%d"), "count": count})
    daily_signups.reverse()

    # Revenue by provider
    revenue_breakdown = db.query(
        Subscription.provider, func.count(Subscription.id)
    ).filter(Subscription.status == "active").group_by(Subscription.provider).all()

    return {
        "total_users": total_users,
        "total_workspaces": total_workspaces,
        "total_guides": total_guides,
        "total_active_subscriptions": total_subscriptions,
        "new_users_7d": new_users_7d,
        "new_users_30d": new_users_30d,
        "total_views_30d": total_views_30d,
        "plan_breakdown": {plan or "free": count for plan, count in plan_breakdown},
        "status_breakdown": {status or "unknown": count for status, count in status_breakdown},
        "daily_signups": daily_signups,
        "revenue_breakdown": {provider or "none": count for provider, count in revenue_breakdown},
    }


# ---- Users CRUD ----

@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all users with pagination and filtering."""
    query = db.query(User)
    if search:
        query = query.filter(
            User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%")
        )
    if plan:
        query = query.filter(User.plan == plan)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "full_name": u.full_name,
                "plan": u.plan,
                "plan_currency": u.plan_currency,
                "is_admin": u.is_admin,
                "trial_ends_at": u.trial_ends_at.isoformat() if u.trial_ends_at else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "updated_at": u.updated_at.isoformat() if u.updated_at else None,
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/users/{user_id}")
def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get detailed user info including workspaces and subscriptions."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    memberships = db.query(WorkspaceMember).filter(
        WorkspaceMember.user_id == user_id
    ).all()

    workspaces = []
    for m in memberships:
        ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
        if ws:
            guide_count = db.query(func.count(Guide.id)).filter(
                Guide.workspace_id == ws.id
            ).scalar() or 0
            workspaces.append({
                "id": str(ws.id),
                "name": ws.name,
                "slug": ws.slug,
                "role": m.role,
                "guide_count": guide_count,
            })

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "plan_currency": user.plan_currency,
        "is_admin": user.is_admin,
        "voice_profile_url": user.voice_profile_url,
        "avatar_photo_url": user.avatar_photo_url,
        "trial_ends_at": user.trial_ends_at.isoformat() if user.trial_ends_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "workspaces": workspaces,
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: uuid.UUID,
    data: dict,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update any user field (plan, name, admin status, etc)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_fields = {"full_name", "plan", "plan_currency", "is_admin", "trial_ends_at"}
    for key, value in data.items():
        if key in allowed_fields:
            if key == "trial_ends_at" and value:
                value = datetime.fromisoformat(value)
            setattr(user, key, value)

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "is_admin": user.is_admin,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a user and all their data."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    # Delete workspace memberships
    db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).delete()
    # Delete owned workspaces (cascade will handle guides, steps, etc)
    owned_ws = db.query(Workspace).filter(Workspace.owner_id == user_id).all()
    for ws in owned_ws:
        db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == ws.id).delete()
        db.delete(ws)

    db.delete(user)
    db.commit()


@router.post("/users")
def create_user(
    data: dict,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Create a new user (admin-created)."""
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name", "")
    plan = data.get("plan", "free")
    is_admin = data.get("is_admin", False)

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        plan=plan,
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "plan": user.plan,
        "is_admin": user.is_admin,
    }


# ---- Workspaces CRUD ----

@router.get("/workspaces")
def list_workspaces(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all workspaces with stats."""
    query = db.query(Workspace)
    if search:
        query = query.filter(
            Workspace.name.ilike(f"%{search}%") | Workspace.slug.ilike(f"%{search}%")
        )

    total = query.count()
    workspaces = query.order_by(Workspace.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    items = []
    for ws in workspaces:
        owner = db.query(User).filter(User.id == ws.owner_id).first()
        member_count = db.query(func.count(WorkspaceMember.id)).filter(
            WorkspaceMember.workspace_id == ws.id
        ).scalar() or 0
        guide_count = db.query(func.count(Guide.id)).filter(
            Guide.workspace_id == ws.id
        ).scalar() or 0
        items.append({
            "id": str(ws.id),
            "name": ws.name,
            "slug": ws.slug,
            "owner_email": owner.email if owner else "N/A",
            "owner_name": owner.full_name if owner else "N/A",
            "brand_color": ws.brand_color,
            "custom_domain": ws.custom_domain,
            "member_count": member_count,
            "guide_count": guide_count,
            "plan_seats": ws.plan_seats,
            "sdk_mau_limit": ws.sdk_mau_limit,
            "created_at": ws.created_at.isoformat() if ws.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/workspaces/{workspace_id}")
def get_workspace(
    workspace_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get detailed workspace info."""
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    owner = db.query(User).filter(User.id == ws.owner_id).first()
    members = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == ws.id
    ).all()
    guides = db.query(Guide).filter(Guide.workspace_id == ws.id).all()
    subs = db.query(Subscription).filter(
        Subscription.workspace_id == ws.id
    ).all()

    return {
        "id": str(ws.id),
        "name": ws.name,
        "slug": ws.slug,
        "owner": {
            "id": str(owner.id) if owner else None,
            "email": owner.email if owner else None,
            "full_name": owner.full_name if owner else None,
        },
        "brand_color": ws.brand_color,
        "logo_url": ws.logo_url,
        "custom_domain": ws.custom_domain,
        "plan_seats": ws.plan_seats,
        "sdk_mau_limit": ws.sdk_mau_limit,
        "sdk_key": ws.sdk_key,
        "created_at": ws.created_at.isoformat() if ws.created_at else None,
        "members": [
            {
                "id": str(m.id),
                "user_id": str(m.user_id) if m.user_id else None,
                "role": m.role,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            for m in members
        ],
        "guides": [
            {
                "id": str(g.id),
                "title": g.title,
                "status": g.status,
                "view_count": g.view_count,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g in guides
        ],
        "subscriptions": [
            {
                "id": str(s.id),
                "plan": s.plan,
                "provider": s.provider,
                "status": s.status,
                "interval": s.interval,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in subs
        ],
    }


@router.delete("/workspaces/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a workspace and all its data."""
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).delete()
    db.delete(ws)
    db.commit()


# ---- Guides CRUD ----

@router.get("/guides")
def list_guides(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all guides across all workspaces."""
    query = db.query(Guide)
    if search:
        query = query.filter(Guide.title.ilike(f"%{search}%"))
    if status:
        query = query.filter(Guide.status == status)

    total = query.count()
    guides = query.order_by(Guide.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    items = []
    for g in guides:
        ws = db.query(Workspace).filter(Workspace.id == g.workspace_id).first()
        creator = db.query(User).filter(User.id == g.creator_id).first()
        step_count = db.query(func.count(GuideStep.id)).filter(
            GuideStep.guide_id == g.id
        ).scalar() or 0
        items.append({
            "id": str(g.id),
            "title": g.title,
            "status": g.status,
            "workspace_name": ws.name if ws else "N/A",
            "workspace_id": str(g.workspace_id),
            "creator_email": creator.email if creator else "N/A",
            "step_count": step_count,
            "view_count": g.view_count or 0,
            "is_public": g.is_public,
            "help_center_published": g.help_center_published,
            "staleness_score": g.staleness_score or 0,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "updated_at": g.updated_at.isoformat() if g.updated_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/guides/{guide_id}")
def get_guide(
    guide_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Get detailed guide info with steps."""
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    ws = db.query(Workspace).filter(Workspace.id == guide.workspace_id).first()
    creator = db.query(User).filter(User.id == guide.creator_id).first()
    steps = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id
    ).order_by(GuideStep.step_number).all()

    view_count_30d = db.query(func.count(GuideAnalytics.id)).filter(
        GuideAnalytics.guide_id == guide_id,
        GuideAnalytics.created_at >= datetime.utcnow() - timedelta(days=30),
    ).scalar() or 0

    return {
        "id": str(guide.id),
        "title": guide.title,
        "description": guide.description,
        "status": guide.status,
        "workspace": {"id": str(ws.id), "name": ws.name} if ws else None,
        "creator": {"id": str(creator.id), "email": creator.email} if creator else None,
        "is_public": guide.is_public,
        "help_center_published": guide.help_center_published,
        "staleness_score": guide.staleness_score,
        "view_count": guide.view_count,
        "view_count_30d": view_count_30d,
        "total_steps": guide.total_steps,
        "created_at": guide.created_at.isoformat() if guide.created_at else None,
        "updated_at": guide.updated_at.isoformat() if guide.updated_at else None,
        "steps": [
            {
                "id": str(s.id),
                "step_number": s.step_number,
                "title": s.title,
                "page_url": s.page_url,
                "screenshot_url": s.screenshot_url,
                "is_stale": s.is_stale,
            }
            for s in steps
        ],
    }


@router.put("/guides/{guide_id}")
def update_guide(
    guide_id: uuid.UUID,
    data: dict,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update guide fields (status, visibility, etc)."""
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    allowed_fields = {"title", "description", "status", "is_public", "help_center_published", "staleness_detection_enabled"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(guide, key, value)

    guide.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(guide)

    return {"id": str(guide.id), "title": guide.title, "status": guide.status}


@router.delete("/guides/{guide_id}", status_code=204)
def delete_guide(
    guide_id: uuid.UUID,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Delete a guide and all its steps/analytics."""
    guide = db.query(Guide).filter(Guide.id == guide_id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    db.delete(guide)
    db.commit()


# ---- Subscriptions ----

@router.get("/subscriptions")
def list_subscriptions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    provider: Optional[str] = Query(None),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """List all subscriptions."""
    query = db.query(Subscription)
    if status_filter:
        query = query.filter(Subscription.status == status_filter)
    if provider:
        query = query.filter(Subscription.provider == provider)

    total = query.count()
    subs = query.order_by(Subscription.created_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    items = []
    for s in subs:
        ws = db.query(Workspace).filter(Workspace.id == s.workspace_id).first()
        owner = None
        if ws:
            owner = db.query(User).filter(User.id == ws.owner_id).first()
        items.append({
            "id": str(s.id),
            "workspace_name": ws.name if ws else "N/A",
            "workspace_id": str(s.workspace_id),
            "owner_email": owner.email if owner else "N/A",
            "plan": s.plan,
            "currency": s.currency,
            "amount": s.amount,
            "interval": s.interval,
            "provider": s.provider,
            "provider_subscription_id": s.provider_subscription_id,
            "status": s.status,
            "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.put("/subscriptions/{subscription_id}")
def update_subscription(
    subscription_id: uuid.UUID,
    data: dict,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update subscription status/plan."""
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")

    allowed_fields = {"plan", "status", "interval"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(sub, key, value)

    db.commit()
    db.refresh(sub)

    # Also update user plan if status changed
    if "plan" in data or "status" in data:
        ws = db.query(Workspace).filter(Workspace.id == sub.workspace_id).first()
        if ws:
            owner = db.query(User).filter(User.id == ws.owner_id).first()
            if owner:
                if sub.status == "active":
                    owner.plan = sub.plan
                elif sub.status in ("cancelled", "expired"):
                    owner.plan = "free"
                db.commit()

    return {"id": str(sub.id), "plan": sub.plan, "status": sub.status}


# ---- Analytics ----

@router.get("/analytics")
def admin_analytics(
    days: int = Query(30, ge=1, le=365),
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Platform-wide analytics."""
    since = datetime.utcnow() - timedelta(days=days)

    total_views = db.query(func.count(GuideAnalytics.id)).filter(
        GuideAnalytics.created_at >= since
    ).scalar() or 0

    total_completions = db.query(func.count(GuideAnalytics.id)).filter(
        GuideAnalytics.completed.is_(True),
        GuideAnalytics.created_at >= since,
    ).scalar() or 0

    avg_watch_time = db.query(func.avg(GuideAnalytics.watch_duration_seconds)).filter(
        GuideAnalytics.created_at >= since
    ).scalar() or 0

    # Daily views
    daily_views = []
    for i in range(min(days, 30)):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(GuideAnalytics.id)).filter(
            GuideAnalytics.created_at >= day_start,
            GuideAnalytics.created_at < day_end,
        ).scalar() or 0
        daily_views.append({"date": day_start.strftime("%Y-%m-%d"), "views": count})
    daily_views.reverse()

    # Top guides by views
    top_guides = db.query(
        Guide.id, Guide.title, func.count(GuideAnalytics.id).label("views")
    ).outerjoin(GuideAnalytics).filter(
        GuideAnalytics.created_at >= since
    ).group_by(Guide.id, Guide.title).order_by(
        func.count(GuideAnalytics.id).desc()
    ).limit(10).all()

    # Source breakdown
    sources = db.query(
        GuideAnalytics.source, func.count(GuideAnalytics.id)
    ).filter(
        GuideAnalytics.created_at >= since
    ).group_by(GuideAnalytics.source).all()

    # SDK sessions
    total_sdk_sessions = db.query(func.count(SDKSession.id)).filter(
        SDKSession.created_at >= since
    ).scalar() or 0

    return {
        "total_views": total_views,
        "total_completions": total_completions,
        "completion_rate": round(total_completions / total_views * 100, 1) if total_views > 0 else 0,
        "avg_watch_time": round(float(avg_watch_time), 1),
        "total_sdk_sessions": total_sdk_sessions,
        "daily_views": daily_views,
        "top_guides": [
            {"id": str(g.id), "title": g.title, "views": g.views}
            for g in top_guides
        ],
        "sources": {src or "direct": count for src, count in sources},
    }


# ---- System Settings ----

@router.get("/settings")
def get_settings(
    admin: User = Depends(get_admin_user),
):
    """Get system configuration (non-sensitive)."""
    from app.config import settings

    return {
        "environment": settings.ENVIRONMENT,
        "frontend_url": settings.FRONTEND_URL,
        "cors_origins": settings.CORS_ORIGINS,
        "mailgun_domain": settings.MAILGUN_DOMAIN,
        "s3_endpoint": settings.S3_ENDPOINT,
        "s3_bucket": settings.S3_BUCKET,
        "dodo_payments_configured": bool(settings.DODO_PAYMENTS_API_KEY),
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
        "razorpay_configured": bool(settings.RAZORPAY_KEY_ID),
        "easebuzz_configured": bool(settings.EASEBUZZ_KEY),
        "openai_configured": bool(settings.OPENAI_API_KEY),
        "mailgun_configured": bool(settings.MAILGUN_API_KEY),
        "customerio_configured": bool(settings.CUSTOMERIO_SITE_ID),
        "modal_configured": bool(settings.MODAL_TOKEN_ID),
        "s3_configured": bool(settings.S3_ACCESS_KEY),
    }


# ---- Admin Login (separate endpoint for admin-specific login) ----

@router.post("/login")
def admin_login(
    data: dict,
    db: Session = Depends(get_db),
):
    """Admin login - returns tokens only if user is admin."""
    from app.utils.auth import create_access_token, create_refresh_token, verify_password

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
        },
    }


# ---- Make user admin (bootstrap) ----

@router.post("/bootstrap")
def bootstrap_admin(
    data: dict,
    db: Session = Depends(get_db),
):
    """One-time bootstrap to set the first admin user.

    Only works if there are no admin users in the system.
    Requires valid email and password.
    """
    existing_admin = db.query(User).filter(User.is_admin.is_(True)).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin already exists. Use /api/admin/login.")

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    from app.utils.auth import verify_password

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user.is_admin = True
    db.commit()

    from app.utils.auth import create_access_token, create_refresh_token

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return {
        "message": "Admin access granted",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": True,
        },
    }
