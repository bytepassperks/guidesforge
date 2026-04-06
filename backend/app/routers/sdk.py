"""SDK routes - init, event tracking, semantic search."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.database import Guide, GuideAnalytics, GuideStep, SDKSession, Workspace, get_db
from app.schemas.sdk import (
    SDKEventRequest,
    SDKInitRequest,
    SDKInitResponse,
    SDKSearchRequest,
    SDKSearchResult,
)

router = APIRouter(prefix="/api/sdk", tags=["sdk"])


def _verify_sdk_key(api_key: str, db: Session) -> Workspace:
    workspace = db.query(Workspace).filter(Workspace.sdk_key == api_key).first()
    if not workspace:
        raise HTTPException(status_code=401, detail="Invalid SDK key")
    return workspace


@router.post("/init", response_model=SDKInitResponse)
def sdk_init(data: SDKInitRequest, db: Session = Depends(get_db)):
    workspace = _verify_sdk_key(data.api_key, db)

    # Check MAU limit
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    mau_count = db.query(SDKSession).filter(
        SDKSession.workspace_id == workspace.id,
        SDKSession.created_at >= month_start,
    ).distinct(SDKSession.user_identifier).count()

    if workspace.sdk_mau_limit and mau_count >= workspace.sdk_mau_limit:
        raise HTTPException(status_code=429, detail="SDK MAU limit reached")

    # Create or get session
    session = SDKSession(
        workspace_id=workspace.id,
        session_token=uuid.uuid4().hex,
        user_identifier=data.user_identifier,
        page_url=data.page_url,
    )
    db.add(session)
    db.commit()

    # Get guides matching the current page URL
    matching_guides = []
    if data.page_url:
        guides = db.query(Guide).filter(
            Guide.workspace_id == workspace.id,
            Guide.is_public.is_(True),
            Guide.status == "ready",
        ).all()

        for guide in guides:
            steps = db.query(GuideStep).filter(
                GuideStep.guide_id == guide.id
            ).order_by(GuideStep.step_number).all()

            # Check if any step matches the current page
            for step in steps:
                if step.page_url and data.page_url and _url_matches(step.page_url, data.page_url):
                    matching_guides.append({
                        "id": str(guide.id),
                        "title": guide.title,
                        "description": guide.description,
                        "total_steps": guide.total_steps,
                        "thumbnail_url": guide.thumbnail_url,
                    })
                    break

    return SDKInitResponse(
        session_token=session.session_token,
        workspace_name=workspace.name,
        brand_color=workspace.brand_color or "#6366F1",
        guides=matching_guides,
    )


@router.post("/event")
def sdk_event(data: SDKEventRequest, db: Session = Depends(get_db)):
    session = db.query(SDKSession).filter(
        SDKSession.session_token == data.session_token
    ).first()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    if data.event_type == "guide_view":
        guide = db.query(Guide).filter(Guide.id == data.guide_id).first()
        if guide:
            guide.view_count = (guide.view_count or 0) + 1
            analytics = GuideAnalytics(
                guide_id=guide.id,
                source="sdk",
                steps_completed=data.steps_completed or 0,
                total_steps=guide.total_steps or 0,
                completed=data.completed or False,
                watch_duration_seconds=data.watch_duration_seconds or 0,
            )
            db.add(analytics)

    elif data.event_type == "guide_complete":
        guide = db.query(Guide).filter(Guide.id == data.guide_id).first()
        if guide:
            analytics = GuideAnalytics(
                guide_id=guide.id,
                source="sdk",
                steps_completed=guide.total_steps or 0,
                total_steps=guide.total_steps or 0,
                completed=True,
                watch_duration_seconds=data.watch_duration_seconds or 0,
            )
            db.add(analytics)

    elif data.event_type == "step_view":
        pass  # Tracked client-side

    # Update session
    if data.guide_id:
        shown = session.guides_shown or []
        guide_str = str(data.guide_id)
        if guide_str not in shown:
            shown.append(guide_str)
            session.guides_shown = shown

    db.commit()
    return {"status": "ok"}


@router.post("/search", response_model=list[SDKSearchResult])
def sdk_search(data: SDKSearchRequest, db: Session = Depends(get_db)):
    workspace = _verify_sdk_key(data.api_key, db)

    # Try semantic search with pgvector
    try:
        from app.services.embedding_service import get_embedding
        query_embedding = get_embedding(data.query)
        if not query_embedding:
            raise ValueError("Empty embedding")

        # Cosine similarity search
        guides = db.query(Guide).filter(
            Guide.workspace_id == workspace.id,
            Guide.is_public.is_(True),
            Guide.status == "ready",
            Guide.embedding.isnot(None),
        ).order_by(
            Guide.embedding.cosine_distance(query_embedding)
        ).limit(data.limit or 5).all()

        return [
            SDKSearchResult(
                id=str(g.id),
                title=g.title,
                description=g.description,
                thumbnail_url=g.thumbnail_url,
                total_steps=g.total_steps,
                relevance_score=1.0,  # Would calculate from distance
            )
            for g in guides
        ]
    except Exception:
        # Fallback to text search
        guides = db.query(Guide).filter(
            Guide.workspace_id == workspace.id,
            Guide.is_public.is_(True),
            Guide.status == "ready",
            Guide.title.ilike(f"%{data.query}%"),
        ).limit(data.limit or 5).all()

        return [
            SDKSearchResult(
                id=str(g.id),
                title=g.title,
                description=g.description,
                thumbnail_url=g.thumbnail_url,
                total_steps=g.total_steps,
                relevance_score=0.5,
            )
            for g in guides
        ]


def _url_matches(stored_url: str, current_url: str) -> bool:
    """Check if a stored URL pattern matches the current page URL."""
    from urllib.parse import urlparse
    stored = urlparse(stored_url)
    current = urlparse(current_url)

    if stored.netloc and current.netloc and stored.netloc != current.netloc:
        return False

    stored_path = stored.path.rstrip("/")
    current_path = current.path.rstrip("/")

    if stored_path == current_path:
        return True

    # Wildcard matching
    if "*" in stored_path:
        import fnmatch
        return fnmatch.fnmatch(current_path, stored_path)

    return False
