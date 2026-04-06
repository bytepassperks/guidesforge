import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey,
    create_engine, Index, JSON
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from pgvector.sqlalchemy import Vector

from app.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255))
    full_name = Column(String(255))
    plan = Column(String(50), default="free")
    plan_currency = Column(String(10), default="USD")
    voice_profile_url = Column(Text)
    avatar_photo_url = Column(Text)
    trial_ends_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owned_workspaces = relationship("Workspace", back_populates="owner")
    memberships = relationship("WorkspaceMember", back_populates="user")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    brand_color = Column(String(7), default="#6366F1")
    logo_url = Column(Text)
    custom_domain = Column(Text)
    plan_seats = Column(Integer, default=1)
    sdk_mau_limit = Column(Integer, default=0)
    sdk_key = Column(String(64), unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="owned_workspaces")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    guides = relationship("Guide", back_populates="workspace", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="workspace", cascade="all, delete-orphan")
    sdk_sessions = relationship("SDKSession", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(50), default="member")
    invited_at = Column(DateTime, default=datetime.utcnow)
    joined_at = Column(DateTime)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Guide(Base):
    __tablename__ = "guides"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="processing")
    staleness_score = Column(Float, default=0.0)
    last_staleness_check = Column(DateTime)
    staleness_detection_enabled = Column(Boolean, default=True)
    video_url = Column(Text)
    thumbnail_url = Column(Text)
    total_steps = Column(Integer, default=0)
    total_duration_seconds = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    embedding = Column(Vector(384))
    is_public = Column(Boolean, default=False)
    help_center_published = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="guides")
    creator = relationship("User")
    steps = relationship("GuideStep", back_populates="guide", cascade="all, delete-orphan", order_by="GuideStep.step_number")
    analytics = relationship("GuideAnalytics", back_populates="guide", cascade="all, delete-orphan")


class GuideStep(Base):
    __tablename__ = "guide_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guide_id = Column(UUID(as_uuid=True), ForeignKey("guides.id", ondelete="CASCADE"), nullable=False)
    step_number = Column(Integer, nullable=False)
    title = Column(String(500))
    description = Column(Text)
    script_text = Column(Text)
    page_url = Column(Text, nullable=False)
    element_selector = Column(Text)
    click_x = Column(Integer)
    click_y = Column(Integer)
    screenshot_url = Column(Text, nullable=False)
    baseline_screenshot_url = Column(Text)
    annotated_screenshot_url = Column(Text)
    audio_url = Column(Text)
    current_screenshot_url = Column(Text)
    pixel_diff_percentage = Column(Float, default=0.0)
    is_stale = Column(Boolean, default=False)
    diff_image_url = Column(Text)
    detected_elements = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)

    guide = relationship("Guide", back_populates="steps")


class GuideAnalytics(Base):
    __tablename__ = "guide_analytics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guide_id = Column(UUID(as_uuid=True), ForeignKey("guides.id"), nullable=False)
    viewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    viewer_ip = Column(String(45))
    viewer_user_agent = Column(Text)
    steps_completed = Column(Integer, default=0)
    total_steps = Column(Integer)
    watch_duration_seconds = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    source = Column(String(100))
    referrer = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    guide = relationship("Guide", back_populates="analytics")


class SDKSession(Base):
    __tablename__ = "sdk_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False)
    user_identifier = Column(Text)
    page_url = Column(Text)
    guides_shown = Column(JSONB, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="sdk_sessions")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    plan = Column(String(50), nullable=False)
    currency = Column(String(10), nullable=False)
    amount = Column(Integer, default=0)
    interval = Column(String(20), nullable=False)
    provider = Column(String(20), nullable=False)
    provider_subscription_id = Column(String(255))
    status = Column(String(50), default="active")
    current_period_end = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="subscriptions")


# Indexes
Index("ix_guides_embedding", Guide.embedding, postgresql_using="ivfflat", postgresql_with={"lists": 100}, postgresql_ops={"embedding": "vector_cosine_ops"})
