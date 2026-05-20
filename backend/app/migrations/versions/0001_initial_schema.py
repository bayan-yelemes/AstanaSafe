"""Initial application schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "districts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_districts_id"), "districts", ["id"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("hashed_password", sa.String(), nullable=True),
        sa.Column("google_sub", sa.String(), nullable=True),
        sa.Column("full_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_google_sub"), "users", ["google_sub"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)

    op.create_table(
        "accidents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("date", sa.DateTime(), nullable=True),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("severity", sa.String(), nullable=True),
        sa.Column("weather", sa.String(), nullable=True),
        sa.Column("district_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["district_id"], ["districts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_accidents_id"), "accidents", ["id"], unique=False)
    op.create_index("ix_accidents_date", "accidents", ["date"], unique=False)

    op.create_table(
        "traffic_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("road", sa.String(), nullable=True),
        sa.Column("crossroad", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=True),
        sa.Column("weather", sa.String(), nullable=True),
        sa.Column("district", sa.String(), nullable=True),
        sa.Column("user_name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_traffic_reports_id"), "traffic_reports", ["id"], unique=False)
    op.create_index("ix_traffic_reports_created_at", "traffic_reports", ["created_at"], unique=False)
    op.create_index("ix_traffic_reports_location", "traffic_reports", ["lat", "lng"], unique=False)

    op.create_table(
        "real_accidents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_id", sa.String(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("accident_date_raw", sa.String(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("area_code", sa.String(), nullable=True),
        sa.Column("accident_type", sa.String(), nullable=True),
        sa.Column("road_condition", sa.String(), nullable=True),
        sa.Column("district", sa.String(), nullable=True),
        sa.Column("weather", sa.String(), nullable=True),
        sa.Column("severity", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_real_accidents_id"), "real_accidents", ["id"], unique=False)
    op.create_index(op.f("ix_real_accidents_source_id"), "real_accidents", ["source_id"], unique=True)
    op.create_index("ix_real_accidents_filters", "real_accidents", ["year", "severity", "weather"], unique=False)
    op.create_index("ix_real_accidents_location", "real_accidents", ["latitude", "longitude"], unique=False)

    op.create_table(
        "sos_incidents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lng", sa.Float(), nullable=False),
        sa.Column("accuracy_m", sa.Float(), nullable=True),
        sa.Column("road", sa.String(), nullable=True),
        sa.Column("crossroad", sa.String(), nullable=True),
        sa.Column("district", sa.String(), nullable=True),
        sa.Column("incident_type", sa.String(), nullable=False),
        sa.Column("urgency", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("reporter_name", sa.String(), nullable=True),
        sa.Column("reporter_phone", sa.String(), nullable=True),
        sa.Column("reporter_email", sa.String(), nullable=True),
        sa.Column("notification_log", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sos_incidents_id"), "sos_incidents", ["id"], unique=False)
    op.create_index(op.f("ix_sos_incidents_status"), "sos_incidents", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sos_incidents_status"), table_name="sos_incidents")
    op.drop_index(op.f("ix_sos_incidents_id"), table_name="sos_incidents")
    op.drop_table("sos_incidents")

    op.drop_index("ix_real_accidents_location", table_name="real_accidents")
    op.drop_index("ix_real_accidents_filters", table_name="real_accidents")
    op.drop_index(op.f("ix_real_accidents_source_id"), table_name="real_accidents")
    op.drop_index(op.f("ix_real_accidents_id"), table_name="real_accidents")
    op.drop_table("real_accidents")

    op.drop_index("ix_traffic_reports_location", table_name="traffic_reports")
    op.drop_index("ix_traffic_reports_created_at", table_name="traffic_reports")
    op.drop_index(op.f("ix_traffic_reports_id"), table_name="traffic_reports")
    op.drop_table("traffic_reports")

    op.drop_index("ix_accidents_date", table_name="accidents")
    op.drop_index(op.f("ix_accidents_id"), table_name="accidents")
    op.drop_table("accidents")

    op.drop_index(op.f("ix_users_phone"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_index(op.f("ix_users_google_sub"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")

    op.drop_index(op.f("ix_districts_id"), table_name="districts")
    op.drop_table("districts")
