"""Add reporter user id to SOS incidents.

Revision ID: 0005_add_sos_reporter_user_id
Revises: 0004_add_traffic_report_details
Create Date: 2026-05-19
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0005_add_sos_reporter_user_id"
down_revision: Union[str, None] = "0004_add_traffic_report_details"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sos_incidents "
        "ADD COLUMN IF NOT EXISTS reporter_user_id INTEGER"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sos_incidents_reporter_user_id "
        "ON sos_incidents (reporter_user_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_sos_incidents_reporter_user_id")
    op.execute("ALTER TABLE sos_incidents DROP COLUMN IF EXISTS reporter_user_id")
