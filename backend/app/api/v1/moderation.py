"""审核接口。

对应设计书 §5.9。

关键设计：
- `POST /api/moderation/check` —— 创建案件并执行审核分析，
  返回 **Agent 建议**，**不直接改内容状态**；
- 状态变更只能走 `/review`（人工复核）或后续的管理员接口。
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession, RequiredUser
from app.core.envelope import AgentEnvelope, envelope, safe_fallback
from app.models.moderation import ModerationCase
from app.services import moderation_service as svc

router = APIRouter(prefix="/api/moderation", tags=["moderation"])
AGENT_KEY = "moderation_agent"


class CheckRequest(BaseModel):
    """提交审核检查。

    content_type / content_id / content_version / snapshot 描述被审内容。
    """

    content_type: str
    content_id: str
    content_version: int = 1
    snapshot: dict[str, Any] = Field(default_factory=dict)
    submitter_id: str | None = None


class ReviewRequest(BaseModel):
    """人工处置。

    **reason 对「退回修改」「拒绝」是必填的**（设计书 §5.9、
    产品设计书 §6.4「拒绝并说明理由」）。
    """

    action: str
    reason: str = ""


class AppealRequest(BaseModel):
    reason: str = ""


@router.post("/check", response_model=AgentEnvelope)
def check(payload: CheckRequest, ctx: CurrentUser, db: DbSession) -> AgentEnvelope:
    """创建审核案件并执行分析。

    返回的是 **Agent 建议**，不是最终处置结果。
    内容状态要等人工复核后才变（设计书 §5.7）。
    """
    case = svc.create_case(
        db,
        content_type=payload.content_type,
        content_id=payload.content_id,
        content_version=payload.content_version,
        snapshot=payload.snapshot,
        submitter_id=payload.submitter_id or ctx.user_id,
    )

    # LLM 语义分析器暂未接入 —— 传入 None，走安全降级路径。
    decision = svc.analyze_case(db, case)

    warnings: list[str] = []
    if decision.produced_by == "rule_engine":
        warnings.append(
            "语义分析服务当前不可用，已按安全策略暂缓发布，不默认放行。"
        )
        return safe_fallback(
            AGENT_KEY,
            "语义分析服务不可用，内容已转人工复核。",
            case_id=case.id,
            case_status=case.status,
            decision=decision.decision,
            actual_behavior="内容已暂缓发布，等待人工复核",
        )

    return envelope(
        agent=AGENT_KEY,
        status="pending_review" if decision.decision == "REVIEW" else "success",
        data={
            "case_id": case.id,
            "decision": decision.decision,
            "risk_categories": json.loads(decision.risk_categories or "[]"),
            "risk_level": decision.risk_level,
            "evidence": json.loads(decision.evidence or "[]"),
            "uncertainty_reasons": json.loads(decision.uncertainty_reasons or "[]"),
            "rule_hits": json.loads(decision.rule_hits or "[]"),
            "reasoning": decision.reasoning,
            "rule_version": decision.rule_version,
            "model_version": decision.model_version,
            "case_status": case.status,
            "requires_human_review": decision.decision != "ALLOW",
        },
        warnings=warnings,
    )


@router.get("/cases/{case_id}")
def get_case(case_id: str, ctx: RequiredUser, db: DbSession) -> dict[str, Any]:
    """查看案件详情（含原始快照与规则版本，便于追溯）。"""
    case = db.get(ModerationCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="审核案件不存在")
    if not (ctx.is_admin or ctx.is_teacher or case.submitter_id == ctx.user_id):
        raise HTTPException(status_code=403, detail="无权查看该案件")

    return {
        "case_id": case.id,
        "content_type": case.content_type,
        "content_id": case.content_id,
        "content_version": case.content_version,
        "content_hash": case.content_hash,
        "snapshot": json.loads(case.snapshot or "{}"),
        "status": case.status,
        "submitter_id": case.submitter_id,
        "assigned_reviewer_id": case.assigned_reviewer_id,
        "created_at": case.created_at.isoformat(),
        "decisions": [
            {
                "decision": d.decision,
                "risk_categories": json.loads(d.risk_categories or "[]"),
                "risk_level": d.risk_level,
                "evidence": json.loads(d.evidence or "[]"),
                "rule_hits": json.loads(d.rule_hits or "[]"),
                "reasoning": d.reasoning,
                "rule_version": d.rule_version,
                "model_version": d.model_version,
                "produced_by": d.produced_by,
                "created_at": d.created_at.isoformat(),
            }
            for d in case.decisions
        ],
    }


@router.post("/cases/{case_id}/review")
def review(
    case_id: str, payload: ReviewRequest, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """人工处置。

    **这是唯一能改变内容状态的入口**（设计书 §5.9）。
    教师的动作会被限制在 §5.12 的 5 种之内，且校验授权范围。
    """
    case = db.get(ModerationCase, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="审核案件不存在")

    actor_type = "admin" if ctx.is_admin else "teacher"
    agent_decision = case.decisions[-1].decision if case.decisions else None

    try:
        result = svc.apply_review_action(
            db,
            case=case,
            actor_id=ctx.user_id or "",
            actor_type=actor_type,
            action=payload.action,
            reason=payload.reason,
            agent_decision=agent_decision,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return result


@router.get("/admin/queue")
def admin_queue(
    ctx: RequiredUser,
    db: DbSession,
    status: str | None = None,
    content_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """管理员复核队列。

    **过滤在服务端按授权范围完成**（设计书 §5.12）。
    """
    if not ctx.is_admin:
        raise HTTPException(status_code=403, detail="仅平台管理员可访问全站队列")

    cases, total = svc.list_cases(
        db,
        status=status,
        content_type=content_type,
        limit=limit,
        offset=offset,
    )
    return {
        "total": total,
        "items": [
            {
                "case_id": c.id,
                "content_type": c.content_type,
                "content_id": c.content_id,
                "content_version": c.content_version,
                "status": c.status,
                "submitter_id": c.submitter_id,
                "created_at": c.created_at.isoformat(),
                "agent_decision": c.decisions[-1].decision if c.decisions else None,
            }
            for c in cases
        ],
    }


@router.get("/teacher/queue")
def teacher_queue(
    ctx: RequiredUser,
    db: DbSession,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """教师待审核队列。

    只返回该教师**授权范围内**的案件（设计书 §5.12）。
    """
    scope = ctx.capability_scope("reviewer")
    if not ctx.has_capability("reviewer"):
        raise HTTPException(status_code=403, detail="未被授予内容审核职责")

    allowed_types = scope.get("resource_types") or []
    cases, total = svc.list_cases(
        db, status=status, limit=limit, offset=offset
    )
    # 服务端按范围过滤 —— 不能把全站案件取出来再在前端过滤
    filtered = [c for c in cases if c.content_type in allowed_types]
    return {
        "total": len(filtered),
        "scope": scope,
        "items": [
            {
                "case_id": c.id,
                "content_type": c.content_type,
                "content_id": c.content_id,
                "status": c.status,
                "created_at": c.created_at.isoformat(),
            }
            for c in filtered
        ],
    }
