from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class ProcessGuideRequest(BaseModel):
    guide_id: UUID
    steps: List[Dict[str, Any]] = []


class UploadRecordingRequest(BaseModel):
    """Request from Chrome extension - creates guide and starts processing."""
    title: str = "Untitled Guide"
    steps: List[Dict[str, Any]] = []
    rrweb_events: List[Dict[str, Any]] = []
    duration_ms: Optional[int] = None


class CheckStalenessRequest(BaseModel):
    guide_id: UUID


class JobStatusResponse(BaseModel):
    task_id: str
    status: str  # PENDING, STARTED, PROCESSING, SUCCESS, FAILURE
    result: Optional[Any] = None
