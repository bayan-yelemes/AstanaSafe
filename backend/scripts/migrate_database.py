from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from app.database import engine


BASE_DIR = Path(__file__).resolve().parents[1]
APP_TABLES = {
    "accidents",
    "districts",
    "real_accidents",
    "sos_incidents",
    "traffic_reports",
    "users",
}

TRAFFIC_REPORT_DETAIL_COLUMNS = {
    "duration_minutes": "INTEGER",
    "traffic_flow": "VARCHAR",
    "lanes_blocked": "VARCHAR",
    "notes": "VARCHAR",
}


def get_alembic_config() -> Config:
    config = Config(str(BASE_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BASE_DIR / "app" / "migrations"))
    return config


def patch_legacy_schema(connection) -> None:
    inspector = inspect(connection)
    table_names = set(inspector.get_table_names())

    if "users" not in table_names:
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "role" not in user_columns:
        connection.execute(
            text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'driver' NOT NULL")
        )

    connection.execute(
        text(
            "UPDATE users SET role = 'driver' "
            "WHERE role IS NULL OR role NOT IN ('driver', 'dispatcher', 'admin')"
        )
    )

    if "traffic_reports" in table_names:
        traffic_report_columns = {
            column["name"] for column in inspector.get_columns("traffic_reports")
        }

        for column_name, column_type in TRAFFIC_REPORT_DETAIL_COLUMNS.items():
            if column_name not in traffic_report_columns:
                connection.execute(
                    text(
                        f"ALTER TABLE traffic_reports "
                        f"ADD COLUMN {column_name} {column_type}"
                    )
                )

    if "sos_incidents" in table_names:
        sos_columns = {column["name"] for column in inspector.get_columns("sos_incidents")}
        if "reporter_user_id" not in sos_columns:
            connection.execute(
                text("ALTER TABLE sos_incidents ADD COLUMN reporter_user_id INTEGER")
            )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_sos_incidents_reporter_user_id "
                "ON sos_incidents (reporter_user_id)"
            )
        )

    if "password_reset_tokens" not in table_names:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    used_at TIMESTAMP NULL,
                    created_at TIMESTAMP NOT NULL
                )
                """
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_id "
                "ON password_reset_tokens (id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id "
                "ON password_reset_tokens (user_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash "
                "ON password_reset_tokens (token_hash)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_expires_at "
                "ON password_reset_tokens (expires_at)"
            )
        )


def main() -> None:
    config = get_alembic_config()
    should_stamp_legacy_database = False

    with engine.begin() as connection:
        table_names = set(inspect(connection).get_table_names())
        has_app_tables = bool(table_names & APP_TABLES)
        has_alembic_version = "alembic_version" in table_names

        if has_app_tables and not has_alembic_version:
            patch_legacy_schema(connection)
            should_stamp_legacy_database = True

    if should_stamp_legacy_database:
        command.stamp(config, "head")
    else:
        command.upgrade(config, "head")


if __name__ == "__main__":
    main()
