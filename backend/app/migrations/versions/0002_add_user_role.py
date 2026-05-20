"""Add user role.

Revision ID: 0002_add_user_role
Revises: 0001_initial_schema
Create Date: 2026-05-10
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002_add_user_role"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users "
        "ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'driver' NOT NULL"
    )
    op.execute(
        "UPDATE users SET role = 'driver' "
        "WHERE role IS NULL OR role NOT IN ('driver', 'dispatcher', 'admin')"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS role")
