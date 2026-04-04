"""Add column length constraints to players and max_teams check to leagues

Revision ID: e1f2a3b4c5d6
Revises: d7a8b9c0d1e2
Create Date: 2026-04-04

Changes:
- Item 12: Add VARCHAR(N) constraints to players string columns
- Item 30: Add check constraint on leagues.max_teams
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'd7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Item 12: Player column length constraints (defence-in-depth alongside Pydantic validation)
    op.alter_column('players', 'clerk_user_id', type_=sa.String(200), existing_nullable=False)
    op.alter_column('players', 'first_name', type_=sa.String(100), existing_nullable=False)
    op.alter_column('players', 'last_name', type_=sa.String(100), existing_nullable=False)
    op.alter_column('players', 'email', type_=sa.String(320), existing_nullable=False)
    op.alter_column('players', 'phone', type_=sa.String(30), existing_nullable=True)
    op.alter_column('players', 'gender', type_=sa.String(20), existing_nullable=True)
    op.alter_column('players', 'created_by', type_=sa.String(200), existing_nullable=False)

    # Item 30: League max_teams check constraint
    op.create_check_constraint(
        'ck_leagues_max_teams',
        'leagues',
        "max_teams IS NULL OR (max_teams >= 2 AND max_teams <= 10)",
    )


def downgrade() -> None:
    op.drop_constraint('ck_leagues_max_teams', 'leagues', type_='check')

    # Revert to unbounded String
    op.alter_column('players', 'created_by', type_=sa.String(), existing_nullable=False)
    op.alter_column('players', 'gender', type_=sa.String(), existing_nullable=True)
    op.alter_column('players', 'phone', type_=sa.String(), existing_nullable=True)
    op.alter_column('players', 'email', type_=sa.String(), existing_nullable=False)
    op.alter_column('players', 'last_name', type_=sa.String(), existing_nullable=False)
    op.alter_column('players', 'first_name', type_=sa.String(), existing_nullable=False)
    op.alter_column('players', 'clerk_user_id', type_=sa.String(), existing_nullable=False)
