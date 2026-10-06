"""baseline: items and corrections as they existed before migrations

Copied from the production table definitions in Supabase (2026-10-06).
Existing databases already have this schema: run `alembic stamp 0001` on them,
never `upgrade`. Only fresh databases should run this migration.

Revision ID: 0001
Revises:
Create Date: 2026-10-06

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE items (
            id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            url         text NOT NULL,
            norm_url    text NOT NULL,
            person      text NOT NULL DEFAULT '',
            title       text,
            raw_title   text,
            description text,
            img_url     text,
            status      text NOT NULL DEFAULT 'Pending',
            kind        text,
            price       numeric(10, 2),
            currency    text,
            occasion    text NOT NULL DEFAULT '',
            labels      jsonb NOT NULL DEFAULT '[]'::jsonb,
            created_at  timestamptz NOT NULL DEFAULT now()
        )
    """)
    # Same link may be saved once per person (see scraper.normalize).
    op.execute("CREATE UNIQUE INDEX uniq_item ON items (norm_url, person)")

    op.execute("""
        CREATE TABLE corrections (
            id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            item_id      integer NOT NULL REFERENCES items (id) ON DELETE CASCADE,
            field        text NOT NULL,
            llm_value    text,
            user_value   text,
            corrected_at timestamptz NOT NULL DEFAULT now()
        )
    """)

    # RLS on with no policies: Supabase's public API roles see nothing; the app
    # connects as the table owner, which bypasses RLS.
    op.execute("ALTER TABLE items ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE corrections ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    # Destroys all data. corrections references items, so it goes first.
    op.execute("DROP TABLE corrections")
    op.execute("DROP TABLE items")
