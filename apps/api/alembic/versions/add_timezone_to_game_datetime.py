"""Add timezone to game_datetime column

Revision ID: 86e4632e7e4a
Revises: update_reg_fee_decimal
Create Date: 2026-04-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86e4632e7e4a'
down_revision: Union[str, None] = 'update_reg_fee_decimal'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'games',
        'game_datetime',
        type_=sa.DateTime(timezone=True),
        existing_type=sa.DateTime(),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        'games',
        'game_datetime',
        type_=sa.DateTime(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=False,
    )
