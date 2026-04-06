"""Workspace management routes."""
import secrets
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.database import User, Workspace, WorkspaceMember, get_db
from app.schemas.workspace import (
    MemberInvite,
    SDKKeyResponse,
    WorkspaceCreate,
    WorkspaceMemberResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.services.email_service import send_invitation_email
from app.services.plan_limits import check_seat_limit
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspaces = db.query(Workspace).join(WorkspaceMember).filter(
        WorkspaceMember.user_id == current_user.id
    ).all()
    return workspaces


@router.post("", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    data: WorkspaceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    slug = data.slug or data.name.lower().replace(" ", "-").replace("_", "-")
    # Ensure uniqueness
    base_slug = slug
    counter = 1
    while db.query(Workspace).filter(Workspace.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    workspace = Workspace(
        owner_id=current_user.id,
        name=data.name,
        slug=slug,
        brand_color=data.brand_color or "#6366F1",
        sdk_key=secrets.token_hex(32),
    )
    db.add(workspace)
    db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=current_user.id,
        role="owner",
        joined_at=datetime.utcnow(),
    )
    db.add(member)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    return workspace


@router.put("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: uuid.UUID,
    data: WorkspaceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can update workspace")

    if data.name is not None:
        workspace.name = data.name
    if data.brand_color is not None:
        workspace.brand_color = data.brand_color
    if data.logo_url is not None:
        workspace.logo_url = data.logo_url
    if data.custom_domain is not None:
        workspace.custom_domain = data.custom_domain

    db.commit()
    db.refresh(workspace)
    return workspace


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner can delete a workspace")

    db.query(WorkspaceMember).filter(WorkspaceMember.workspace_id == workspace_id).delete()
    db.delete(workspace)
    db.commit()


@router.post("/{workspace_id}/invite")
def invite_member(
    workspace_id: uuid.UUID,
    data: MemberInvite,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can invite members")

    # Check seat limit
    current_count = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id
    ).count()
    plan = current_user.plan or "free"
    if not check_seat_limit(plan, current_count):
        raise HTTPException(status_code=403, detail="Seat limit reached. Upgrade your plan.")

    # Check if user exists
    invited_user = db.query(User).filter(User.email == data.email).first()

    if invited_user:
        # Check if already a member
        existing = db.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == invited_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="User is already a member")

        new_member = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=invited_user.id,
            role=data.role or "editor",
            invited_at=datetime.utcnow(),
            joined_at=datetime.utcnow(),
        )
        db.add(new_member)
    else:
        # Create pending invitation
        new_member = WorkspaceMember(
            workspace_id=workspace_id,
            role=data.role or "editor",
            invited_at=datetime.utcnow(),
        )
        db.add(new_member)

    db.commit()

    # Send invitation email
    invite_link = f"{settings.FRONTEND_URL}/invite/{workspace_id}"
    try:
        send_invitation_email(
            to=data.email,
            workspace_name=workspace.name,
            inviter_name=current_user.full_name or current_user.email,
            invite_link=invite_link,
        )
    except Exception:
        pass

    return {"message": f"Invitation sent to {data.email}"}


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberResponse])
def list_members(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied")

    members = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id
    ).all()
    return members


@router.delete("/{workspace_id}/members/{member_id}", status_code=204)
def remove_member(
    workspace_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    admin_member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not admin_member:
        raise HTTPException(status_code=403, detail="Only owners/admins can remove members")

    target = db.query(WorkspaceMember).filter(
        WorkspaceMember.id == member_id,
        WorkspaceMember.workspace_id == workspace_id,
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")

    if target.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove workspace owner")

    db.delete(target)
    db.commit()


@router.post("/{workspace_id}/sdk-key", response_model=SDKKeyResponse)
def regenerate_sdk_key(
    workspace_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    member = db.query(WorkspaceMember).filter(
        WorkspaceMember.workspace_id == workspace_id,
        WorkspaceMember.user_id == current_user.id,
        WorkspaceMember.role.in_(["owner", "admin"]),
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Only owners/admins can regenerate SDK key")

    workspace.sdk_key = secrets.token_hex(32)
    db.commit()

    return SDKKeyResponse(sdk_key=workspace.sdk_key)
