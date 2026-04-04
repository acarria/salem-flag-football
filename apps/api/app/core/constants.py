"""Centralized status and format constants.

These replace bare string literals scattered across the codebase.
DB-level CheckConstraints and column defaults still use raw strings
since they are SQL, not Python logic.
"""

# LeaguePlayer.registration_status
REG_CONFIRMED = "confirmed"
REG_PENDING = "pending"
REG_DECLINED = "declined"
REG_EXPIRED = "expired"

# LeaguePlayer.payment_status
PAY_PENDING = "pending"
PAY_PAID = "paid"
PAY_FAILED = "failed"

# LeaguePlayer.waiver_status
WAIVER_PENDING = "pending"
WAIVER_SIGNED = "signed"
WAIVER_EXPIRED = "expired"

# GroupInvitation.status
INVITE_PENDING = "pending"
INVITE_ACCEPTED = "accepted"
INVITE_DECLINED = "declined"
INVITE_EXPIRED = "expired"
INVITE_REVOKED = "revoked"

# Game.status
GAME_SCHEDULED = "scheduled"
GAME_IN_PROGRESS = "in_progress"
GAME_COMPLETED = "completed"
GAME_CANCELLED = "cancelled"

# League.format
FORMAT_7V7 = "7v7"
FORMAT_5V5 = "5v5"

# Players per team by format (replaces _PLAYERS_PER_TEAM)
PLAYERS_PER_TEAM: dict[str, int] = {FORMAT_7V7: 7, FORMAT_5V5: 5}
