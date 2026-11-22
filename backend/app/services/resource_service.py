"""资源服务。

对应设计书 §3.1 的 ResourceService。

职责：
- 资源详情、状态、分类、标签、来源、授权信息；
- **把 SearchCandidate 转成展示用的 ResourceCard** —— 卡片字段全部来自数据库，
  不接受模型生成的 ID、标题或 URL（设计书 §4.5 第五步）。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ResourceNotFound
from app.models.resources import (
    Resource,
    ResourceCompetition,
    ResourceExternal,
    ResourceNote,
    ResourceOfficialNotice,
    ResourceProjectCase,
)
from app.services.permission_service import UserContext, can_view_resource


def get_resource(db: Session, resource_id: str) -> Resource | None:
    return db.get(Resource, resource_id)


def require_visible_resource(
    db: Session, ctx: UserContext, resource_id: str
) -> Resource:
    """取资源并校验可见性。无权访问时返回 404 而非 403 ——
    直接报「无权限」等于确认了该资源存在，泄露信息。"""
    resource = get_resource(db, resource_id)
    if resource is None or not can_view_resource(ctx, resource):
        raise ResourceNotFound()
    return resource


def build_resource_card(
    db: Session, ctx: UserContext, resource: Resource
) -> dict[str, Any]:
    """组装展示卡片。

    字段对应设计书 §4.3「每项结果应尽可能展示标题、内容类型、简短摘要、
    相关标签、作者/来源、更新时间或有效状态，以及可访问的详情入口」。
    """
    tags = [rt.tag.name for rt in resource.tags if rt.tag]
    card: dict[str, Any] = {
        "resource_id": resource.id,
        "resource_type": resource.resource_type,
        "title": resource.title,
        "summary": resource.summary or "",
        "tags": tags,
        "author_id": resource.author_id,
        "source_type": resource.source_type,
        "source_note": resource.source_note,
        "visibility": resource.visibility,
        "license_code": resource.license_code,
        "status": resource.status,
        "difficulty": resource.difficulty,
        "updated_at": resource.updated_at.isoformat() if resource.updated_at else None,
        "published_at": (
            resource.published_at.isoformat() if resource.published_at else None
        ),
        "last_verified_at": (
            resource.last_verified_at.isoformat() if resource.last_verified_at else None
        ),
        "access_url": f"/api/resources/{resource.id}",
    }

    # 类型特有字段
    if resource.external is not None:
        card["link_status"] = resource.external.link_status
        card["url"] = resource.external.url
        card["source_platform"] = resource.external.source_platform
    if resource.competition is not None:
        card["organizer"] = resource.competition.organizer
        card["registration_start"] = (
            resource.competition.registration_start.isoformat()
            if resource.competition.registration_start
            else None
        )
        card["registration_end"] = (
            resource.competition.registration_end.isoformat()
            if resource.competition.registration_end
            else None
        )
        # 日期确定性必须带上 —— 不能把预计日期当作官方日期（设计书 §0.3）
        card["date_certainty"] = resource.competition.date_certainty
    if resource.project_case is not None:
        card["authorization_state"] = resource.project_case.authorization_state
    if resource.notice is not None:
        card["publisher_org"] = resource.notice.publisher_org
        card["importance"] = resource.notice.importance
        card["pinned"] = resource.notice.pinned
        card["expires_at"] = (
            resource.notice.expires_at.isoformat() if resource.notice.expires_at else None
        )
    if resource.note is not None:
        card["body"] = resource.note.body

    return card


def build_cards(
    db: Session, ctx: UserContext, resources: list[Resource]
) -> list[dict[str, Any]]:
    return [build_resource_card(db, ctx, r) for r in resources]


def list_resources(
    db: Session,
    ctx: UserContext,
    resource_type: str | None = None,
    status: str | None = None,
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    """列出资源。权限过滤在查询阶段完成。"""
    from app.models.resources import ResourceTag, Tag
    from app.services.permission_service import visible_resource_filter

    query = select(Resource)
    vis = visible_resource_filter(ctx)
    if vis is not None:
        query = query.where(vis)
    if resource_type:
        query = query.where(Resource.resource_type == resource_type)
    if status:
        query = query.where(Resource.status == status)
    if tag:
        query = query.join(ResourceTag).join(Tag).where(Tag.name == tag)

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()

    rows = (
        db.execute(query.order_by(Resource.updated_at.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return build_cards(db, ctx, list(rows)), int(total)
