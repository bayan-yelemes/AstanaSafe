"""Add password reset tokens.

Revision ID: 0003_add_password_reset_tokens
Revises: 0002_add_user_role
Create Date: 2026-05-12
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0003_add_password_reset_tokens"
down_revision: Union[str, None] = "0002_add_user_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
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
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_id "
        "ON password_reset_tokens (id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id "
        "ON password_reset_tokens (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash "
        "ON password_reset_tokens (token_hash)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_expires_at "
        "ON password_reset_tokens (expires_at)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS password_reset_tokens")
