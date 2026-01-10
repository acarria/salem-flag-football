"""Make fields independent from leagues

Revision ID: make_fields_independent
Revises: set_registration_fee_default
Create Date: 2025-01-27 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'make_fields_independent'
down_revision: Union[str, Sequence[str], None] = 'create_field_avail_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Step 1: Create league_fields junction table for many-to-many relationship
    op.create_table('league_fields',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('league_id', 'field_id', name='uq_league_field')
    )
    op.create_index(op.f('ix_league_fields_league_id'), 'league_fields', ['league_id'], unique=False)
    op.create_index(op.f('ix_league_fields_field_id'), 'league_fields', ['field_id'], unique=False)
    op.create_foreign_key('fk_league_fields_league_id', 'league_fields', 'leagues', ['league_id'], ['id'])
    op.create_foreign_key('fk_league_fields_field_id', 'league_fields', 'fields', ['field_id'], ['id'])
    
    # Step 2: Migrate existing field-league relationships to junction table
    op.execute("""
        INSERT INTO league_fields (league_id, field_id, created_at)
        SELECT league_id, id as field_id, created_at
        FROM fields
        WHERE league_id IS NOT NULL
    """)
    
    # Step 3: Add field_id to games table (nullable for now)
    op.add_column('games', sa.Column('field_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_games_field_id'), 'games', ['field_id'], unique=False)
    op.create_foreign_key('fk_games_field_id', 'games', 'fields', ['field_id'], ['id'])
    
    # Step 4: Remove league_id from field_availability (make availability field-only)
    # Note: This step is skipped since field_availabilities table is created without league_id
    # in the create_field_availabilities_table migration
    
    # Step 5: Remove league_id from fields table
    # First, find and drop the foreign key constraint
    op.execute("""
        DO $$ 
        DECLARE 
            r RECORD;
        BEGIN
            FOR r IN (
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'fields' 
                AND constraint_type = 'FOREIGN KEY'
                AND constraint_name LIKE '%league_id%'
            ) LOOP
                EXECUTE 'ALTER TABLE fields DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
            END LOOP;
        END $$;
    """)
    # Drop index if it exists
    op.execute("DROP INDEX IF EXISTS ix_fields_league_id;")
    # Then drop the column
    op.drop_column('fields', 'league_id')


def downgrade() -> None:
    """Downgrade schema."""
    # Step 5 (reverse): Add league_id back to fields
    op.add_column('fields', sa.Column('league_id', sa.Integer(), nullable=True))
    # Try to restore relationships (will need manual intervention if multiple leagues per field)
    op.execute("""
        UPDATE fields f
        SET league_id = (
            SELECT lf.league_id 
            FROM league_fields lf 
            WHERE lf.field_id = f.id 
            LIMIT 1
        )
    """)
    op.alter_column('fields', 'league_id', nullable=False)
    op.create_index(op.f('ix_fields_league_id'), 'fields', ['league_id'], unique=False)
    op.create_foreign_key('fk_fields_league_id', 'fields', 'leagues', ['league_id'], ['id'])
    
    # Step 4 (reverse): Note - field_availabilities table is created without league_id
    # so no change needed here for downgrade
    
    # Step 3 (reverse): Remove field_id from games
    op.drop_constraint('fk_games_field_id', 'games', type_='foreignkey')
    op.drop_index(op.f('ix_games_field_id'), table_name='games')
    op.drop_column('games', 'field_id')
    
    # Step 2 (reverse): Data migration handled above
    
    # Step 1 (reverse): Drop junction table
    op.drop_constraint('fk_league_fields_field_id', 'league_fields', type_='foreignkey')
    op.drop_constraint('fk_league_fields_league_id', 'league_fields', type_='foreignkey')
    op.drop_index(op.f('ix_league_fields_field_id'), table_name='league_fields')
    op.drop_index(op.f('ix_league_fields_league_id'), table_name='league_fields')
    op.drop_table('league_fields')

