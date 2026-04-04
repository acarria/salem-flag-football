"""add team_id index and format check constraint

Revision ID: c6a91333b624
Revises: f7e8d9c0b1a2
Create Date: 2026-04-03 13:55:19.066248

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c6a91333b624'
down_revision: Union[str, Sequence[str], None] = 'f7e8d9c0b1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add index on league_players.team_id for team roster lookups
    op.create_index('ix_league_players_team_id', 'league_players', ['team_id'])

    # Add check constraint on leagues.format to enforce valid game formats
    op.create_check_constraint(
        'ck_leagues_format',
        'leagues',
        "format IN ('7v7', '5v5')",
    )


def downgrade() -> None:
    op.drop_constraint('ck_leagues_format', 'leagues', type_='check')
    op.drop_index('ix_league_players_team_id', table_name='league_players')
