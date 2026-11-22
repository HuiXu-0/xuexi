"""用户、角色、权限与能力位模型。

**角色模型定稿**（设计书 §12 Phase 0 补充，2026-11）：
采用「角色 + 能力位」，而不是产品设计书 §3.1 的 7 个独立角色。

    访客              → 未登录上下文（user_id IS NULL），不是角色
    学生              → 基础角色 student
    小组创建者        → 能力位 group_owner
    教师              → 基础角色 teacher
    学校内容管理员    → 能力位 content_admin
    平台管理员        → 基础角色 admin
    超级管理员        → 首期不做

这样拆的理由：小组创建者与内容管理员描述的是**能力范围**而非身份，
做成独立角色会导致「教师教师」「内容管理员内容管理员」的组合爆炸。

reviewer（内容审核职责）必须带 scope_grant —— 没有范围的审核职责
等于全站审核，那不是授权而是管理员（设计书 §12）。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # 账号状态：active / disabled / pending
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    # 违规计数与限制（设计书 §7.2 账号管理）
    violations: Mapped[int] = mapped_column(nullable=False, default=0)
    restriction: Mapped[str | None] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )
    capabilities: Mapped[list["UserCapability"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", lazy="selectin"
    )


class Role(Base):
    """基础角色：student / teacher / admin。"""

    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )
    # 持有该角色的用户（与 UserRole.role 配对）
    user_roles: Mapped[list["UserRole"]] = relationship(
        back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )


class Permission(Base):
    """可执行权限。设计书 §3.3 权限矩阵的原子化。"""

    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    scope: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)


class UserRole(Base):
    """用户 ↔ 角色 多对多。"""

    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id", name="uq_user_role"),)

    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    granted_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    user: Mapped["User"] = relationship(back_populates="roles")
    # 指向 Role.user_roles —— 不是 Role.permissions（那是 RolePermission 的关系）
    role: Mapped["Role"] = relationship(back_populates="user_roles", lazy="selectin")


class RolePermission(Base):
    """角色 ↔ 权限 多对多。"""

    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )

    role: Mapped["Role"] = relationship(back_populates="permissions")


class UserCapability(Base):
    """能力位。

    code 取值（设计书 §12 Phase 0 定稿）：
        group_owner   —— 管理自己创建的小组
        content_admin —— 校级内容管理（产品设计书 §6.5）
        reviewer      —— 内容审核职责（产品设计书 §6.4）

    scope_grant 是 reviewer 的作用域说明（学科 / 内容类型 / 组），
    存在 scope 表里，通过 scope_grant_id 关联。
    """

    __tablename__ = "user_capabilities"
    __table_args__ = (UniqueConstraint("user_id", "code", name="uq_user_capability"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    scope_grant_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("scope_grants.id", ondelete="SET NULL"), nullable=True
    )
    granted_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="capabilities")
    scope_grant: Mapped["ScopeGrant | None"] = relationship(lazy="selectin")


class ScopeGrant(Base):
    """授权范围。

    描述某个能力位的适用边界：
      - resource_types：内容类型列表
      - subject_ids：学科/领域
      - group_ids：小组
    """

    __tablename__ = "scope_grants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    resource_types: Mapped[str] = mapped_column(Text, nullable=False, default="")
    subject_ids: Mapped[str] = mapped_column(Text, nullable=False, default="")
    group_ids: Mapped[str] = mapped_column(Text, nullable=False, default="")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
