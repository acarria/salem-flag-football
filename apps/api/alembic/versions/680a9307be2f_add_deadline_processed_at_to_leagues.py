"""add deadline_processed_at to leagues

Revision ID: 680a9307be2f
Revises: c4fbcd2c9eb6
Create Date: 2026-04-03 06:12:04.360503

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '680a9307be2f'
down_revision: Union[str, Sequence[str], None] = 'c4fbcd2c9eb6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('leagues', sa.Column('deadline_processed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('leagues', 'deadline_processed_at')
