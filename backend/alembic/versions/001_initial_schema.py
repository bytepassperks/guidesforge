"""Initial schema

Revision ID: 001
Revises: 
Create Date: 2026-04-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute('CREATE EXTENSION IF NOT EXISTS vector')

    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255)),
        sa.Column('plan', sa.String(50), server_default='free'),
        sa.Column('plan_currency', sa.String(10)),
        sa.Column('voice_profile_url', sa.Text),
        sa.Column('avatar_photo_url', sa.Text),
        sa.Column('trial_ends_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Workspaces table
    op.create_table(
        'workspaces',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('brand_color', sa.String(7), server_default='#6366F1'),
        sa.Column('logo_url', sa.Text),
        sa.Column('custom_domain', sa.String(255)),
        sa.Column('plan_seats', sa.Integer, server_default='1'),
        sa.Column('sdk_mau_limit', sa.Integer, server_default='0'),
        sa.Column('sdk_key', sa.String(64), unique=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Workspace members table
    op.create_table(
        'workspace_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('role', sa.String(50), server_default='editor'),
        sa.Column('invited_at', sa.DateTime),
        sa.Column('joined_at', sa.DateTime),
    )

    # Guides table
    op.create_table(
        'guides',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('creator_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('status', sa.String(50), server_default='draft'),
        sa.Column('staleness_score', sa.Float),
        sa.Column('last_staleness_check', sa.DateTime),
        sa.Column('staleness_detection_enabled', sa.Boolean, server_default='true'),
        sa.Column('video_url', sa.Text),
        sa.Column('thumbnail_url', sa.Text),
        sa.Column('total_steps', sa.Integer, server_default='0'),
        sa.Column('total_duration_seconds', sa.Integer, server_default='0'),
        sa.Column('view_count', sa.Integer, server_default='0'),
        sa.Column('is_public', sa.Boolean, server_default='false'),
        sa.Column('help_center_published', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Add vector column for embedding (pgvector)
    op.execute('ALTER TABLE guides ADD COLUMN embedding vector(384)')
    op.execute('CREATE INDEX ix_guides_embedding ON guides USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)')

    # Guide steps table
    op.create_table(
        'guide_steps',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('guide_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('guides.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_number', sa.Integer, nullable=False),
        sa.Column('title', sa.String(500)),
        sa.Column('description', sa.Text),
        sa.Column('script_text', sa.Text),
        sa.Column('page_url', sa.Text),
        sa.Column('element_selector', sa.Text),
        sa.Column('click_x', sa.Float),
        sa.Column('click_y', sa.Float),
        sa.Column('screenshot_url', sa.Text),
        sa.Column('baseline_screenshot_url', sa.Text),
        sa.Column('annotated_screenshot_url', sa.Text),
        sa.Column('audio_url', sa.Text),
        sa.Column('current_screenshot_url', sa.Text),
        sa.Column('pixel_diff_percentage', sa.Float),
        sa.Column('is_stale', sa.Boolean, server_default='false'),
        sa.Column('diff_image_url', sa.Text),
        sa.Column('detected_elements', postgresql.JSON),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Guide analytics table
    op.create_table(
        'guide_analytics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('guide_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('guides.id', ondelete='CASCADE'), nullable=False),
        sa.Column('viewer_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('viewer_ip', sa.String(45)),
        sa.Column('viewer_user_agent', sa.Text),
        sa.Column('steps_completed', sa.Integer, server_default='0'),
        sa.Column('total_steps', sa.Integer, server_default='0'),
        sa.Column('watch_duration_seconds', sa.Float, server_default='0'),
        sa.Column('completed', sa.Boolean, server_default='false'),
        sa.Column('source', sa.String(50)),
        sa.Column('referrer', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # SDK sessions table
    op.create_table(
        'sdk_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(64), unique=True, nullable=False),
        sa.Column('user_identifier', sa.String(255)),
        sa.Column('page_url', sa.Text),
        sa.Column('guides_shown', postgresql.ARRAY(sa.String)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Subscriptions table
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan', sa.String(50), nullable=False),
        sa.Column('currency', sa.String(10), nullable=False),
        sa.Column('amount', sa.Integer),
        sa.Column('interval', sa.String(20)),
        sa.Column('provider', sa.String(50)),
        sa.Column('provider_subscription_id', sa.String(255)),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('current_period_end', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Create indexes
    op.create_index('ix_guides_workspace_id', 'guides', ['workspace_id'])
    op.create_index('ix_guide_steps_guide_id', 'guide_steps', ['guide_id'])
    op.create_index('ix_guide_analytics_guide_id', 'guide_analytics', ['guide_id'])
    op.create_index('ix_guide_analytics_created_at', 'guide_analytics', ['created_at'])
    op.create_index('ix_sdk_sessions_workspace_id', 'sdk_sessions', ['workspace_id'])
    op.create_index('ix_subscriptions_workspace_id', 'subscriptions', ['workspace_id'])


def downgrade() -> None:
    op.drop_table('subscriptions')
    op.drop_table('sdk_sessions')
    op.drop_table('guide_analytics')
    op.drop_table('guide_steps')
    op.drop_table('guides')
    op.drop_table('workspace_members')
    op.drop_table('workspaces')
    op.drop_table('users')
    op.execute('DROP EXTENSION IF EXISTS vector')
