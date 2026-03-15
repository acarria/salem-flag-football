"""drop stale player columns registration_status team_id group_name

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-03-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('players', 'registration_status')
    op.drop_column('players', 'team_id')
    op.drop_column('players', 'group_name')


def downgrade() -> None:
    op.add_column('players', sa.Column('group_name', sa.String(), nullable=True))
    op.add_column('players', sa.Column('team_id', UUID(as_uuid=True), sa.ForeignKey('teams.id'), nullable=True))
    op.add_column('players', sa.Column('registration_status', sa.String(), nullable=True, server_default='pending'))
