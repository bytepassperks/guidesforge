from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class SDKInitRequest(BaseModel):
    api_key: str
    user_identifier: Optional[str] = None
    page_url: Optional[str] = None


class SDKInitResponse(BaseModel):
    session_token: str
    workspace_name: str
    brand_color: str = "#6366F1"
    guides: List[Dict[str, Any]] = []


class SDKEventRequest(BaseModel):
    session_token: str
    event_type: str  # guide_view, guide_complete, step_view
    guide_id: Optional[UUID] = None
    steps_completed: Optional[int] = None
    completed: Optional[bool] = None
    watch_duration_seconds: Optional[int] = None


class SDKSearchRequest(BaseModel):
    api_key: str
    query: str
    limit: Optional[int] = 5


class SDKSearchResult(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    total_steps: Optional[int] = None
    relevance_score: float = 0.0
