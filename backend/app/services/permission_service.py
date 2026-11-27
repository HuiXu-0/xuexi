"""权限服务。

**这是整个后端的安全边界**（设计书 §9.1）。

原则：
1. 权限判断必须由后端完成，不能依赖模型的自然语言判断；
2. 前端传来的 role / is_admin 不可信 —— 用户上下文由服务端解析；
3. 私有资源不能通过 API、搜索、摘要或关联关系泄露
   —— 检索阶段过滤 + 返回前二次校验（设计书 §4.5 第三步）；
4. 能力位（reviewer / content_admin / group_owner）与其 scope_grant 绑定，
   没有范围的授权等于没有授权。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import PermissionDenied
from app.models.resources import Resource
from app.models.users import User, UserCapability


@dataclass
class UserContext:
    """服务端解析出的用户上下文。

    **前端永远不能自己声明这些字段**（设计书 §9.1）。
    """

    user_id: str | None
    display_name: str = "访客"
    role_codes: list[str] = field(default_factory=list)
    permission_codes: set[str] = field(default_factory=set)
    capabilities: dict[str, dict[str, Any]] = field(default_factory=dict)
    is_authenticated: bool = False

    @property
    def is_admin(self) -> bool:
        return "admin" in self.role_codes

    @property
    def is_teacher(self) -> bool:
        return "teacher" in self.role_codes or self.is_admin

    @property
    def is_student(self) -> bool:
        return "student" in self.role_codes

    def has_capability(self, code: str) -> bool:
        return code in self.capabilities

    def capability_scope(self, code: str) -> dict[str, Any]:
        return self.capabilities.get(code, {})


def load_user_context(db: Session, user_id: str | None) -> UserContext:
    """从数据库加载用户上下文。

    访客（user_id 为 None）返回未认证上下文 —— 只有 public 可见范围的内容可访问。
    """
    if not user_id:
        return UserContext(user_id=None)

    user = db.get(User, user_id)
    if user is None or user.status != "active":
        return UserContext(user_id=None)

    role_codes = [ur.role.code for ur in user.roles]
    permission_codes: set[str] = set()
    for ur in user.roles:
        for rp in ur.role.permissions:
            permission_codes.add(rp.permission_id)

    capabilities: dict[str, dict[str, Any]] = {}
    for cap in user.capabilities:
        if cap.revoked_at is not None:
            continue
        scope: dict[str, Any] = {}
        if cap.scope_grant is not None:
            scope = {
                "label": cap.scope_grant.label,
                "resource_types": [
                    t for t in cap.scope_grant.resource_types.split(",") if t
                ],
                "subject_ids": [t for t in cap.scope_grant.subject_ids.split(",") if t],
                "group_ids": [t for t in cap.scope_grant.group_ids.split(",") if t],
            }
        capabilities[cap.code] = scope

    return UserContext(
        user_id=user.id,
        display_name=user.display_name,
        role_codes=role_codes,
        permission_codes=permission_codes,
        capabilities=capabilities,
        is_authenticated=True,
    )


# ══════════════════════════════════════════════════════════════
# 可见性判定
# ══════════════════════════════════════════════════════════════


def can_view_resource(ctx: UserContext, resource: Resource) -> bool:
    """判断用户能否查看该资源。

    对应设计书 §2.5 的 visibility 四态：
    - private   → 仅作者本人（及管理员在处理事项范围内）
    - campus    → 全体已登录校内用户
    - public    → 任何人（含访客）
    - members   → 指定小组/成员的成员（基于关系，需额外判断）
    """
    if resource.visibility == "public":
        return True

    if not ctx.is_authenticated:
        return False

    # 管理员在处理事项所需范围内可访问（设计书 §3.3 权限矩阵）
    if ctx.is_admin:
        return True

    if resource.visibility == "campus":
        return True

    if resource.visibility == "private":
        return resource.author_id == ctx.user_id

    if resource.visibility == "members":
        # 基于关系的可见性：作者 + 已加入该资源所属小组的成员。
        # 小组关系由调用方补充判定（见 resource_service 的成员检查）。
        return resource.author_id == ctx.user_id

    return False


def visible_resource_filter(ctx: UserContext):
    """生成 SQL 过滤条件，用于检索阶段「尽早过滤」（设计书 §4.5 第三步）。

    **必须在检索阶段过滤，不能只在前端隐藏** ——
    标题、摘要、数量和作者信息本身也可能泄露隐私。

    **返回约定**（两个调用方都按「单个 SQL 表达式或 None」使用）：
    - 访客 → 单个等值条件
    - 管理员 → **None**（不加限制）
    - 普通登录用户 → 一组条件的 OR 组合

    ⚠️ 早前这里返回的是 **list**，调用方直接 `.where(vis)` 会报
    `ArgumentError: SQL expression for WHERE/HAVING role expected, got [...]`。
    现在统一用 `or_(...)` 包成单个表达式。
    """
    if not ctx.is_authenticated:
        return Resource.visibility == "public"

    if ctx.is_admin:
        return None  # 管理员不加限制

    clauses = [Resource.visibility.in_(["public", "campus"])]
    # 作者本人可见自己的 private / members 内容
    clauses.append(
        (Resource.author_id == ctx.user_id) & (Resource.visibility.in_(["private", "members"]))
    )
    return or_(*clauses)


def require_permission(ctx: UserContext, code: str) -> None:
    if code not in ctx.permission_codes:
        raise PermissionDenied(f"当前用户缺少权限：{code}")


def require_capability(ctx: UserContext, code: str) -> dict[str, Any]:
    """要求用户拥有某能力位。"""
    if not ctx.has_capability(code):
        raise PermissionDenied(f"当前用户未被授予「{code}」能力。")
    return ctx.capability_scope(code)


def require_resource_type_in_scope(scope: dict[str, Any], resource_type: str) -> bool:
    """判断资源类型是否在授权范围内。

    scope 为空表示未限定范围 —— 但 reviewer 必须有范围（设计书 §12），
    没有范围的审核职责等于全站审核。调用方应先用 require_capability 校验。
    """
    types = scope.get("resource_types") or []
    if not types:
        return False
    return resource_type in types


def parse_json_field(raw: str | None, default: Any = None) -> Any:
    if not raw:
        return default if default is not None else []
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default if default is not None else []
