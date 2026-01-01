"""Update registration_fee to decimal

Revision ID: update_registration_fee_to_decimal
Revises: 12a32c7ace3b
Create Date: 2025-01-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'update_reg_fee_decimal'
down_revision: Union[str, Sequence[str], None] = 'ccfe5d949d6b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Convert registration_fee from Integer (cents) to Numeric(10,2) (dollars)
    # First, create a new column with the new type
    op.add_column('leagues', sa.Column('registration_fee_new', sa.Numeric(10, 2), nullable=True))
    
    # Convert existing data from cents to dollars
    op.execute("""
        UPDATE leagues 
        SET registration_fee_new = registration_fee / 100.0 
        WHERE registration_fee IS NOT NULL
    """)
    
    # Drop the old column and rename the new one
    op.drop_column('leagues', 'registration_fee')
    op.alter_column('leagues', 'registration_fee_new', new_column_name='registration_fee')


def downgrade() -> None:
    """Downgrade schema."""
    # Convert registration_fee from Numeric(10,2) (dollars) back to Integer (cents)
    # First, create a new column with the old type
    op.add_column('leagues', sa.Column('registration_fee_old', sa.Integer(), nullable=True))
    
    # Convert existing data from dollars to cents
    op.execute("""
        UPDATE leagues 
        SET registration_fee_old = registration_fee * 100 
        WHERE registration_fee IS NOT NULL
    """)
    
    # Drop the new column and rename the old one
    op.drop_column('leagues', 'registration_fee')
    op.alter_column('leagues', 'registration_fee_old', new_column_name='registration_fee') 