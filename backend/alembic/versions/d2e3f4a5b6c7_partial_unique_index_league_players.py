"""partial unique index league_players active only

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b6
Create Date: 2026-03-15 00:01:00.000000

"""
from alembic import op

revision = 'd2e3f4a5b6c7'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_index("ix_league_players_league_player", table_name="league_players")
    op.execute(
        "CREATE UNIQUE INDEX ix_league_players_league_player "
        "ON league_players (league_id, player_id) WHERE is_active = TRUE"
    )


def downgrade():
    op.drop_index("ix_league_players_league_player", table_name="league_players")
    op.create_index(
        "ix_league_players_league_player",
        "league_players",
        ["league_id", "player_id"],
        unique=True,
    )
