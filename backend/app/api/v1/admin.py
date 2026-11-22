"""管理端接口。

对应设计书 §7。管理员与被授权的教师在这里执行高影响操作。

**统一原则**：所有高影响操作必须带理由，且写入审计日志
（设计书 §7.2.2）。
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import DbSession, RequiredUser
from app.models.users import User
from app.services import audit_service
from app.services.permission_service import require_capability

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AccountAction(BaseModel):
    """账号高影响操作。

    **reason 必填** —— 与前端 applyAdminAction 的口径一致。
    """

    action: str = Field(description="assign/revoke/restrict/release/ban/unban/appeal")
    reason: str = Field(min_length=1, description="处理理由，不可为空")
    scope: str | None = None
    capability: str | None = None
    scope_grant_id: str | None = None


class ReportAction(BaseModel):
    action: str
    reason: str = Field(min_length=1)


@router.get("/accounts")
def list_accounts(
    ctx: RequiredUser, db: DbSession, keyword: str | None = None
) -> dict[str, Any]:
    """账号列表（仅管理员）。"""
    if not ctx.is_admin:
        raise HTTPException(status_code=403, detail="仅平台管理员可访问")

    query = db.query(User)
    if keyword:
        query = query.filter(User.display_name.like(f"%{keyword}%"))
    users = query.limit(100).all()

    return {
        "total": len(users),
        "items": [
            {
                "user_id": u.id,
                "display_name": u.display_name,
                "email": u.email,
                "status": u.status,
                "violations": u.violations,
                "restriction": u.restriction,
                "role_codes": [ur.role.code for ur in u.roles],
                "capabilities": [
                    {"code": c.code, "scope_grant_id": c.scope_grant_id}
                    for c in u.capabilities
                    if c.revoked_at is None
                ],
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
    }


@router.post("/accounts/{user_id}/action")
def account_action(
    user_id: str, payload: AccountAction, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """对账号执行高影响操作。

    **理由必填**（模型层已强制 min_length=1），
    执行后写入审计日志（设计书 §7.2.2）。
    """
    if not ctx.is_admin:
        raise HTTPException(status_code=403, detail="仅平台管理员可执行账号操作")

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="账号不存在")

    action = payload.action
    result = ""

    if action == "assign":
        # 授予能力位（角色 + 能力位模型，设计书 §12）
        from app.models.users import UserCapability
        import uuid

        if not payload.capability:
            raise HTTPException(status_code=422, detail="授予能力位必须指定 capability")
        cap = db.query(UserCapability).filter(
            UserCapability.user_id == user_id,
            UserCapability.code == payload.capability,
        ).first()
        if cap is None:
            cap = UserCapability(
                id=f"cap_{uuid.uuid4().hex[:12]}",
                user_id=user_id,
                code=payload.capability,
                scope_grant_id=payload.scope_grant_id,
                granted_by=ctx.user_id,
            )
            db.add(cap)
        else:
            cap.revoked_at = None
            cap.scope_grant_id = payload.scope_grant_id or cap.scope_grant_id
        result = f"已授予能力位「{payload.capability}」"

    elif action == "revoke":
        from app.models.users import UserCapability

        cap = db.query(UserCapability).filter(
            UserCapability.user_id == user_id,
            UserCapability.code == payload.capability,
            UserCapability.revoked_at.is_(None),
        ).first()
        if cap is None:
            raise HTTPException(status_code=404, detail="该账号没有此能力位")
        cap.revoked_at = __import__("datetime").datetime.now()
        result = f"已撤销能力位「{payload.capability}」"

    elif action == "restrict":
        user.restriction = payload.scope or "restrict_publish"
        user.violations += 1
        result = f"已限制发布（{user.restriction}）"

    elif action == "release":
        user.restriction = None
        result = "已解除限制"

    elif action == "ban":
        user.status = "disabled"
        user.violations += 1
        result = "已暂时封禁，无法登录"

    elif action == "unban":
        user.status = "active"
        user.restriction = None
        result = "已解封并恢复登录"

    elif action == "appeal":
        user.restriction = None
        user.violations = max(0, user.violations - 1)
        result = "申诉已受理，处罚已调整"

    else:
        raise HTTPException(status_code=422, detail=f"不支持的操作：{action}")

    db.commit()

    audit_service.record_audit(
        db,
        actor_type="user",
        actor_id=ctx.user_id,
        action=f"account.{action}",
        target_type="user",
        target_id=user_id,
        reason=payload.reason,
        result=result,
    )

    return {"user_id": user_id, "action": action, "result": result}


@router.get("/audit")
def list_audit(
    ctx: RequiredUser,
    db: DbSession,
    action: str | None = None,
    target_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """操作审计记录。"""
    if not ctx.is_admin:
        raise HTTPException(status_code=403, detail="仅平台管理员可查看完整审计")

    from app.models.audit import AuditEvent

    query = db.query(AuditEvent)
    if action:
        query = query.filter(AuditEvent.action == action)
    if target_id:
        query = query.filter(AuditEvent.target_id == target_id)

    total = query.count()
    events = (
        query.order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset).all()
    )
    return {
        "total": total,
        "items": [
            {
                "id": e.id,
                "actor_type": e.actor_type,
                "actor_id": e.actor_id,
                "action": e.action,
                "target_type": e.target_type,
                "target_id": e.target_id,
                "reason": e.reason,
                "result": e.result,
                "case_no": e.case_no,
                "trace_id": e.trace_id,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }
