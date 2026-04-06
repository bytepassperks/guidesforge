from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


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


class EasebuzzCheckoutRequest(BaseModel):
    workspace_id: UUID
    plan: str  # starter, pro, business
    interval: str  # monthly, yearly
    currency: str = "INR"  # INR, USD, EUR, GBP, etc.


class EasebuzzCallbackRequest(BaseModel):
    """Easebuzz sends these fields in success/failure callback."""
    txnid: str
    status: str
    amount: str
    productinfo: str
    firstname: str
    email: str
    key: str
    hash: str
    udf1: str = ""  # workspace_id
    udf2: str = ""  # plan
    udf3: str = ""  # interval
    udf4: str = ""
    udf5: str = ""
    easepayid: str = ""
    mode: str = ""
    error_Message: Optional[str] = None


class CancelSubscriptionRequest(BaseModel):
    workspace_id: UUID
    reason: Optional[str] = None
