"""enable_rls_on_all_tables

Revision ID: e28b7a7bc743
Revises: 97e378d0521a
Create Date: 2026-04-10 22:02:56.849295

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'e28b7a7bc743'
down_revision: Union[str, None] = '97e378d0521a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    tables = [
        "users", "airports", "password_resets", "monitor_tasks", 
        "flight_cache", "price_history", "predictive_search_records", 
        "transaction_history", "email_verifications", "alembic_version", 
        "admin_audit_log", "admin_budget", "api_usage_log", "api_cost_record", 
        "system_config", "monitor_activity_log", "push_tokens", "refresh_tokens"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    tables = [
        "users", "airports", "password_resets", "monitor_tasks", 
        "flight_cache", "price_history", "predictive_search_records", 
        "transaction_history", "email_verifications", "alembic_version", 
        "admin_audit_log", "admin_budget", "api_usage_log", "api_cost_record", 
        "system_config", "monitor_activity_log", "push_tokens", "refresh_tokens"
    ]
    for table in tables:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
