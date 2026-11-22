"""认证接口。

登录返回 JWT。前端存不住真正的权限 —— 权限判定在服务端做，
token 只携带身份标识，角色在每次请求时从数据库重新解析
（这样管理员撤销角色后立即生效，不需要等 token 过期）。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import DbSession, RequiredUser
from app.models.users import User, UserRole
from app.services.auth_service import create_access_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    """登录请求。

    **注意**：不接收 role 字段。角色由服务端根据账号实际拥有的角色决定
    （设计书 §9.1：前端传入的角色不可信）。
    """

    account: str = Field(min_length=1, max_length=128, description="用户名或邮箱")
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    display_name: str
    role_codes: list[str]
    capabilities: list[str]


class MeResponse(BaseModel):
    user_id: str
    display_name: str
    role_codes: list[str]
    capabilities: list[str]
    is_authenticated: bool = True


def _role_codes(db: Session, user: User) -> list[str]:
    rows = db.execute(
        select(UserRole).where(UserRole.user_id == user.id)
    ).scalars().all()
    return [ur.role.code for ur in rows]


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: DbSession) -> LoginResponse:
    account = payload.account.strip()
    user = db.execute(
        select(User).where(
            (User.display_name == account) | (User.email == account)
        )
    ).scalar_one_or_none()

    # 用户不存在与密码错误返回同一个提示，避免暴露账号是否存在
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="账号或密码不正确")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="该账号已被停用")

    roles = _role_codes(db, user)
    token = create_access_token(user.id, roles)
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        display_name=user.display_name,
        role_codes=roles,
        capabilities=[c.code for c in user.capabilities if c.revoked_at is None],
    )


@router.get("/me", response_model=MeResponse)
def me(ctx: RequiredUser, db: DbSession) -> MeResponse:
    """当前身份。前端用它校验登录态是否仍然有效。"""
    return MeResponse(
        user_id=ctx.user_id or "",
        display_name=ctx.display_name,
        role_codes=ctx.role_codes,
        capabilities=list(ctx.capabilities.keys()),
    )
