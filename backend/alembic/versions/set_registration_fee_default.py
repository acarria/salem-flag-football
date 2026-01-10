"""Set registration_fee default to 0

Revision ID: set_registration_fee_default
Revises: create_fields_table
Create Date: 2025-01-27 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'set_registration_fee_default'
down_revision: Union[str, Sequence[str], None] = 'create_fields_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Update existing NULL values to 0
    op.execute("""
        UPDATE leagues 
        SET registration_fee = 0 
        WHERE registration_fee IS NULL
    """)
    
    # Alter column to be NOT NULL with default 0
    op.alter_column('leagues', 'registration_fee',
                    existing_type=sa.Numeric(10, 2),
                    nullable=False,
                    server_default='0')


def downgrade() -> None:
    """Downgrade schema."""
    # Alter column back to nullable
    op.alter_column('leagues', 'registration_fee',
                    existing_type=sa.Numeric(10, 2),
                    nullable=True,
                    server_default=None)

