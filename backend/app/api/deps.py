"""API 依赖。

**关键**：用户上下文由服务端解析，前端传来的任何身份声明都不可信
（设计书 §9.1）。
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AuthRequired
from app.services.auth_service import user_id_from_token
from app.services.permission_service import UserContext, load_user_context

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> UserContext:
    """解析当前用户上下文。

    未带凭证时返回**访客上下文**（不是抛错）——
    公开内容对访客可见，这是设计书 §3.1「访客：浏览允许公开的内容」。
    """
    if not authorization:
        return load_user_context(db, None)

    token = authorization.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()

    user_id = user_id_from_token(token)
    ctx = load_user_context(db, user_id)
    if not ctx.is_authenticated:
        raise AuthRequired()
    return ctx


CurrentUser = Annotated[UserContext, Depends(get_current_user)]


def get_required_user(ctx: CurrentUser) -> UserContext:
    """要求必须登录（写操作用）。"""
    if not ctx.is_authenticated:
        raise AuthRequired()
    return ctx


RequiredUser = Annotated[UserContext, Depends(get_required_user)]
