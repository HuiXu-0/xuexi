"""资源模型。

设计书 §2.3 的 `LearningResource` 统一资源抽象：
**不意味着所有内容塞进一张宽表**（设计书原文明确说了）。
采用「资源主表 + 各内容类型扩展表」。

受控词表全部对齐设计书 §2.5（并与前端 `src/data/dict.js` 一致，
由 `npm run check:vocab` 校验）：
    content_status  9 项（draft/pending/review/published/returned/hidden/removed/archived/deleted）
    visibility      4 项（private/campus/public/members）
    usage_license   5 项
    difficulty      4 项
    date_certainty  4 项
"""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Resource(Base):
    """资源主表：跨类型共有字段。"""

    __tablename__ = "resources"
    __table_args__ = (
        Index("ix_resources_type_status", "resource_type", "status"),
        Index("ix_resources_visibility", "visibility"),
        Index("ix_resources_updated", "updated_at"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    author_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # content_status（9 态）
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    # visibility（4 态）
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, default="campus")
    # usage_license —— 与 visibility 分离（设计书 §2.5）
    license_code: Mapped[str] = mapped_column(
        String(32), nullable=False, default="all_rights_reserved"
    )

    category_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)

    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # source_type：teacher / student / admin / import / official
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="student")
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # content_hash：审核案件绑定内容版本，防止审核旧版本后误放新版本（设计书 §7.3）
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # 全文检索用列：标题 + 摘要 + 标签拼成的检索文本。
    # MySQL 8.0.16+ 的 InnoDB FULLTEXT 索引要求显式建索引（schema.sql 里的
    # `ft_search_text`），中文必须用 `WITH PARSER ngram`，默认 latin parser 无效。
    ft_search_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 质量信号（设计书 §4.5 排序因子）。人工/教师标记优先于自动计算。
    quality_score: Mapped[float] = mapped_column(nullable=False, default=0.5)
    teacher_recommended: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    # 扩展表关系
    note: Mapped["ResourceNote | None"] = relationship(
        back_populates="resource", cascade="all, delete-orphan", uselist=False
    )
    external: Mapped["ResourceExternal | None"] = relationship(
        back_populates="resource", cascade="all, delete-orphan", uselist=False
    )
    project_case: Mapped["ResourceProjectCase | None"] = relationship(
        back_populates="resource", cascade="all, delete-orphan", uselist=False
    )
    competition: Mapped["ResourceCompetition | None"] = relationship(
        back_populates="resource", cascade="all, delete-orphan", uselist=False
    )
    notice: Mapped["ResourceOfficialNotice | None"] = relationship(
        back_populates="resource", cascade="all, delete-orphan", uselist=False
    )
    tags: Mapped[list["ResourceTag"]] = relationship(
        back_populates="resource", cascade="all, delete-orphan", lazy="selectin"
    )


class ResourceNote(Base):
    """平台学习笔记。"""

    __tablename__ = "resource_notes"

    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")

    resource: Mapped["Resource"] = relationship(back_populates="note")


class ResourceExternal(Base):
    """外部学习资源。"""

    __tablename__ = "resource_external_links"

    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_platform: Mapped[str | None] = mapped_column(String(128), nullable=True)
    # link_status：active / broken / redirected / unknown
    link_status: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")

    resource: Mapped["Resource"] = relationship(back_populates="external")


class ResourceProjectCase(Base):
    """优秀案例 / 实践成果。"""

    __tablename__ = "resource_project_cases"

    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    project_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    implementation_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    # authorization_state：pending / confirmed / partial / rejected
    authorization_state: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    team_members: Mapped[str | None] = mapped_column(Text, nullable=True)

    resource: Mapped["Resource"] = relationship(back_populates="project_case")


class ResourceCompetition(Base):
    """竞赛条目。"""

    __tablename__ = "resource_competitions"

    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    organizer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    official_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    registration_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    # date_certainty：official_confirmed / estimated_from_previous_year /
    #                 user_submitted_unverified / unknown
    date_certainty: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    categories: Mapped[str | None] = mapped_column(String(255), nullable=True)

    resource: Mapped["Resource"] = relationship(back_populates="competition")


class ResourceOfficialNotice(Base):
    """官方通知。"""

    __tablename__ = "resource_official_notices"

    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    publisher_org: Mapped[str | None] = mapped_column(String(128), nullable=True)
    effective_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # importance：normal / high
    importance: Mapped[str] = mapped_column(String(16), nullable=False, default="normal")
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    resource: Mapped["Resource"] = relationship(back_populates="notice")


class ForumGroup(Base):
    """学习小组 / 论坛分组。"""

    __tablename__ = "forum_groups"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    creator_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # join_policy：open / approve / course / invite（设计书 §6.2）
    join_policy: Mapped[str] = mapped_column(String(32), nullable=False, default="approve")
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, default="campus")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    # 频道结构（§5.2.3）：JSON 数组 [{key,label,enabled,count}]
    channels: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    rules: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    member_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class ForumPost(Base):
    """论坛帖子 / 回复。"""

    __tablename__ = "forum_posts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("forum_groups.id", ondelete="CASCADE"), nullable=True, index=True
    )
    parent_post_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    author_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="published")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Category(Base):
    """内容分类。"""

    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="resource")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Tag(Base):
    """标签。canonical_tag_id 指向合并后的规范标签（设计书 §7.3）。"""

    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    tag_group: Mapped[str] = mapped_column(String(32), nullable=False, default="tech")
    canonical_tag_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    __table_args__ = (UniqueConstraint("name", "tag_group", name="uq_tag_name_group"),)


class ResourceTag(Base):
    """资源 ↔ 标签 多对多。"""

    __tablename__ = "resource_tags"
    __table_args__ = (UniqueConstraint("resource_id", "tag_id", name="uq_resource_tag"),)

    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )

    resource: Mapped["Resource"] = relationship(back_populates="tags")
    tag: Mapped["Tag"] = relationship(lazy="selectin")
