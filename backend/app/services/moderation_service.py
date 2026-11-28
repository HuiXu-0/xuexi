"""审核流程服务。

对应设计书 §5.4 的流水线与 §5.7 的决策表。

**核心原则：模型分析结果与内容状态流转分离**（设计书 §5.7）。
Agent 只产生建议；状态变更由本服务在确认权限、案件状态和操作理由后执行。

决策表（设计书 §5.7）：
    未命中规则、语义风险低        → ALLOW
    语义不确定或存在争议        → REVIEW
    明确命中已启用的硬性规则    → REJECT
    模型超时/格式错误/服务异常  → FAILED_SAFE / REVIEW（暂缓发布，不默认放行）
    附件未扫描                  → 按附件策略处理，明确显示未检查范围
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import SafeFallbackRequired
from app.models.moderation import (
    ModerationCase,
    ModerationDecision,
    ModerationReview,
    ModerationRule,
)
from app.models.resources import Resource
from app.services.audit_service import record_audit
from app.services.moderation_rules import (
    DeterministicResult,
    RuleHit,
    check_deterministic,
    get_enabled_rules,
)

_settings = get_settings()


def _active_model_name() -> str | None:
    """当前生效的模型服务与模型名，写进决策记录做归因。

    模型服务是管理员可切换的（llm_providers 表），所以这里动态取，
    不能用环境变量里那个固定的 llm_model。
    """
    try:
        from app.services.llm_service import get_active_provider

        provider = get_active_provider(SessionLocal())
        if provider is None:
            return None
        return f"{provider.code}:{provider.default_model}"
    except Exception:
        return None

# ── 教师处置动作（产品设计书 §6.4，5 种）────────────────────
TEACHER_ACTIONS = {
    "approve": ("通过", "published"),
    "return": ("退回修改", "returned"),
    "defer": ("暂缓并转交", None),  # 状态不变，案件转交
    "hide": ("隐藏待核实", "hidden"),
    "reject": ("拒绝并说明理由", "removed"),
}

# 管理员处置动作（额外含账号与规则类操作，但那些走别的接口）
ADMIN_CONTENT_ACTIONS = {
    **TEACHER_ACTIONS,
    "dismiss": ("举报不成立", None),
    "restore": ("恢复内容", "published"),
}


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


def create_case(
    db: Session,
    *,
    content_type: str,
    content_id: str,
    content_version: int,
    snapshot: dict[str, Any],
    submitter_id: str | None,
    trace_id: str | None = None,
) -> ModerationCase:
    """创建审核案件 + 内容快照。

    **案件绑定内容版本与哈希** —— 防止审核旧版本后误放新版本（设计书 §7.3）。
    """
    snapshot_text = json.dumps(snapshot, ensure_ascii=False, sort_keys=True)
    case = ModerationCase(
        id=f"MOD-{uuid.uuid4().hex[:12].upper()}",
        content_type=content_type,
        content_id=content_id,
        content_version=content_version,
        content_hash=content_hash(snapshot_text),
        snapshot=snapshot_text,
        submitter_id=submitter_id,
        status="created",
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


def analyze_case(
    db: Session,
    case: ModerationCase,
    *,
    llm_analyzer=None,
    trace_id: str | None = None,
) -> ModerationDecision:
    """执行审核分析并落决策记录。

    `llm_analyzer` 是可注入的语义分析器（签名：fields -> dict）。
    没传或 LLM 未配置时，走安全降级：**暂缓发布，不默认放行**
    （设计书 §9.4 的失败安全策略）。
    """
    snapshot = json.loads(case.snapshot or "{}")
    fields: dict[str, str] = {
        k: str(v) for k, v in snapshot.items() if isinstance(v, str)
    }

    case.status = "analyzing"
    db.commit()

    # ── 第一步：确定性规则 ──
    det = check_deterministic(db, fields=fields, submitter_id=case.submitter_id)

    # ── 第二步：语义分析 ──
    # 模型是否可用由「有没有可用的模型服务」决定，而不是环境变量 ——
    # 现在模型服务是**管理员在界面上可切换**的（存在 llm_providers 表）。
    # 分析器本身在没配好服务时会抛异常，被这里捕获后走安全降级。
    semantic: dict[str, Any] = {}
    semantic_available = llm_analyzer is not None
    if semantic_available:
        try:
            semantic = llm_analyzer(fields)
            if not isinstance(semantic, dict) or not semantic:
                semantic_available = False
        except Exception:
            semantic = {}
            semantic_available = False

    # ── 第三步：决策 ──
    if det.hard_fail:
        decision_name = "REJECT"
    elif not semantic_available:
        # 安全降级：模型不可用 → 暂缓发布，不默认放行
        decision_name = "REVIEW"
        case.status = "pending_human_review"
    elif semantic.get("recommendation") == "reject" and _is_explainable(semantic):
        decision_name = "REJECT"
    elif semantic.get("recommendation") == "review":
        decision_name = "REVIEW"
        case.status = "pending_human_review"
    else:
        decision_name = "ALLOW"

    if decision_name == "ALLOW":
        case.status = "approved"

    # ── 第四步：落决策记录 ──
    decision = ModerationDecision(
        id=str(uuid.uuid4()),
        case_id=case.id,
        decision=decision_name,
        risk_categories=json.dumps(semantic.get("risk_categories", []), ensure_ascii=False),
        risk_level=semantic.get("risk_level", "low"),
        evidence=json.dumps(
            det.hits[0].evidence if det.hits else semantic.get("evidence", []),
            ensure_ascii=False,
        ),
        uncertainty_reasons=json.dumps(
            semantic.get("uncertainty_reasons", []), ensure_ascii=False
        ),
        rule_hits=json.dumps(
            [
                {
                    "rule_id": h.rule_id,
                    "rule_version": h.rule_version,
                    "rule_name": h.rule_name,
                    "matched": h.matched,
                    "detail": h.detail,
                }
                for h in det.hits
            ],
            ensure_ascii=False,
        ),
        reasoning=semantic.get("reasoning") or (det.hard_fail_detail if det.hard_fail else ""),
        rule_version=";".join(sorted({h.rule_version for h in det.hits if h.rule_version})),
        model_version=_active_model_name() if semantic_available else None,
        prompt_version=None,
        confidence=semantic.get("confidence"),
        produced_by="agent" if semantic_available else "rule_engine",
        created_at=datetime.now(),
    )
    db.add(decision)
    case.updated_at = datetime.now()
    db.commit()
    db.refresh(decision)
    return decision


def _is_explainable(semantic: dict[str, Any]) -> bool:
    """判断语义拒绝是否「明确且可解释」。

    设计书 §5.7：「自动拒绝只允许用于经过平台确认、可解释、可测试的硬规则。
    其余模型判断默认 REVIEW。」

    所以模型说 reject 不等于能自动 reject —— 必须有证据片段，
    且证据必须能在原文中定位（设计书 §5.6）。
    """
    evidence = semantic.get("evidence") or []
    if not evidence:
        return False
    return all(e.get("text_span") for e in evidence)


def apply_review_action(
    db: Session,
    *,
    case: ModerationCase,
    actor_id: str,
    actor_type: str,
    action: str,
    reason: str,
    agent_decision: str | None = None,
    trace_id: str | None = None,
) -> dict[str, Any]:
    """执行人工处置。

    **这是唯一能改变内容状态的地方**（设计书 §5.9：
    「模型分析结果与内容状态流转必须分开」）。

    高影响动作（退回、拒绝）必须带理由。
    """
    allowed = ADMIN_CONTENT_ACTIONS if actor_type == "admin" else TEACHER_ACTIONS
    if action not in allowed:
        raise ValueError(f"不支持的处置动作：{action}")

    label, target_status = allowed[action]

    if action in ("return", "reject") and not reason.strip():
        raise ValueError(f"{label}必须填写理由")

    # 教师审核必须校验授权范围（设计书 §5.12）
    if actor_type == "teacher":
        _assert_reviewer_scope(db, case, actor_id)

    overrode = bool(agent_decision and agent_decision != {"approve": "ALLOW", "reject": "REJECT"}.get(action, agent_decision))
    review = ModerationReview(
        id=str(uuid.uuid4()),
        case_id=case.id,
        reviewer_id=actor_id,
        reviewer_type=actor_type,
        action=action,
        reason=reason,
        overrode_agent=overrode,
        created_at=datetime.now(),
    )
    db.add(review)

    # ── 状态流转 ──
    resource = _target_resource(db, case)
    if action == "defer":
        case.status = "transferred"
    elif action == "dismiss":
        case.status = "closed"
    elif action == "approve":
        case.status = "approved"
    elif action == "return":
        case.status = "returned_to_author"
    elif action == "reject":
        case.status = "rejected"
    elif action == "hide":
        case.status = "pending_human_review"
    elif action == "restore":
        case.status = "approved"

    if resource is not None and target_status:
        resource.status = target_status

    case.updated_at = datetime.now()
    db.commit()

    record_audit(
        db,
        actor_type="user",
        actor_id=actor_id,
        action=f"moderation.{action}",
        target_type=case.content_type,
        target_id=case.content_id,
        reason=reason,
        result=f"{label}，案件状态 {case.status}",
        case_no=case.id,
        trace_id=trace_id,
    )

    return {
        "case_id": case.id,
        "action": action,
        "action_label": label,
        "case_status": case.status,
        "content_status": resource.status if resource is not None else None,
    }


def _assert_reviewer_scope(db: Session, case: ModerationCase, reviewer_id: str) -> None:
    """校验教师审核者在授权范围内（设计书 §5.12）。

    范围必须在**后端**校验 —— 不能把全站案件取出来再在前端过滤。
    """
    from app.core.errors import PermissionDenied
    from app.models.users import UserCapability

    cap = db.execute(
        select(UserCapability).where(
            UserCapability.user_id == reviewer_id,
            UserCapability.code == "reviewer",
            UserCapability.revoked_at.is_(None),
        )
    ).scalar_one_or_none()

    if cap is None:
        raise PermissionDenied("当前用户未被授予内容审核职责。")

    scope = cap.scope_grant
    if scope is None:
        raise PermissionDenied("审核授权缺少范围限定，等同于全站审核。")

    allowed_types = [t for t in (scope.resource_types or "").split(",") if t]
    if allowed_types and case.content_type not in allowed_types:
        raise PermissionDenied("该案件不在您的审核授权范围内。")


def _target_resource(db: Session, case: ModerationCase) -> Resource | None:
    """找到案件对应的资源（若审核对象是资源类型）。"""
    if case.content_type in (
        "platform_note",
        "external_resource",
        "project_case",
        "competition",
        "official_notice",
    ):
        return db.get(Resource, case.content_id)
    return None


def list_cases(
    db: Session,
    *,
    status: str | None = None,
    content_type: str | None = None,
    assigned_reviewer_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ModerationCase], int]:
    """列出审核案件。

    **过滤必须在服务端按授权范围完成**（设计书 §5.12）。
    """
    query = select(ModerationCase)
    if status:
        query = query.where(ModerationCase.status == status)
    if content_type:
        query = query.where(ModerationCase.content_type == content_type)
    if assigned_reviewer_id:
        query = query.where(ModerationCase.assigned_reviewer_id == assigned_reviewer_id)

    total = db.execute(
        select(func.count()).select_from(query.subquery())
    ).scalar_one()
    rows = (
        db.execute(query.order_by(ModerationCase.created_at.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return list(rows), int(total)
