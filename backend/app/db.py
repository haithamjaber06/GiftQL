import sqlite3
from app.config import DB_PATH

#The database initializing
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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
