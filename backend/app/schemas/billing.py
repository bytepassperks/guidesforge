from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class StripeCheckoutRequest(BaseModel):
    workspace_id: UUID
    plan: str  # starter, pro, business
    interval: str  # monthly, annual


class RazorpayCheckoutRequest(BaseModel):
    workspace_id: UUID
    plan: str
    interval: str


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    provider: Optional[str] = None
    current_period_end: Optional[datetime] = None
    is_trial: bool = False

    class Config:
        from_attributes = True


class CancelSubscriptionRequest(BaseModel):
    workspace_id: UUID
    reason: Optional[str] = None
