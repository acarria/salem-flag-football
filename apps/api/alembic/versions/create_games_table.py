"""Create games table

Revision ID: create_games_table
Revises: set_registration_fee_default
Create Date: 2025-01-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'create_games_table'
down_revision: Union[str, Sequence[str], None] = 'set_registration_fee_default'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create games table
    op.create_table('games',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('team1_id', sa.Integer(), nullable=False),
        sa.Column('team2_id', sa.Integer(), nullable=False),
        sa.Column('week', sa.Integer(), nullable=False),
        sa.Column('phase', sa.String(), nullable=True),  # 'regular_season', 'playoff', etc.
        sa.Column('game_date', sa.Date(), nullable=False),
        sa.Column('game_time', sa.String(), nullable=False),  # e.g., "18:00"
        sa.Column('game_datetime', sa.DateTime(), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('status', sa.String(), nullable=False, server_default='scheduled'),  # scheduled, in_progress, completed, cancelled
        sa.Column('team1_score', sa.Integer(), nullable=True),
        sa.Column('team2_score', sa.Integer(), nullable=True),
        sa.Column('winner_id', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=False),  # Clerk user id
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_foreign_key('fk_games_league_id', 'games', 'leagues', ['league_id'], ['id'])
    op.create_foreign_key('fk_games_team1_id', 'games', 'teams', ['team1_id'], ['id'])
    op.create_foreign_key('fk_games_team2_id', 'games', 'teams', ['team2_id'], ['id'])
    op.create_foreign_key('fk_games_winner_id', 'games', 'teams', ['winner_id'], ['id'])
    op.create_index(op.f('ix_games_id'), 'games', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_games_id'), table_name='games')
    op.drop_constraint('fk_games_winner_id', 'games', type_='foreignkey')
    op.drop_constraint('fk_games_team2_id', 'games', type_='foreignkey')
    op.drop_constraint('fk_games_team1_id', 'games', type_='foreignkey')
    op.drop_constraint('fk_games_league_id', 'games', type_='foreignkey')
    op.drop_table('games')

