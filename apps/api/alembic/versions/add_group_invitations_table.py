"""Add group_invitations table

Revision ID: add_group_invitations_table
Revises: convert_pk_fk_to_uuid
Create Date: 2026-03-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "add_group_invitations_table"
down_revision: Union[str, Sequence[str], None] = "convert_pk_fk_to_uuid"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "group_invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, index=True),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("league_id", UUID(as_uuid=True), sa.ForeignKey("leagues.id"), nullable=False),
        sa.Column("email", sa.String(), nullable=False, index=True),
        sa.Column("first_name", sa.String(), nullable=False),
        sa.Column("last_name", sa.String(), nullable=False),
        sa.Column("token", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("invited_by", UUID(as_uuid=True), sa.ForeignKey("players.id"), nullable=False),
        sa.Column("player_id", UUID(as_uuid=True), sa.ForeignKey("players.id"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("group_invitations")
