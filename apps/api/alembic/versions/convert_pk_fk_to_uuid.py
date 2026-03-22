"""Convert all primary and foreign keys from integer to UUID

Revision ID: convert_pk_fk_to_uuid
Revises: make_fields_independent
Create Date: 2025-03-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "convert_pk_fk_to_uuid"
down_revision: Union[str, Sequence[str], None] = "make_fields_independent"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_all_fk_constraints(conn, table_names):
    """Drop all foreign key constraints that reference the given tables or are on those tables."""
    for table in table_names:
        result = conn.execute(
            sa.text(
                """
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_schema = 'public' AND table_name = :t AND constraint_type = 'FOREIGN KEY'
                """
            ),
            {"t": table},
        )
        for row in result:
            op.drop_constraint(row[0], table, type_="foreignkey")


def upgrade() -> None:
    conn = op.get_bind()
    all_tables = [
        "users", "admin_configs", "leagues", "fields", "teams", "players",
        "groups", "league_players", "games", "field_availabilities", "league_fields",
    ]

    # Step 1: Add id_new UUID column to all tables and backfill
    for table in all_tables:
        op.add_column(table, sa.Column("id_new", UUID(as_uuid=True), nullable=True))
        op.execute(f"UPDATE {table} SET id_new = gen_random_uuid()")
        op.alter_column(table, "id_new", nullable=False)

    # Step 2: Add new FK columns and backfill
    op.add_column("teams", sa.Column("league_id_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE teams t SET league_id_new = l.id_new FROM leagues l WHERE t.league_id = l.id")
    op.alter_column("teams", "league_id_new", nullable=False)

    op.add_column("players", sa.Column("team_id_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE players p SET team_id_new = t.id_new FROM teams t WHERE p.team_id = t.id")

    op.add_column("groups", sa.Column("league_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("groups", sa.Column("created_by_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE groups g SET league_id_new = l.id_new FROM leagues l WHERE g.league_id = l.id")
    op.execute("UPDATE groups g SET created_by_new = p.id_new FROM players p WHERE g.created_by = p.id")
    op.alter_column("groups", "league_id_new", nullable=False)
    op.alter_column("groups", "created_by_new", nullable=False)

    op.add_column("league_players", sa.Column("league_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("league_players", sa.Column("player_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("league_players", sa.Column("group_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("league_players", sa.Column("team_id_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE league_players lp SET league_id_new = l.id_new FROM leagues l WHERE lp.league_id = l.id")
    op.execute("UPDATE league_players lp SET player_id_new = p.id_new FROM players p WHERE lp.player_id = p.id")
    op.execute("UPDATE league_players lp SET group_id_new = g.id_new FROM groups g WHERE lp.group_id = g.id")
    op.execute("UPDATE league_players lp SET team_id_new = t.id_new FROM teams t WHERE lp.team_id = t.id")
    op.alter_column("league_players", "league_id_new", nullable=False)
    op.alter_column("league_players", "player_id_new", nullable=False)

    op.add_column("games", sa.Column("league_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("games", sa.Column("field_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("games", sa.Column("team1_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("games", sa.Column("team2_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("games", sa.Column("winner_id_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE games g SET league_id_new = l.id_new FROM leagues l WHERE g.league_id = l.id")
    op.execute("UPDATE games g SET field_id_new = f.id_new FROM fields f WHERE g.field_id = f.id")
    op.execute("UPDATE games g SET team1_id_new = t.id_new FROM teams t WHERE g.team1_id = t.id")
    op.execute("UPDATE games g SET team2_id_new = t.id_new FROM teams t WHERE g.team2_id = t.id")
    op.execute("UPDATE games g SET winner_id_new = t.id_new FROM teams t WHERE g.winner_id = t.id")
    op.alter_column("games", "league_id_new", nullable=False)
    op.alter_column("games", "team1_id_new", nullable=False)
    op.alter_column("games", "team2_id_new", nullable=False)
    # field_id and winner_id stay nullable

    op.add_column("field_availabilities", sa.Column("field_id_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE field_availabilities fa SET field_id_new = f.id_new FROM fields f WHERE fa.field_id = f.id")
    op.alter_column("field_availabilities", "field_id_new", nullable=False)

    op.add_column("league_fields", sa.Column("league_id_new", UUID(as_uuid=True), nullable=True))
    op.add_column("league_fields", sa.Column("field_id_new", UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE league_fields lf SET league_id_new = l.id_new FROM leagues l WHERE lf.league_id = l.id")
    op.execute("UPDATE league_fields lf SET field_id_new = f.id_new FROM fields f WHERE lf.field_id = f.id")
    op.alter_column("league_fields", "league_id_new", nullable=False)
    op.alter_column("league_fields", "field_id_new", nullable=False)

    # Step 3: Drop all FK constraints (so we can drop id columns)
    _drop_all_fk_constraints(
        conn,
        ["teams", "players", "groups", "league_players", "games", "field_availabilities", "league_fields"],
    )

    # Step 4: For each table drop PK, drop old id, rename id_new -> id, add PK and index
    # Order: drop id last on tables that are referenced (so we drop referencing table FKs first already)
    for table in all_tables:
        op.drop_constraint(f"{table}_pkey", table, type_="primary")
        op.drop_column(table, "id")
        op.alter_column(table, "id_new", new_column_name="id")
        op.create_primary_key(f"{table}_pkey", table, ["id"])
        op.create_index(op.f(f"ix_{table}_id"), table, ["id"], unique=False)

    # Step 5: Drop old FK columns, rename _new -> original, add FK constraints and indexes
    op.drop_column("teams", "league_id")
    op.alter_column("teams", "league_id_new", new_column_name="league_id")
    op.create_foreign_key("teams_league_id_fkey", "teams", "leagues", ["league_id"], ["id"])

    op.drop_column("players", "team_id")
    op.alter_column("players", "team_id_new", new_column_name="team_id")
    op.create_foreign_key("players_team_id_fkey", "players", "teams", ["team_id"], ["id"])

    op.drop_column("groups", "league_id")
    op.drop_column("groups", "created_by")
    op.alter_column("groups", "league_id_new", new_column_name="league_id")
    op.alter_column("groups", "created_by_new", new_column_name="created_by")
    op.create_foreign_key("groups_league_id_fkey", "groups", "leagues", ["league_id"], ["id"])
    op.create_foreign_key("groups_created_by_fkey", "groups", "players", ["created_by"], ["id"])

    op.drop_column("league_players", "league_id")
    op.drop_column("league_players", "player_id")
    op.drop_column("league_players", "group_id")
    op.drop_column("league_players", "team_id")
    op.alter_column("league_players", "league_id_new", new_column_name="league_id")
    op.alter_column("league_players", "player_id_new", new_column_name="player_id")
    op.alter_column("league_players", "group_id_new", new_column_name="group_id")
    op.alter_column("league_players", "team_id_new", new_column_name="team_id")
    op.create_foreign_key("league_players_league_id_fkey", "league_players", "leagues", ["league_id"], ["id"])
    op.create_foreign_key("league_players_player_id_fkey", "league_players", "players", ["player_id"], ["id"])
    op.create_foreign_key("league_players_group_id_fkey", "league_players", "groups", ["group_id"], ["id"])
    op.create_foreign_key("league_players_team_id_fkey", "league_players", "teams", ["team_id"], ["id"])

    op.drop_column("games", "league_id")
    op.drop_column("games", "field_id")
    op.drop_column("games", "team1_id")
    op.drop_column("games", "team2_id")
    op.drop_column("games", "winner_id")
    op.alter_column("games", "league_id_new", new_column_name="league_id")
    op.alter_column("games", "field_id_new", new_column_name="field_id")
    op.alter_column("games", "team1_id_new", new_column_name="team1_id")
    op.alter_column("games", "team2_id_new", new_column_name="team2_id")
    op.alter_column("games", "winner_id_new", new_column_name="winner_id")
    op.create_foreign_key("games_league_id_fkey", "games", "leagues", ["league_id"], ["id"])
    op.create_foreign_key("games_field_id_fkey", "games", "fields", ["field_id"], ["id"])
    op.create_foreign_key("games_team1_id_fkey", "games", "teams", ["team1_id"], ["id"])
    op.create_foreign_key("games_team2_id_fkey", "games", "teams", ["team2_id"], ["id"])
    op.create_foreign_key("games_winner_id_fkey", "games", "teams", ["winner_id"], ["id"])
    op.create_index(op.f("ix_games_field_id"), "games", ["field_id"], unique=False)

    op.drop_column("field_availabilities", "field_id")
    op.alter_column("field_availabilities", "field_id_new", new_column_name="field_id")
    op.create_foreign_key("field_availabilities_field_id_fkey", "field_availabilities", "fields", ["field_id"], ["id"])
    op.create_index(op.f("ix_field_availabilities_field_id"), "field_availabilities", ["field_id"], unique=False)

    op.drop_constraint("uq_league_field", "league_fields", type_="unique")
    op.drop_column("league_fields", "league_id")
    op.drop_column("league_fields", "field_id")
    op.alter_column("league_fields", "league_id_new", new_column_name="league_id")
    op.alter_column("league_fields", "field_id_new", new_column_name="field_id")
    op.create_foreign_key("league_fields_league_id_fkey", "league_fields", "leagues", ["league_id"], ["id"])
    op.create_foreign_key("league_fields_field_id_fkey", "league_fields", "fields", ["field_id"], ["id"])
    op.create_index(op.f("ix_league_fields_league_id"), "league_fields", ["league_id"], unique=False)
    op.create_index(op.f("ix_league_fields_field_id"), "league_fields", ["field_id"], unique=False)
    op.create_unique_constraint("uq_league_field", "league_fields", ["league_id", "field_id"])


def downgrade() -> None:
    raise NotImplementedError("Downgrade from UUID to integer PKs is not supported.")
