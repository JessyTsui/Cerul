"""Database dependency stubs for isolated task worktrees.

# STUB: replaced by codex/feature-db-auth
"""

from __future__ import annotations

from typing import Any

from fastapi import Request


async def get_db(request: Request) -> Any:
    db = getattr(request.app.state, "db", None)
    if db is None:
        raise RuntimeError("Database dependency is not configured.")
    return db
