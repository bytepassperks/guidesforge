from typing import Any, Dict, List

from pydantic import BaseModel


class AnalyticsOverview(BaseModel):
    total_guides: int = 0
    total_views: int = 0
    total_completions: int = 0
    completion_rate: float = 0.0
    avg_watch_time: float = 0.0
    stale_guides: int = 0
    daily_views: List[Dict[str, Any]] = []
    top_guides: List[Dict[str, Any]] = []


class GuideAnalyticsDetail(BaseModel):
    guide_id: str
    guide_title: str
    total_views: int = 0
    completions: int = 0
    completion_rate: float = 0.0
    avg_watch_duration: float = 0.0
    step_dropoff: List[Dict[str, Any]] = []
    sources: List[Dict[str, Any]] = []


class StalenessReport(BaseModel):
    total_monitored: int = 0
    stale_count: int = 0
    healthy_count: int = 0
    stale_guides: List[Dict[str, Any]] = []
    healthy_guides: List[Dict[str, Any]] = []
