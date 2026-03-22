"""Drop playoff and compass draw columns from leagues table

Revision ID: f1a2b3c4d5e6
Revises: e3f4a5b6c7d8
Create Date: 2026-03-21

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e3f4a5b6c7d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('leagues', 'regular_season_weeks')
    op.drop_column('leagues', 'playoff_weeks')
    op.drop_column('leagues', 'compass_draw_rounds')
    op.drop_column('leagues', 'playoff_teams')
    op.drop_column('leagues', 'playoff_format')


def downgrade() -> None:
    op.add_column('leagues', sa.Column('playoff_format', sa.String(), nullable=True))
    op.add_column('leagues', sa.Column('playoff_teams', sa.Integer(), nullable=True))
    op.add_column('leagues', sa.Column('compass_draw_rounds', sa.Integer(), nullable=True))
    op.add_column('leagues', sa.Column('playoff_weeks', sa.Integer(), nullable=True))
    op.add_column('leagues', sa.Column('regular_season_weeks', sa.Integer(), nullable=True))
