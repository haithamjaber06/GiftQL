"""Alembic environment.

The database URL comes from app.config (i.e. DATABASE_URL from .env or the host's
environment), so there is one source of truth. There are no SQLAlchemy models in this
project, so target_metadata stays None and every migration is written by hand.
"""
from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context

from app.config import DATABASE_URL

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None


def sqlalchemy_url(url: str) -> str:
    """Point SQLAlchemy at the psycopg 3 driver.

    Plain postgres:// or postgresql:// URLs make SQLAlchemy look for psycopg2,
    which is not installed.
    """
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


URL = sqlalchemy_url(DATABASE_URL)


def run_migrations_offline() -> None:
    """Emit the migration SQL to stdout instead of running it (alembic upgrade --sql)."""
    context.configure(
        url=URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against the live database, all in one transaction."""
    connectable = create_engine(
        URL,
        poolclass=pool.NullPool,
        # Prepared statements break behind Supabase's transaction-mode pooler (:6543).
        connect_args={"prepare_threshold": None},
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
