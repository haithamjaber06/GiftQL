import sqlite3
from app.config import DB_PATH

#The database initializing
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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
        conn.execute(
            """CREATE UNIQUE INDEX IF NOT EXISTS uniq_item ON items (norm_url, person)"""
        )
