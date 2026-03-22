"""add check constraint group_invitations status

Revision ID: c1d2e3f4a5b6
Revises: b2c3d4e5f6a1
Create Date: 2026-03-15 00:00:00.000000

"""
from alembic import op

revision = 'c1d2e3f4a5b6'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        "ck_group_invitations_status",
        "group_invitations",
        "status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')",
    )


def downgrade():
    op.drop_constraint("ck_group_invitations_status", "group_invitations", type_="check")
