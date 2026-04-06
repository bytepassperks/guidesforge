from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class GuideStepCreate(BaseModel):
    step_number: int
    page_url: str
    screenshot_data: str  # base64 encoded
    element_selector: Optional[str] = None
    click_x: Optional[int] = None
    click_y: Optional[int] = None


class GuideCreate(BaseModel):
    title: str
    description: Optional[str] = None
    workspace_id: Optional[UUID] = None
    staleness_detection_enabled: Optional[bool] = None
    steps: Optional[List[GuideStepCreate]] = None


class GuideUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    staleness_detection_enabled: Optional[bool] = None
    is_public: Optional[bool] = None
    help_center_published: Optional[bool] = None


class GuideStepUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    script_text: Optional[str] = None
    element_selector: Optional[str] = None


class GuideStepResponse(BaseModel):
    id: UUID
    guide_id: UUID
    step_number: int
    title: Optional[str] = None
    description: Optional[str] = None
    script_text: Optional[str] = None
    page_url: str
    element_selector: Optional[str] = None
    click_x: Optional[int] = None
    click_y: Optional[int] = None
    screenshot_url: str
    annotated_screenshot_url: Optional[str] = None
    audio_url: Optional[str] = None
    pixel_diff_percentage: float = 0.0
    is_stale: bool = False
    diff_image_url: Optional[str] = None
    detected_elements: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class GuideResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    creator_id: UUID
    title: str
    description: Optional[str] = None
    status: str
    staleness_score: float = 0.0
    last_staleness_check: Optional[datetime] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    total_steps: int = 0
    total_duration_seconds: int = 0
    view_count: int = 0
    is_public: bool = False
    help_center_published: bool = False
    created_at: datetime
    updated_at: datetime
    steps: Optional[List[GuideStepResponse]] = None

    class Config:
        from_attributes = True


class GuideListResponse(BaseModel):
    guides: List[GuideResponse]
    total: int
    page: int
    per_page: int


class EmbedCodeResponse(BaseModel):
    iframe: str
    sdk: str
    react: str


class TrackViewRequest(BaseModel):
    viewer_ip: Optional[str] = None
    viewer_user_agent: Optional[str] = None
    steps_completed: int = 0
    total_steps: int = 0
    watch_duration_seconds: int = 0
    completed: bool = False
    source: Optional[str] = None
    referrer: Optional[str] = None
