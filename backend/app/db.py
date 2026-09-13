from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.config import DATABASE_URL

pool = ConnectionPool(
    conninfo = DATABASE_URL,
    min_size = 1,
    max_size = 5,
    kwargs={"row_factory": dict_row},
    open=False,
)

@contextmanager
def db():
    """Borrow a connection from the pool.
    Commits when the block finishes cleanly, rolls back if it raises, and always hands the connection back.
    """
    with pool.connection() as conn:
        yield conn