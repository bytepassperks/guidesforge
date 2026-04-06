"""Public help center routes - no auth required."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models.database import get_db, Workspace, Guide, GuideStep, GuideAnalytics

router = APIRouter(prefix="/api/help", tags=["help-center"])


@router.get("/{workspace_slug}")
def get_help_center(
    workspace_slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Help center not found")

    query = db.query(Guide).filter(
        Guide.workspace_id == workspace.id,
        Guide.help_center_published == True,
        Guide.is_public == True,
    )

    if search:
        # Try semantic search first
        try:
            from sentence_transformers import SentenceTransformer
            model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
            query_embedding = model.encode(search).tolist()
            guides = db.query(Guide).filter(
                Guide.workspace_id == workspace.id,
                Guide.help_center_published == True,
                Guide.is_public == True,
                Guide.embedding.isnot(None),
            ).order_by(
                Guide.embedding.cosine_distance(query_embedding)
            ).limit(per_page).all()
        except Exception:
            guides = query.filter(
                Guide.title.ilike(f"%{search}%")
            ).order_by(Guide.created_at.desc()).offset(
                (page - 1) * per_page
            ).limit(per_page).all()
    else:
        guides = query.order_by(Guide.created_at.desc()).offset(
            (page - 1) * per_page
        ).limit(per_page).all()

    total = query.count()

    return {
        "workspace": {
            "name": workspace.name,
            "slug": workspace.slug,
            "brand_color": workspace.brand_color,
            "logo_url": workspace.logo_url,
        },
        "guides": [
            {
                "id": str(g.id),
                "title": g.title,
                "description": g.description,
                "thumbnail_url": g.thumbnail_url,
                "total_steps": g.total_steps,
                "total_duration_seconds": g.total_duration_seconds,
                "view_count": g.view_count or 0,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g in guides
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{workspace_slug}/guides/{guide_id}")
def get_help_guide(
    workspace_slug: str,
    guide_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Help center not found")

    guide = db.query(Guide).filter(
        Guide.id == guide_id,
        Guide.workspace_id == workspace.id,
        Guide.help_center_published == True,
        Guide.is_public == True,
    ).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Guide not found")

    steps = db.query(GuideStep).filter(
        GuideStep.guide_id == guide_id
    ).order_by(GuideStep.step_number).all()

    # Track view
    guide.view_count = (guide.view_count or 0) + 1
    db.commit()

    return {
        "workspace": {
            "name": workspace.name,
            "slug": workspace.slug,
            "brand_color": workspace.brand_color,
            "logo_url": workspace.logo_url,
        },
        "guide": {
            "id": str(guide.id),
            "title": guide.title,
            "description": guide.description,
            "video_url": guide.video_url,
            "thumbnail_url": guide.thumbnail_url,
            "total_steps": guide.total_steps,
            "total_duration_seconds": guide.total_duration_seconds,
            "view_count": guide.view_count,
            "created_at": guide.created_at.isoformat() if guide.created_at else None,
        },
        "steps": [
            {
                "id": str(s.id),
                "step_number": s.step_number,
                "title": s.title,
                "description": s.description,
                "screenshot_url": s.annotated_screenshot_url or s.screenshot_url,
                "audio_url": s.audio_url,
                "page_url": s.page_url,
            }
            for s in steps
        ],
    }


@router.get("/{workspace_slug}/search")
def search_help_center(
    workspace_slug: str,
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.slug == workspace_slug).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Help center not found")

    # Semantic search
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        query_embedding = model.encode(q).tolist()

        guides = db.query(Guide).filter(
            Guide.workspace_id == workspace.id,
            Guide.help_center_published == True,
            Guide.is_public == True,
            Guide.embedding.isnot(None),
        ).order_by(
            Guide.embedding.cosine_distance(query_embedding)
        ).limit(limit).all()
    except Exception:
        # Fallback to text search
        guides = db.query(Guide).filter(
            Guide.workspace_id == workspace.id,
            Guide.help_center_published == True,
            Guide.is_public == True,
            Guide.title.ilike(f"%{q}%"),
        ).limit(limit).all()

    return {
        "query": q,
        "results": [
            {
                "id": str(g.id),
                "title": g.title,
                "description": g.description,
                "thumbnail_url": g.thumbnail_url,
                "total_steps": g.total_steps,
            }
            for g in guides
        ],
    }
