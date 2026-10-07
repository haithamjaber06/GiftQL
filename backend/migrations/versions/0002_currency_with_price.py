"""currency with price: clean existing currencies, then enforce price/currency pairs

Backfill assumption: every price saved without a currency was typed in JOD.
Rows that already had a currency keep it, even if it came from the LLM.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-07

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Data first: ADD CONSTRAINT checks every existing row and fails on any violation.
    op.execute("UPDATE items SET currency = upper(trim(currency)) WHERE currency IS NOT NULL")
    op.execute("UPDATE items SET currency = NULL WHERE currency !~ '^[A-Z]{3}$'")
    op.execute("UPDATE items SET currency = NULL WHERE price IS NULL")
    op.execute("UPDATE items SET currency = 'JOD' WHERE price IS NOT NULL AND currency IS NULL")

    # ISO 4217 shape: three uppercase letters. NULL passes (no price, no currency).
    op.execute("""
        ALTER TABLE items
        ADD CONSTRAINT currency_iso CHECK (currency ~ '^[A-Z]{3}$')
    """)
    # Both or neither: a price means nothing without its currency, and vice versa.
    op.execute("""
        ALTER TABLE items
        ADD CONSTRAINT price_currency_pair CHECK ((price IS NULL) = (currency IS NULL))
    """)


def downgrade() -> None:
    # Constraints only. The cleaned values stay: original casing and which rows
    # were backfilled with JOD can't be recovered.
    op.execute("ALTER TABLE items DROP CONSTRAINT price_currency_pair")
    op.execute("ALTER TABLE items DROP CONSTRAINT currency_iso")
