"""资源接口。

对应设计书 §3.1 的 ResourceService 对外暴露的部分。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession, RequiredUser
from app.services import resource_service as svc

router = APIRouter(prefix="/api/resources", tags=["resources"])


class ResourceCreate(BaseModel):
    resource_type: str
    title: str = Field(min_length=1, max_length=255)
    summary: str = ""
    body: str = ""
    visibility: str = "campus"
    license_code: str = "all_rights_reserved"
    difficulty: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_type: str = "student"
    source_note: str | None = None


@router.get("")
def list_resources(
    ctx: CurrentUser,
    db: DbSession,
    resource_type: str | None = None,
    status: str | None = None,
    tag: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """列出资源。权限过滤在服务端完成。"""
    items, total = svc.list_resources(
        db,
        ctx,
        resource_type=resource_type,
        status=status,
        tag=tag,
        limit=limit,
        offset=offset,
    )
    return {"total": total, "items": items, "limit": limit, "offset": offset}


@router.get("/{resource_id}")
def get_resource(resource_id: str, ctx: CurrentUser, db: DbSession) -> dict[str, Any]:
    """资源详情。无权访问时返回 404（不泄露资源是否存在）。"""
    resource = svc.require_visible_resource(db, ctx, resource_id)
    return svc.build_resource_card(db, ctx, resource)


@router.post("", status_code=201)
def create_resource(
    payload: ResourceCreate, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """创建资源。

    新建内容进入 `draft` 状态，需要走审核流程才能发布
    （设计书 §5.4 的流水线）。
    """
    import uuid

    from app.models.resources import Resource, ResourceNote, ResourceTag, Tag

    resource = Resource(
        id=f"res_{uuid.uuid4().hex[:12]}",
        resource_type=payload.resource_type,
        title=payload.title,
        summary=payload.summary,
        author_id=ctx.user_id,
        created_by=ctx.user_id,
        status="draft",
        visibility=payload.visibility,
        license_code=payload.license_code,
        difficulty=payload.difficulty,
        source_type=payload.source_type,
        source_note=payload.source_note,
        version=1,
        ft_search_text=f"{payload.title} {payload.summary} {' '.join(payload.tags)}",
        created_at=__import__("datetime").datetime.now(),
        updated_at=__import__("datetime").datetime.now(),
    )
    db.add(resource)

    if payload.body:
        db.add(ResourceNote(resource_id=resource.id, body=payload.body))

    for tag_name in payload.tags:
        tag = db.query(Tag).filter(Tag.name == tag_name).first()
        if tag is None:
            tag = Tag(
                id=f"tag_{uuid.uuid4().hex[:8]}",
                name=tag_name,
                tag_group="tech",
                status="active",
            )
            db.add(tag)
            db.flush()
        db.add(ResourceTag(resource_id=resource.id, tag_id=tag.id))

    db.commit()
    db.refresh(resource)
    return svc.build_resource_card(db, ctx, resource)
