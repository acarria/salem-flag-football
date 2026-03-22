"""Create fields table

Revision ID: create_fields_table
Revises: update_reg_fee_decimal
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'create_fields_table'
down_revision: Union[str, Sequence[str], None] = 'update_reg_fee_decimal'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create fields table
    op.create_table('fields',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('league_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('field_number', sa.String(), nullable=True),
        sa.Column('street_address', sa.String(), nullable=False),
        sa.Column('city', sa.String(), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('zip_code', sa.String(), nullable=False),
        sa.Column('country', sa.String(), nullable=False),
        sa.Column('facility_name', sa.String(), nullable=True),
        sa.Column('additional_notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_foreign_key(None, 'fields', 'leagues', ['league_id'], ['id'])
    op.create_index(op.f('ix_fields_id'), 'fields', ['id'], unique=False)
    op.create_index(op.f('ix_fields_league_id'), 'fields', ['league_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_fields_league_id'), table_name='fields')
    op.drop_index(op.f('ix_fields_id'), table_name='fields')
    op.drop_constraint(None, 'fields', type_='foreignkey')
    op.drop_table('fields')

