"""drop legacy hashed_password and is_admin from users

Revision ID: c4fbcd2c9eb6
Revises: b520d6cfe2bf
Create Date: 2026-04-03 06:12:03.859110

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4fbcd2c9eb6'
down_revision: Union[str, Sequence[str], None] = 'b520d6cfe2bf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('users', 'hashed_password')
    op.drop_column('users', 'is_admin')


def downgrade() -> None:
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('users', sa.Column('hashed_password', sa.String(), server_default='', nullable=True))
