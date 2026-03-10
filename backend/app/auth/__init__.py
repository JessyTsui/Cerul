"""Authentication stubs for private dashboard routes.

# STUB: replaced by codex/feature-db-auth
# STUB: integrate with Better Auth
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Cookie, Header, HTTPException, status


@dataclass(slots=True)
class SessionContext:
    user_id: str
    email: str | None = None


async def require_session(
    x_user_id: Annotated[str | None, Header(alias="X-User-Id")] = None,
    x_user_email: Annotated[str | None, Header(alias="X-User-Email")] = None,
    session_user_id: Annotated[str | None, Cookie(alias="cerul_user_id")] = None,
    session_email: Annotated[str | None, Cookie(alias="cerul_user_email")] = None,
) -> SessionContext:
    user_id = x_user_id or session_user_id
    email = x_user_email or session_email

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated session required.",
        )

    return SessionContext(user_id=user_id, email=email)
