"""认证服务。

**为什么必须做**：前端现在的 `canAccess()` 只是路由拦截，
role 存在 localStorage 里，改一下就能进管理员端。
后端的 PermissionService 才是唯一的权限判定点（设计书 §9.1、§16.1）。
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings
from app.core.errors import AuthRequired
from app.models.users import User

_settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(raw, hashed)
    except Exception:
        return False


def create_access_token(user_id: str, role_codes: list[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "roles": role_codes,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=_settings.access_token_expire_minutes)).timestamp()),
        "jti": uuid.uuid4().hex[:16],
    }
    return jwt.encode(payload, _settings.secret_key, algorithm=_settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, _settings.secret_key, algorithms=[_settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthRequired("登录已过期，请重新登录。") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthRequired("登录凭证无效。") from exc


def user_id_from_token(token: str) -> str:
    payload = decode_access_token(token)
    sub = payload.get("sub")
    if not sub:
        raise AuthRequired("登录凭证缺少用户标识。")
    return str(sub)
