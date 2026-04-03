"""add composite indexes for hot query paths

Revision ID: b520d6cfe2bf
Revises: f1a2b3c4d5e6
Create Date: 2026-04-03 05:33:21.160849

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b520d6cfe2bf'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_games_league_active_status",
        "games",
        ["league_id", "is_active", "status"],
    )
    op.create_index(
        "ix_group_invitations_league_status_expires",
        "group_invitations",
        ["league_id", "status", "expires_at"],
    )
    op.create_index(
        "ix_league_players_league_regstatus_active",
        "league_players",
        ["league_id", "registration_status", "is_active"],
    )


def downgrade() -> None:
    op.drop_index("ix_league_players_league_regstatus_active", table_name="league_players")
    op.drop_index("ix_group_invitations_league_status_expires", table_name="group_invitations")
    op.drop_index("ix_games_league_active_status", table_name="games")
