from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from uuid import UUID


class ProcessGuideRequest(BaseModel):
    guide_id: UUID
    steps: List[Dict[str, Any]] = []


class CheckStalenessRequest(BaseModel):
    guide_id: UUID


class JobStatusResponse(BaseModel):
    task_id: str
    status: str  # PENDING, STARTED, PROCESSING, SUCCESS, FAILURE
    result: Optional[Any] = None
