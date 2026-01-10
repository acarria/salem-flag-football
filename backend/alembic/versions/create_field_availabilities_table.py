"""Create field_availabilities table

Revision ID: create_field_availabilities_table
Revises: create_games_table
Create Date: 2025-01-27 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'create_field_avail_table'
down_revision: Union[str, Sequence[str], None] = 'create_games_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create field_availabilities table
    op.create_table('field_availabilities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('day_of_week', sa.Integer(), nullable=True),  # 0=Monday, 6=Sunday (ISO weekday)
        sa.Column('recurrence_start_date', sa.Date(), nullable=True),  # When recurring pattern starts
        sa.Column('recurrence_end_date', sa.Date(), nullable=True),  # When recurring pattern ends (None = indefinite)
        sa.Column('custom_date', sa.Date(), nullable=True),  # Specific date for one-time availability
        sa.Column('start_time', sa.Time(), nullable=False),  # e.g., 18:00 (6pm)
        sa.Column('end_time', sa.Time(), nullable=False),  # e.g., 21:00 (9pm)
        sa.Column('notes', sa.String(), nullable=True),  # Optional notes
        sa.Column('created_by', sa.String(), nullable=False),  # Clerk user id
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_foreign_key('fk_field_availabilities_field_id', 'field_availabilities', 'fields', ['field_id'], ['id'])
    op.create_index(op.f('ix_field_availabilities_field_id'), 'field_availabilities', ['field_id'], unique=False)
    op.create_index(op.f('ix_field_availabilities_id'), 'field_availabilities', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_field_availabilities_id'), table_name='field_availabilities')
    op.drop_index(op.f('ix_field_availabilities_field_id'), table_name='field_availabilities')
    op.drop_constraint('fk_field_availabilities_field_id', 'field_availabilities', type_='foreignkey')
    op.drop_table('field_availabilities')

