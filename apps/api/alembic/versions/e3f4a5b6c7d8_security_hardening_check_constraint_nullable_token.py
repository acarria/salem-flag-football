"""security hardening: check constraint on league_players and nullable token on group_invitations

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-03-15 12:00:00.000000

"""
from alembic import op

revision = 'e3f4a5b6c7d8'
down_revision = 'd2e3f4a5b6c7'
branch_labels = None
depends_on = None


def upgrade():
    # I1: Add CHECK constraint on league_players.registration_status
    op.create_check_constraint(
        "ck_league_players_registration_status",
        "league_players",
        "registration_status IN ('confirmed', 'pending', 'declined', 'expired')",
    )

    # H3: Allow group_invitations.token to be NULL so it can be cleared after acceptance
    op.alter_column("group_invitations", "token", nullable=True)


def downgrade():
    op.alter_column("group_invitations", "token", nullable=False)
    op.drop_constraint(
        "ck_league_players_registration_status", "league_players", type_="check"
    )
