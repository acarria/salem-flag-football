"""Drop dead Player status columns, add clerk_user_id to admin_configs, add updated_at triggers

Revision ID: d7a8b9c0d1e2
Revises: c6a91333b624
Create Date: 2026-04-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd7a8b9c0d1e2'
down_revision: Union[str, Sequence[str], None] = 'c6a91333b624'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables that have an updated_at column
_TRIGGER_TABLES = [
    'players', 'leagues', 'teams', 'games', 'league_players',
    'group_invitations', 'admin_configs',
]


def upgrade() -> None:
    # 1. Drop dead Player-level status columns (all logic uses LeaguePlayer)
    op.drop_column('players', 'payment_status')
    op.drop_column('players', 'waiver_status')

    # 2. Add clerk_user_id to admin_configs for immutable admin identity
    op.add_column('admin_configs', sa.Column('clerk_user_id', sa.String(), nullable=True))
    op.create_index('ix_admin_configs_clerk_user_id', 'admin_configs', ['clerk_user_id'], unique=True)

    # 3. Create PostgreSQL trigger function for updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    for table in _TRIGGER_TABLES:
        op.execute(f"""
            CREATE TRIGGER trg_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """)


def downgrade() -> None:
    # 3. Drop triggers
    for table in _TRIGGER_TABLES:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON {table};")
    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")

    # 2. Drop clerk_user_id
    op.drop_index('ix_admin_configs_clerk_user_id', table_name='admin_configs')
    op.drop_column('admin_configs', 'clerk_user_id')

    # 1. Restore Player status columns
    op.add_column('players', sa.Column('waiver_status', sa.String(), server_default='pending'))
    op.add_column('players', sa.Column('payment_status', sa.String(), server_default='pending'))
