"""管理员端：模型服务管理。

界面上是四张卡片（内置 / DeepSeek / MiniMax / 自定义），
管理员可以切换平台当前生效的模型服务、填写密钥、测试连通性。

**这是高影响操作**（设计书 §7.2.2）：
- 切换模型服务会立刻改变审核/搜索/规划三个 Agent 的行为 → 必须带理由 + 写审计
- 密钥**只写不读**：接口只回掩码，编辑时留空表示不修改
- 地址必须过 SSRF 校验（管理员也不能让服务器去打内网）
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import DbSession, RequiredUser
from app.services import audit_service, llm_service

router = APIRouter(prefix="/api/admin/llm-providers", tags=["admin-llm"])


class ProviderUpsert(BaseModel):
    """新增或更新一个模型服务。

    `api_key` 留空表示不修改现有密钥。
    """

    code: str = Field(min_length=1, max_length=64, description="稳定标识，如 builtin/custom")
    name: str = Field(min_length=1, max_length=128)
    protocol: str = Field(description="anthropic | openai")
    base_url: str = Field(min_length=1, max_length=512)
    api_key: str = Field(default="", max_length=512)
    default_model: str = Field(default="", max_length=128)
    enabled: bool = True
    sort_order: int = 100
    note: str | None = None
    reason: str = Field(min_length=1, description="变更理由，不可为空")


class ActivateRequest(BaseModel):
    reason: str = Field(min_length=1, description="切换理由，不可为空")


class ProviderAction(BaseModel):
    reason: str = Field(min_length=1, description="操作理由，不可为空")


def _require_admin(ctx) -> None:
    if not ctx.is_admin:
        raise HTTPException(status_code=403, detail="仅平台管理员可管理模型服务")


@router.get("")
def list_providers(ctx: RequiredUser, db: DbSession) -> dict[str, Any]:
    """模型服务列表（只回掩码，不回明文密钥）。"""
    _require_admin(ctx)
    providers = llm_service.list_providers(db)
    active = llm_service.get_active_provider(db)
    return {
        "total": len(providers),
        "active_id": active.id if active else None,
        "items": [llm_service.provider_public_view(p) for p in providers],
        "protocols": [
            {"value": "anthropic", "label": "Anthropic 兼容（/v1/messages）"},
            {"value": "openai", "label": "OpenAI 兼容（/v1/chat/completions）"},
        ],
    }


@router.post("")
def upsert_provider(
    payload: ProviderUpsert, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """新增或更新模型服务配置。"""
    _require_admin(ctx)
    try:
        provider = llm_service.upsert_provider(
            db,
            code=payload.code,
            name=payload.name,
            protocol=payload.protocol,
            base_url=payload.base_url,
            api_key=payload.api_key,
            default_model=payload.default_model,
            enabled=payload.enabled,
            is_builtin=payload.code == "builtin",
            sort_order=payload.sort_order,
            note=payload.note,
        )
    except llm_service.LlmConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    audit_service.record_audit(
        db,
        actor_type="admin",
        actor_id=ctx.user_id,
        action="llm_provider_upsert",
        target_type="llm_provider",
        target_id=provider.id,
        reason=payload.reason,
        result="success",
        extra={
            "code": provider.code,
            "protocol": provider.protocol,
            "base_url": provider.base_url,
            "default_model": provider.default_model,
            "api_key_changed": bool(payload.api_key),
        },
    )
    return llm_service.provider_public_view(provider)


@router.post("/{provider_id}/activate")
def activate_provider(
    provider_id: str, payload: ActivateRequest, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """切换当前生效的模型服务。"""
    _require_admin(ctx)
    before = llm_service.get_active_provider(db)
    try:
        provider = llm_service.set_active_provider(db, provider_id)
    except llm_service.LlmConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    audit_service.record_audit(
        db,
        actor_type="admin",
        actor_id=ctx.user_id,
        action="llm_provider_activate",
        target_type="llm_provider",
        target_id=provider.id,
        reason=payload.reason,
        result="success",
        extra={
            "from": before.code if before else None,
            "to": provider.code,
            "model": provider.default_model,
        },
    )
    return {
        "active": llm_service.provider_public_view(provider),
        "message": f"已切换到「{provider.name}」，后续 Agent 调用立即生效。",
    }


@router.post("/{provider_id}/test")
def test_provider(
    provider_id: str, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """连通性测试。

    测试本身不改配置，所以不要求理由；但会写一条审计（谁在什么时候测的）。
    """
    _require_admin(ctx)
    provider = llm_service.get_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="模型服务不存在")
    try:
        result = llm_service.probe(provider)
    except llm_service.LlmError as exc:
        audit_service.record_audit(
            db,
            actor_type="admin",
            actor_id=ctx.user_id,
            action="llm_provider_test",
            target_type="llm_provider",
            target_id=provider.id,
            reason="管理员手动测试连通性",
            result="failed",
            extra={"error": str(exc)[:300]},
        )
        return {"ok": False, "message": str(exc)}

    audit_service.record_audit(
        db,
        actor_type="admin",
        actor_id=ctx.user_id,
        action="llm_provider_test",
        target_type="llm_provider",
        target_id=provider.id,
        reason="管理员手动测试连通性",
        result="success",
        extra={"model": provider.default_model},
    )
    return {
        "ok": True,
        "message": f"连接正常（{provider.protocol} · {provider.default_model}）。",
        **result,
    }


@router.post("/{provider_id}/delete")
def delete_provider(
    provider_id: str, payload: ProviderAction, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """删除模型服务配置（内置卡片不可删）。

    用 POST 而不是 DELETE —— 删除要带理由（body），
    与管理端其余动作接口保持一致。
    """
    _require_admin(ctx)
    provider = llm_service.get_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=404, detail="模型服务不存在")
    code = provider.code
    try:
        llm_service.delete_provider(db, provider_id)
    except llm_service.LlmConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    audit_service.record_audit(
        db,
        actor_type="admin",
        actor_id=ctx.user_id,
        action="llm_provider_delete",
        target_type="llm_provider",
        target_id=provider_id,
        reason=payload.reason,
        result="success",
        extra={"code": code},
    )
    return {"ok": True, "message": f"已删除「{code}」。"}
