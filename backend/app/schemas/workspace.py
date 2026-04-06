from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class WorkspaceCreate(BaseModel):
    name: str
    slug: Optional[str] = None


class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    custom_domain: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    slug: str
    brand_color: Optional[str] = None
    logo_url: Optional[str] = None
    custom_domain: Optional[str] = None
    plan_seats: int = 1
    sdk_mau_limit: int = 0
    sdk_key: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MemberInvite(BaseModel):
    email: EmailStr
    role: str = "member"


class WorkspaceMemberResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    user_id: UUID
    role: str
    invited_at: datetime
    joined_at: Optional[datetime] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class SDKKeyResponse(BaseModel):
    sdk_key: str
    workspace_id: UUID
