"""Add traffic report details.

Revision ID: 0004_add_traffic_report_details
Revises: 0003_add_password_reset_tokens
Create Date: 2026-05-13
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0004_add_traffic_report_details"
down_revision: Union[str, None] = "0003_add_password_reset_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE traffic_reports "
        "ADD COLUMN IF NOT EXISTS duration_minutes INTEGER"
    )
    op.execute(
        "ALTER TABLE traffic_reports "
        "ADD COLUMN IF NOT EXISTS traffic_flow VARCHAR"
    )
    op.execute(
        "ALTER TABLE traffic_reports "
        "ADD COLUMN IF NOT EXISTS lanes_blocked VARCHAR"
    )
    op.execute(
        "ALTER TABLE traffic_reports "
        "ADD COLUMN IF NOT EXISTS notes VARCHAR"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE traffic_reports DROP COLUMN IF EXISTS notes")
    op.execute("ALTER TABLE traffic_reports DROP COLUMN IF EXISTS lanes_blocked")
    op.execute("ALTER TABLE traffic_reports DROP COLUMN IF EXISTS traffic_flow")
    op.execute("ALTER TABLE traffic_reports DROP COLUMN IF EXISTS duration_minutes")
