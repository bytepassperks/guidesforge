"""Authentication routes - register, login, JWT tokens, profile."""
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models.database import User, Workspace, WorkspaceMember, get_db
from app.schemas.auth import (
    TokenRefresh,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.services.email_service import send_welcome_email
from app.utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.utils.s3 import upload_voice_profile

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/forgot-password")
def forgot_password(data: dict, db: Session = Depends(get_db)):
    """Request a password reset link via email."""
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    user = db.query(User).filter(User.email == email).first()
    # Always return success to prevent email enumeration
    if user:
        try:
            from app.services.email_service import send_password_reset_email
            reset_token = create_access_token({"sub": str(user.id), "purpose": "reset"}, expires_delta=timedelta(hours=1))
            send_password_reset_email(user.email, reset_token)
        except Exception:
            pass

    return {"message": "If an account with that email exists, we've sent a password reset link."}


@router.post("/reset-password")
def reset_password(data: dict, db: Session = Depends(get_db)):
    """Reset password using a token from the forgot-password email."""
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        raise HTTPException(status_code=400, detail="Token and new password required")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    payload = decode_token(token)
    if payload.get("purpose") != "reset":
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(new_password)
    user.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Password reset successfully"}


@router.post("/contact-sales")
def contact_sales(data: dict):
    """Handle contact sales form submissions."""
    name = data.get("name")
    email = data.get("email")
    company = data.get("company")
    team_size = data.get("team_size")
    message = data.get("message")

    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")

    # Send notification email to sales
    try:
        from app.services.email_service import send_email_mailgun
        html = f"""
        <div style="font-family: sans-serif; padding: 20px;">
            <h2>New Sales Inquiry from GuidesForge</h2>
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Company:</strong> {company or 'N/A'}</p>
            <p><strong>Team Size:</strong> {team_size or 'N/A'}</p>
            <p><strong>Message:</strong> {message or 'N/A'}</p>
        </div>
        """
        send_email_mailgun("support@guidesforge.org", f"[Sales Inquiry] {name} from {company}", html)
    except Exception:
        pass

    return {"message": "Thank you! We'll be in touch within 24 hours."}


@router.post("/change-password")
def change_password(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change password for authenticated user."""
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current password and new password required")

    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.password_hash = hash_password(new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()

    return {"message": "Password changed successfully"}


@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        plan="pro",  # 14-day reverse trial
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
    )
    db.add(user)
    db.flush()

    # Create default workspace
    slug = data.email.split("@")[0].lower().replace(".", "-").replace("+", "-")
    # Ensure slug uniqueness
    base_slug = slug
    counter = 1
    while db.query(Workspace).filter(Workspace.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    workspace = Workspace(
        owner_id=user.id,
        name=f"{data.full_name or data.email.split('@')[0]}'s Workspace",
        slug=slug,
        sdk_key=secrets.token_hex(32),
        plan_seats=5,  # Pro trial
        sdk_mau_limit=1000,
    )
    db.add(workspace)
    db.flush()

    # Add user as owner member
    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role="owner",
        joined_at=datetime.utcnow(),
    )
    db.add(member)
    db.commit()

    # Send welcome email (non-blocking)
    try:
        send_welcome_email(user.email, user.full_name)
    except Exception:
        pass

    # Track in Customer.io (non-blocking)
    try:
        from app.services.customerio_service import on_user_registered
        on_user_registered(str(user.id), user.email, user.full_name)
    except Exception:
        pass

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: TokenRefresh):
    payload = decode_token(data.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    access_token = create_access_token({"sub": user_id})
    new_refresh_token = create_refresh_token({"sub": user_id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout")
def logout():
    # JWT tokens are stateless; client should discard them
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.avatar_photo_url is not None:
        current_user.avatar_photo_url = data.avatar_photo_url
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/upload-voice")
async def upload_voice(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.content_type or "audio" not in file.content_type:
        raise HTTPException(status_code=400, detail="File must be an audio file (WAV)")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB max
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    voice_url = upload_voice_profile(contents, str(current_user.id))
    current_user.voice_profile_url = voice_url
    current_user.updated_at = datetime.utcnow()
    db.commit()

    return {"voice_profile_url": voice_url, "message": "Voice profile uploaded successfully"}
