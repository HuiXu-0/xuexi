"""学习规划服务。

对应设计书 §6。

核心设计（§6.1）：「其核心不是生成长篇计划，而是建立可信的学习状态
并持续改善任务安排。」

**计划校验器**（§6.10）是这个模块的安全网：
计划生成后必须过 10 条确定性校验，校验失败最多自动修订一次。
校验不通过的计划**不保存** —— 返回具体问题，不无限调用模型。

**结构化假设**（§8.2.2）：assumptions 是对象数组而非字符串，
每个假设带 affects 字段，改一个假设能精确定位受影响的阶段。
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, ValidationFailed
from app.models.learning import (
    CapabilityEvidence,
    LearningGoal,
    LearningPlan,
    LearningProfile,
    LearningTask,
    PlanStage,
)
from app.models.resources import Resource
from app.services.knowledge_service import (
    concepts_for_skills,
    topological_order,
)
from app.services.permission_service import UserContext, can_view_resource

# ── 证据类型与能力状态（设计书 §6.3）───────────────────────

EVIDENCE_TYPES = {
    "USER_STATED": "用户明确表达",
    "SELF_ASSESSED": "用户自我评价",
    "TASK_VERIFIED": "通过任务或测验验证",
    "TEACHER_VERIFIED": "教师确认",
    "SYSTEM_OBSERVED": "系统行为记录（不代表掌握）",
    "UNKNOWN": "尚无足够证据",
}

CAPABILITY_STATES = {
    "verified_mastered": "已验证掌握",
    "self_reported": "自述掌握",
    "needs_assessment": "待评估",
    "not_started": "未开始",
    "in_progress": "进行中",
    "unknown": "未知",
}


def get_profile(db: Session, user_id: str) -> LearningProfile | None:
    return db.get(LearningProfile, user_id)


def upsert_profile(
    db: Session, user_id: str, basics: dict[str, Any], preferences: dict[str, Any]
) -> LearningProfile:
    profile = get_profile(db, user_id)
    if profile is None:
        profile = LearningProfile(
            user_id=user_id,
            profile_version=1,
            basics=json.dumps(basics, ensure_ascii=False),
            preferences=json.dumps(preferences, ensure_ascii=False),
            updated_at=datetime.now(),
        )
        db.add(profile)
    else:
        profile.basics = json.dumps(basics, ensure_ascii=False)
        profile.preferences = json.dumps(preferences, ensure_ascii=False)
        profile.profile_version += 1
        profile.updated_at = datetime.now()
    db.commit()
    db.refresh(profile)
    return profile


def list_evidence(db: Session, user_id: str) -> list[CapabilityEvidence]:
    return list(
        db.execute(
            select(CapabilityEvidence).where(CapabilityEvidence.user_id == user_id)
        ).scalars().all()
    )


def add_evidence(
    db: Session,
    *,
    user_id: str,
    concept_id: str | None,
    skill_id: str | None,
    evidence_type: str,
    capability_state: str,
    source_id: str | None = None,
    source_note: str | None = None,
) -> CapabilityEvidence:
    """新增能力证据。

    **禁止规则**（设计书 §6.3）：
    - 用户自述掌握不能自动升级为 TASK_VERIFIED；
    - 没有证据时必须保留 UNKNOWN。

    这里不做自动升级 —— 状态由调用方明确指定，服务端只校验取值合法。
    """
    if evidence_type not in EVIDENCE_TYPES:
        raise ValidationFailed(f"未知的证据类型：{evidence_type}")
    if capability_state not in CAPABILITY_STATES:
        raise ValidationFailed(f"未知的能力状态：{capability_state}")

    if evidence_type == "TASK_VERIFIED" and not source_id:
        raise ValidationFailed("任务验证类证据必须提供来源记录。")

    evidence = CapabilityEvidence(
        id=str(uuid.uuid4()),
        user_id=user_id,
        concept_id=concept_id,
        skill_id=skill_id,
        evidence_type=evidence_type,
        capability_state=capability_state,
        source_id=source_id,
        source_note=source_note,
        observed_at=datetime.now(),
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


def capability_map(db: Session, user_id: str) -> dict[str, dict[str, Any]]:
    """汇总用户的知识点掌握状态。

    取**证据最强的一条**作为该知识点的状态 ——
    TASK_VERIFIED / TEACHER_VERIFIED > SELF_ASSESSED / USER_STATED > UNKNOWN。
    """
    rank = {
        "TASK_VERIFIED": 5,
        "TEACHER_VERIFIED": 5,
        "SYSTEM_OBSERVED": 3,
        "SELF_ASSESSED": 2,
        "USER_STATED": 1,
        "UNKNOWN": 0,
    }
    result: dict[str, dict[str, Any]] = {}
    for ev in list_evidence(db, user_id):
        if not ev.concept_id:
            continue
        current = result.get(ev.concept_id)
        if current is None or rank.get(ev.evidence_type, 0) > rank.get(
            current["evidence_type"], 0
        ):
            result[ev.concept_id] = {
                "concept_id": ev.concept_id,
                "state": ev.capability_state,
                "evidence_type": ev.evidence_type,
                "evidence_label": EVIDENCE_TYPES.get(ev.evidence_type, ev.evidence_type),
                "source_note": ev.source_note,
            }
    return result


# ══════════════════════════════════════════════════════════════
# 计划生成
# ══════════════════════════════════════════════════════════════


def build_plan_draft(
    db: Session,
    ctx: UserContext,
    *,
    goal: LearningGoal,
    required_skill_ids: list[str],
    plan_concepts: list[str],
    plan_skills: list[str],
    weekly_minutes: int | None,
    stage_specs: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """生成计划草案（纯数据结构，不落库）。

    这一版用**规则**组装阶段与任务，不调用 LLM：
    - 阶段按知识点分组；
    - 任务引用真实资源（从 concepts_for_skills / 资源关联里找）；
    - 假设显式列出（结构化）。
    """
    caps = capability_map(db, ctx.user_id or "")
    ordered = topological_order(db, plan_concepts)

    # ── 知识路径：区分已掌握与待学 ──
    mastered = [
        cid
        for cid in ordered
        if caps.get(cid, {}).get("state") == "verified_mastered"
    ]
    to_learn = [cid for cid in ordered if cid not in mastered]

    # ── 资源匹配：找与待学知识点关联的真实资源 ──
    matched_resources, missing = _match_resources(db, ctx, to_learn)

    # ── 假设（结构化）──
    assumptions: list[dict[str, Any]] = []
    if weekly_minutes is None:
        assumptions.append(
            {
                "id": "a_weekly",
                "text": "每周可投入时间暂按 6 小时估算",
                "based_on": "未填写，按默认值估算",
                "editable": True,
                "affects": ["stage_01"],
            }
        )
    if not caps:
        assumptions.append(
            {
                "id": "a_level",
                "text": "当前能力基础未知，全部知识点按待学习安排",
                "based_on": "尚无能力证据",
                "editable": True,
                "affects": ["stage_01"],
            }
        )

    # ── 阶段与任务 ──
    specs = stage_specs or _default_stage_specs(db, to_learn)
    stages: list[dict[str, Any]] = []
    total_minutes = 0

    for idx, spec in enumerate(specs, start=1):
        stage_id = f"stage_{idx:02d}"
        concept_ids = spec.get("concept_ids", [])
        stage_resources = [
            r for r in matched_resources if r["concept_id"] in concept_ids
        ] or matched_resources[:2]

        tasks: list[dict[str, Any]] = []
        minutes_per_task = (weekly_minutes or 360) // max(len(concept_ids), 1) // 2 or 60
        for cidx, concept_id in enumerate(concept_ids, start=1):
            concept_name = _concept_name(db, concept_id)
            resource_ids = [
                r["resource_id"] for r in stage_resources if r["concept_id"] == concept_id
            ]
            task_minutes = max(30, minutes_per_task)
            total_minutes += task_minutes
            tasks.append(
                {
                    "task_id": f"task_{idx:02d}_{cidx:02d}",
                    "title": f"完成「{concept_name}」的学习与练习",
                    "estimated_minutes": task_minutes,
                    "status": "pending",
                    "concept_ids": [concept_id],
                    "skill_ids": spec.get("skill_ids", []),
                    "resource_ids": resource_ids,
                    "completion_criteria": [
                        f"提交「{concept_name}」相关的练习或笔记",
                        "能用自己的话解释核心概念",
                    ],
                    "evidence_required": ["code_submission", "note_submission"],
                    "depends_on": [],
                }
            )

        stages.append(
            {
                "stage_id": stage_id,
                "sequence": idx,
                "title": spec.get("title", f"阶段 {idx}"),
                "objective": spec.get("objective", ""),
                "success_criteria": spec.get("success_criteria", []),
                "tasks": tasks,
            }
        )

    return {
        "goal_id": goal.id,
        "version": 1,
        "status": "draft",
        "assumptions": assumptions,
        "stages": stages,
        "coverage": {
            "missing_resources": [
                {"stage_id": s["stage_id"], "reason": m["reason"]}
                for s, m in zip(stages, missing, strict=False)
            ],
            "mastered_concepts": mastered,
            "to_learn_concepts": to_learn,
        },
        "total_minutes": total_minutes,
    }


def _default_stage_specs(db: Session, to_learn: list[str]) -> list[dict[str, Any]]:
    """默认阶段切分：按「基础 → 进阶 → 实践」三段。

    这个切分是规则性的 —— 真正的阶段划分需要领域知识，
    后续可由 LLM 建议，但必须过 §6.10 的校验器。
    """
    if not to_learn:
        return []

    thirds = max(1, len(to_learn) // 3)
    groups = [
        to_learn[:thirds],
        to_learn[thirds : thirds * 2] or to_learn[thirds:],
        to_learn[thirds * 2 :] or [],
    ]
    groups = [g for g in groups if g]

    titles = ["基础准备", "进阶掌握", "项目实践"]
    objectives = [
        "建立必要的先修知识",
        "掌握核心概念并能独立应用",
        "通过完整任务检验掌握程度",
    ]
    specs = []
    for i, group in enumerate(groups):
        specs.append(
            {
                "title": titles[i] if i < len(titles) else f"阶段 {i + 1}",
                "objective": objectives[i] if i < len(objectives) else "",
                "concept_ids": group,
                "skill_ids": [],
                "success_criteria": ["完成本阶段全部任务", "能解释核心概念并独立完成练习"],
            }
        )
    return specs


def _match_resources(
    db: Session, ctx: UserContext, concept_ids: list[str]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """按知识点匹配真实资源。

    **找不到就说找不到** —— 允许伪造标题、作者和链接
    （设计书 §6.7）。
    """
    if not concept_ids:
        return [], [{"stage_id": "stage_01", "reason": "尚未确定学习知识点"}]

    from app.models.learning import ResourceConcept

    rows = db.execute(
        select(ResourceConcept).where(ResourceConcept.concept_id.in_(concept_ids))
    ).scalars().all()

    matched: list[dict[str, Any]] = []
    seen: set[str] = set()
    for rc in rows:
        if rc.resource_id in seen:
            continue
        resource = db.get(Resource, rc.resource_id)
        if resource is None:
            continue
        # 资源也必须对用户可见
        if not can_view_resource(ctx, resource):
            continue
        seen.add(rc.resource_id)
        matched.append(
            {
                "resource_id": resource.id,
                "concept_id": rc.concept_id,
                "title": resource.title,
                "resource_type": resource.resource_type,
            }
        )

    missing: list[dict[str, Any]] = []
    covered = {m["concept_id"] for m in matched}
    for cid in concept_ids:
        if cid not in covered:
            missing.append(
                {
                    "stage_id": "stage_01",
                    "reason": f"平台暂未找到「{_concept_name(db, cid)}」相关资源",
                    "concept_id": cid,
                }
            )
    return matched, missing


def _concept_name(db: Session, concept_id: str) -> str:
    from app.models.learning import KnowledgeConcept

    concept = db.get(KnowledgeConcept, concept_id)
    return concept.canonical_name if concept else concept_id


# ══════════════════════════════════════════════════════════════
# 计划校验器（设计书 §6.10）
# ══════════════════════════════════════════════════════════════


def validate_plan(
    db: Session, ctx: UserContext, draft: dict[str, Any], goal: LearningGoal
) -> list[str]:
    """确定性校验。返回问题列表，空列表表示通过。"""
    problems: list[str] = []
    stages = draft.get("stages") or []

    if not stages:
        problems.append("计划没有任何阶段。")
        return problems

    all_tasks: list[dict[str, Any]] = []
    for stage in stages:
        tasks = stage.get("tasks") or []
        if not tasks:
            problems.append(f"阶段「{stage.get('title')}」没有任务。")
        for task in tasks:
            all_tasks.append(task)
            if not task.get("title"):
                problems.append("存在没有标题的任务。")
            if not task.get("completion_criteria"):
                problems.append(f"任务「{task.get('title')}」缺少完成标准。")

    # 资源 ID 必须真实存在且用户可访问
    resource_ids = {
        rid for task in all_tasks for rid in (task.get("resource_ids") or [])
    }
    for rid in resource_ids:
        resource = db.get(Resource, rid)
        if resource is None:
            problems.append(f"任务引用了不存在的资源：{rid}")
        elif not can_view_resource(ctx, resource):
            problems.append(f"任务引用了当前用户无权访问的资源：{rid}")

    # 预计总时间不能明显超过约束
    weekly = goal.weekly_available_minutes
    if weekly:
        total = sum(t.get("estimated_minutes") or 0 for t in all_tasks)
        weeks = max(1, len(stages))
        if total > weekly * weeks * 1.3:
            problems.append(
                f"预计总时长 {total} 分钟明显超过 {weeks} 周 × 每周 {weekly} 分钟的约束。"
            )

    # 不允许把未知能力标记为已掌握
    caps = capability_map(db, ctx.user_id or "")
    for task in all_tasks:
        for cid in task.get("concept_ids") or []:
            state = caps.get(cid, {}).get("state", "unknown")
            if state == "unknown" and "掌握" in (task.get("title") or ""):
                problems.append(f"任务「{task.get('title')}」把未知能力当作已掌握。")

    # 计划阶段必须覆盖目标要求的关键能力
    required = set(goal.target_outcomes and json.loads(goal.target_outcomes) or [])
    covered_concepts = {
        cid for task in all_tasks for cid in (task.get("concept_ids") or [])
    }
    if required and not covered_concepts:
        problems.append("计划阶段未覆盖目标要求的关键能力。")

    return problems


# ══════════════════════════════════════════════════════════════
# 计划持久化与调整
# ══════════════════════════════════════════════════════════════


def persist_plan(
    db: Session,
    ctx: UserContext,
    *,
    goal: LearningGoal,
    draft: dict[str, Any],
    trace_id: str | None = None,
) -> LearningPlan:
    """确认并保存计划（用户确认后才落库 —— 设计书 §6.9 的 present_plan_for_confirmation）。"""
    plan = LearningPlan(
        id=f"plan_{uuid.uuid4().hex[:12]}",
        user_id=ctx.user_id or "",
        goal_id=goal.id,
        version=draft.get("version", 1),
        status="active",
        assumptions=json.dumps(draft.get("assumptions", []), ensure_ascii=False),
        lock_version=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(plan)
    db.flush()

    for stage_spec in draft.get("stages", []):
        stage = PlanStage(
            id=stage_spec["stage_id"],
            plan_id=plan.id,
            sequence=stage_spec.get("sequence", 1),
            title=stage_spec.get("title", ""),
            objective=stage_spec.get("objective"),
            success_criteria=json.dumps(
                stage_spec.get("success_criteria", []), ensure_ascii=False
            ),
        )
        db.add(stage)
        db.flush()

        for task_spec in stage_spec.get("tasks", []):
            task = LearningTask(
                id=task_spec["task_id"],
                stage_id=stage.id,
                title=task_spec.get("title", ""),
                estimated_minutes=task_spec.get("estimated_minutes"),
                status=task_spec.get("status", "pending"),
                completion_criteria=json.dumps(
                    task_spec.get("completion_criteria", []), ensure_ascii=False
                ),
                evidence_required=json.dumps(
                    task_spec.get("evidence_required", []), ensure_ascii=False
                ),
                depends_on=json.dumps(task_spec.get("depends_on", []), ensure_ascii=False),
                created_at=datetime.now(),
            )
            db.add(task)
            db.flush()

            from app.models.learning import (
                LearningTaskConcept,
                LearningTaskResource,
                LearningTaskSkill,
            )

            for rid in task_spec.get("resource_ids") or []:
                db.add(
                    LearningTaskResource(
                        id=str(uuid.uuid4()), task_id=task.id, resource_id=rid
                    )
                )
            for cid in task_spec.get("concept_ids") or []:
                db.add(
                    LearningTaskConcept(
                        id=str(uuid.uuid4()), task_id=task.id, concept_id=cid
                    )
                )
            for sid in task_spec.get("skill_ids") or []:
                db.add(
                    LearningTaskSkill(id=str(uuid.uuid4()), task_id=task.id, skill_id=sid)
                )

    db.commit()
    db.refresh(plan)
    return plan


def adjust_plan(
    db: Session,
    ctx: UserContext,
    *,
    plan_id: str,
    base_version: int,
    new_draft: dict[str, Any],
    adjustment_reason: str,
) -> LearningPlan:
    """调整计划 → 创建新版本，不覆盖旧计划（设计书 §6.11）。

    **乐观锁**（设计书 §10.6.1）：base_version 不匹配时返回 409，
    不静默覆盖用户刚做的调整。
    """
    plan = db.get(LearningPlan, plan_id)
    if plan is None or plan.user_id != ctx.user_id:
        raise ValidationFailed("学习计划不存在。")

    if plan.lock_version != base_version:
        raise ConflictError(
            "学习计划已被其他操作修改，请重新加载后再试。",
            current_version=plan.lock_version,
        )

    goal = db.get(LearningGoal, plan.goal_id) if plan.goal_id else None
    if goal is None:
        raise ValidationFailed("学习计划缺少关联目标。")

    new_draft = dict(new_draft)
    new_draft["version"] = plan.version + 1
    new_version = persist_plan(db, ctx, goal=goal, draft=new_draft)

    plan.status = "superseded"
    db.commit()
    return new_version


def update_task_status(
    db: Session,
    ctx: UserContext,
    *,
    task_id: str,
    new_status: str,
) -> LearningTask:
    """更新任务状态。

    **状态流转要校验前置状态**（设计书 §10.6.2）：
    从 in_progress 才能到 completed，不能从 pending 直接跳。
    """
    allowed = {
        "pending": {"in_progress", "skipped"},
        "in_progress": {"completed", "blocked", "pending"},
        "blocked": {"in_progress", "skipped"},
        "completed": set(),
        "skipped": {"pending"},
    }
    task = db.get(LearningTask, task_id)
    if task is None:
        raise ValidationFailed("任务不存在。")

    # 确认任务属于该用户的计划
    from app.models.learning import LearningPlan as LP

    owner_id = db.execute(
        select(LP.user_id).join(PlanStage, PlanStage.plan_id == LP.id).where(
            PlanStage.id == task.stage_id
        )
    ).scalar_one_or_none()
    if owner_id != ctx.user_id:
        raise ValidationFailed("任务不属于当前用户的计划。")

    if new_status not in allowed:
        raise ValidationFailed(f"未知的任务状态：{new_status}")
    if new_status not in allowed[task.status]:
        raise ValidationFailed(
            f"任务不能从「{task.status}」直接变更为「{new_status}」。"
        )

    task.status = new_status
    db.commit()
    db.refresh(task)
    return task
