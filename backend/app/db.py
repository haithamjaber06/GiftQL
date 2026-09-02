import sqlite3
from contextlib import contextmanager

from app.config import DB_PATH


# The database initializing.
# A context manager, so `with db() as conn:` now commits on success,
# rolls back on error, and ALWAYS closes the connection.
@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()

def add_column(conn, table, column, coltype):
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
        print(f"migrated: added {table}.{column}")

#Schema and Unique Index Creation
def init_db():
    with db() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id    INTEGER PRIMARY KEY,
            url   TEXT,
            title TEXT,
            person TEXT,
            img_url TEXT,
            norm_url TEXT,
            status TEXT,
            price DECIMAL,
            occasion TEXT
        )
    """)
        
        add_column(conn, "items", "kind", "TEXT")
        add_column(conn, "items", "raw_title", "TEXT")
        add_column(conn, "items", "description", "TEXT")
        add_column(conn, "items", "labels", "TEXT")
        add_column(conn, "items", "currency", "TEXT")
        
        conn.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS uniq_item ON items (norm_url, person)"""
        )

        conn.execute("""
        CREATE TABLE IF NOT EXISTS corrections (
            id           INTEGER PRIMARY KEY,
            item_id      INTEGER,
            field        TEXT,
            llm_value    TEXT,
            user_value   TEXT,
            corrected_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
