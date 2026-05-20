import argparse
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import DateTime, create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.sql.schema import Table


BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE_PATH = BASE_DIR / "astanasafe.db"
BATCH_SIZE = 1000

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy the existing astanasafe SQLite data into PostgreSQL."
    )
    parser.add_argument(
        "--sqlite-path",
        default=str(DEFAULT_SQLITE_PATH),
        help="Path to the source SQLite database.",
    )
    parser.add_argument(
        "--database-url",
        help="Target PostgreSQL URL. Defaults to DATABASE_URL from .env.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Truncate target PostgreSQL tables before importing.",
    )
    return parser.parse_args()


def normalize_postgres_url(database_url: str | None) -> str:
    if not database_url:
        raise SystemExit("DATABASE_URL is not set.")

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

    if database_url.startswith("sqlite"):
        raise SystemExit("Target DATABASE_URL must point to PostgreSQL, not SQLite.")

    return database_url


def parse_datetime(value: Any) -> Any:
    if value is None or isinstance(value, datetime):
        return value

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return value

    return value


def sqlite_table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    query = "select 1 from sqlite_master where type = 'table' and name = ?"
    return conn.execute(query, (table_name,)).fetchone() is not None


def row_to_dict(row: sqlite3.Row, table: Table) -> dict[str, Any]:
    row_keys = set(row.keys())
    result: dict[str, Any] = {}

    for column in table.columns:
        if column.name not in row_keys:
            continue

        value = row[column.name]
        if isinstance(column.type, DateTime):
            value = parse_datetime(value)

        result[column.name] = value

    return result


def iter_table_batches(
    sqlite_conn: sqlite3.Connection,
    table: Table,
    batch_size: int = BATCH_SIZE,
):
    cursor = sqlite_conn.execute(f'select * from "{table.name}"')

    while True:
        rows = cursor.fetchmany(batch_size)
        if not rows:
            break
        yield [row_to_dict(row, table) for row in rows]


def quote_table(engine: Engine, table_name: str) -> str:
    return engine.dialect.identifier_preparer.quote(table_name)


def truncate_tables(engine: Engine, tables: list[Table]) -> None:
    if not tables:
        return

    table_names = ", ".join(quote_table(engine, table.name) for table in tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE"))


def reset_id_sequences(engine: Engine, tables: list[Table]) -> None:
    with engine.begin() as conn:
        for table in tables:
            if "id" not in table.columns:
                continue

            table_name = table.name
            quoted_table = quote_table(engine, table_name)
            sequence_name = conn.execute(
                text("select pg_get_serial_sequence(:table_name, 'id')"),
                {"table_name": f"public.{table_name}"},
            ).scalar()

            if not sequence_name:
                continue

            conn.execute(
                text(
                    "select setval("
                    "cast(:sequence_name as regclass), "
                    f"coalesce((select max(id) from {quoted_table}), 1), "
                    f"(select count(*) from {quoted_table}) > 0"
                    ")"
                ),
                {"sequence_name": sequence_name},
            )


def main() -> None:
    args = parse_args()

    load_dotenv(BASE_DIR / ".env")
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url

    database_url = normalize_postgres_url(os.getenv("DATABASE_URL"))
    os.environ["DATABASE_URL"] = database_url

    from app.database import Base
    from app.models import models as _models  # noqa: F401

    sqlite_path = Path(args.sqlite_path)
    if not sqlite_path.exists():
        raise SystemExit(f"SQLite database not found: {sqlite_path}")

    target_engine = create_engine(database_url, pool_pre_ping=True)
    if target_engine.url.get_backend_name() != "postgresql":
        raise SystemExit("Target DATABASE_URL must use the PostgreSQL dialect.")

    Base.metadata.create_all(bind=target_engine)

    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    try:
        source_tables = [
            table
            for table in Base.metadata.sorted_tables
            if sqlite_table_exists(sqlite_conn, table.name)
        ]

        if args.replace:
            truncate_tables(target_engine, list(reversed(source_tables)))

        inspector = inspect(target_engine)
        target_tables = set(inspector.get_table_names())

        with target_engine.begin() as target_conn:
            for table in source_tables:
                if table.name not in target_tables:
                    print(f"Skipping {table.name}: missing in PostgreSQL")
                    continue

                inserted = 0
                for batch in iter_table_batches(sqlite_conn, table):
                    if not batch:
                        continue
                    target_conn.execute(table.insert(), batch)
                    inserted += len(batch)

                print(f"{table.name}: copied {inserted} rows")

        reset_id_sequences(target_engine, source_tables)
    finally:
        sqlite_conn.close()
        target_engine.dispose()


if __name__ == "__main__":
    main()
