"""add waivers and waiver_signatures tables, waiver_deadline to league_players

Revision ID: a1b2c3d4e5f6
Revises: 680a9307be2f
Create Date: 2026-04-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f7e8d9c0b1a2'
down_revision: Union[str, None] = '680a9307be2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Placeholder flag football liability waiver text
_WAIVER_CONTENT = """SALEM FLAG FOOTBALL LEAGUE -- LIABILITY WAIVER AND RELEASE OF CLAIMS

PLEASE READ CAREFULLY BEFORE SIGNING.

1. ASSUMPTION OF RISK
I acknowledge that participation in flag football involves inherent risks of physical injury, including but not limited to sprains, fractures, concussions, and other bodily harm. I voluntarily assume all such risks, both known and unknown, even if arising from the negligence of the Released Parties (defined below).

2. RELEASE AND WAIVER OF LIABILITY
I, on behalf of myself, my heirs, executors, and assigns, hereby release, waive, and forever discharge the Salem Flag Football League, its organizers, officers, volunteers, sponsors, and affiliated entities (collectively, the "Released Parties") from any and all claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury, including death, that may be sustained by me while participating in league activities.

3. MEDICAL ACKNOWLEDGMENT
I certify that I am physically fit and have no medical condition that would prevent my participation. I authorize emergency medical treatment in the event of injury during league activities. I understand that the Released Parties do not provide medical insurance coverage for participants.

4. RULES AND CONDUCT
I agree to abide by all league rules and the decisions of referees and league officials. I understand that unsportsmanlike conduct, including but not limited to fighting, verbal abuse, or intentional dangerous play, may result in immediate ejection and suspension from the league without refund.

5. PERSONAL PROPERTY
I understand that the Released Parties are not responsible for any loss, theft, or damage to personal property brought to league events.

6. MEDIA RELEASE
I grant the Salem Flag Football League permission to use my likeness, image, and voice in photographs, video recordings, and other media for promotional purposes without compensation.

7. INDEMNIFICATION
I agree to indemnify and hold harmless the Released Parties from any claims, damages, or expenses (including attorney fees) arising from my participation in league activities or my breach of this agreement.

8. GOVERNING LAW
This waiver shall be governed by the laws of the Commonwealth of Massachusetts. Any disputes arising under this agreement shall be resolved in the courts of Essex County, Massachusetts.

9. SEVERABILITY
If any provision of this waiver is found to be unenforceable, the remaining provisions shall remain in full force and effect.

10. ACKNOWLEDGMENT
By signing below, I acknowledge that I have read this waiver in its entirety, understand its terms, and agree to be bound by them. I am signing this waiver voluntarily and of my own free will.
"""


def upgrade() -> None:
    # Create waivers table
    op.create_table(
        'waivers',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('version', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_waivers_id', 'waivers', ['id'])

    # Create waiver_signatures table
    op.create_table(
        'waiver_signatures',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('waiver_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('waivers.id'), nullable=False),
        sa.Column('player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id'), nullable=False),
        sa.Column('league_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('leagues.id'), nullable=False),
        sa.Column('full_name_typed', sa.String(), nullable=False),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('signed_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('email_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pdf_path', sa.String(), nullable=True),
        sa.UniqueConstraint('player_id', 'league_id', 'waiver_id', name='uq_signature_player_league_waiver'),
    )
    op.create_index('ix_waiver_signatures_id', 'waiver_signatures', ['id'])
    op.create_index('ix_waiver_signatures_waiver_id', 'waiver_signatures', ['waiver_id'])
    op.create_index('ix_waiver_signatures_player_id', 'waiver_signatures', ['player_id'])
    op.create_index('ix_waiver_signatures_league_id', 'waiver_signatures', ['league_id'])

    # Add waiver_deadline to league_players
    op.add_column('league_players', sa.Column('waiver_deadline', sa.DateTime(timezone=True), nullable=True))

    # Seed initial waiver
    import uuid
    op.execute(
        sa.text(
            "INSERT INTO waivers (id, version, content, is_active, created_at) "
            "VALUES (:id, :version, :content, true, now())"
        ).bindparams(
            id=str(uuid.uuid4()),
            version='2025-v1',
            content=_WAIVER_CONTENT.strip(),
        )
    )


def downgrade() -> None:
    op.drop_column('league_players', 'waiver_deadline')
    op.drop_table('waiver_signatures')
    op.drop_table('waivers')
