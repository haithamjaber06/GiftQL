"""corrections fix: snapshot the LLM's answer, one jsonb row per corrected field

Existing corrections are deleted: they compared against the current value, not the
LLM's, and the LLM's original answers were never stored, so they can't be repaired.
Items saved before this migration have no snapshot; their edits aren't logged.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-14

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The LLM's parse, written once by enrich(). NULL: the LLM never answered.
    op.execute("ALTER TABLE items ADD COLUMN llm_output jsonb")

    op.execute("DELETE FROM corrections")
    # jsonb keeps types: null stays null, 12.5 stays a number.
    op.execute("""
        ALTER TABLE corrections
        ALTER COLUMN llm_value  TYPE jsonb USING NULL,
        ALTER COLUMN user_value TYPE jsonb USING NULL
    """)
    # One row per field: a later edit replaces it, a revert deletes it.
    op.execute("""
        ALTER TABLE corrections
        ADD CONSTRAINT one_correction_per_field UNIQUE (item_id, field)
    """)


def downgrade() -> None:
    # Snapshots are lost. Corrections survive as text.
    op.execute("ALTER TABLE corrections DROP CONSTRAINT one_correction_per_field")
    op.execute("""
        ALTER TABLE corrections
        ALTER COLUMN llm_value  TYPE text USING llm_value #>> '{}',
        ALTER COLUMN user_value TYPE text USING user_value #>> '{}'
    """)
    op.execute("ALTER TABLE items DROP COLUMN llm_output")
