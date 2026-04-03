"""add composite indexes for league_players and group_invitations

Revision ID: a1b2c3d4e5f6
Revises: add_group_invitations_table
Create Date: 2026-03-14 00:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'add_group_invitations_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index('ix_league_players_league_id', 'league_players', ['league_id'])
    op.create_index('ix_league_players_player_id', 'league_players', ['player_id'])
    op.create_index('ix_league_players_group_id', 'league_players', ['group_id'])
    op.create_index('ix_league_players_league_player', 'league_players', ['league_id', 'player_id'], unique=True)
    op.create_index('ix_group_invitations_league_id', 'group_invitations', ['league_id'])
    op.create_index('ix_group_invitations_group_id', 'group_invitations', ['group_id'])


def downgrade() -> None:
    op.drop_index('ix_group_invitations_group_id', table_name='group_invitations')
    op.drop_index('ix_group_invitations_league_id', table_name='group_invitations')
    op.drop_index('ix_league_players_league_player', table_name='league_players')
    op.drop_index('ix_league_players_group_id', table_name='league_players')
    op.drop_index('ix_league_players_player_id', table_name='league_players')
    op.drop_index('ix_league_players_league_id', table_name='league_players')
