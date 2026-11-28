"""学习规划接口。

对应设计书 §6.12。
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession, RequiredUser
from app.core.envelope import AgentEnvelope, envelope
from app.core.errors import ConflictError
from app.models.learning import LearningGoal, LearningPlan
from app.services import agent_llm, llm_service
from app.services import learning_service as svc
from app.services.knowledge_service import concepts_for_skills

router = APIRouter(prefix="/api/learning", tags=["learning"])

# Agent 类接口单独挂到 /api/agents，与搜索 Agent 保持同一前缀约定
# （设计书 §8.2：三个 Agent 共用同一套 envelope 与调用约定）
agent_router = APIRouter(prefix="/api/agents", tags=["learning-agent"])
AGENT_KEY = "learning_planning_agent"


class ProfileUpdate(BaseModel):
    basics: dict[str, Any] = Field(default_factory=dict)
    preferences: dict[str, Any] = Field(default_factory=dict)


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    goal_type: str = "skill_learning"
    target_outcomes: list[str] = Field(default_factory=list)
    target_date: str | None = None
    weekly_available_minutes: int | None = None
    current_level: str | None = None
    constraints: list[str] = Field(default_factory=list)


class EvidenceCreate(BaseModel):
    concept_id: str | None = None
    skill_id: str | None = None
    evidence_type: str = "UNKNOWN"
    capability_state: str = "unknown"
    source_id: str | None = None
    source_note: str | None = None


class PlanGenerateRequest(BaseModel):
    goal_id: str
    required_skill_ids: list[str] = Field(default_factory=list)
    weekly_available_minutes: int | None = None


class TaskStatusUpdate(BaseModel):
    status: str


class PlanAdjustRequest(BaseModel):
    base_version: int
    reason: str = ""
    draft: dict[str, Any] = Field(default_factory=dict)


@router.get("/profile")
def get_profile(ctx: RequiredUser, db: DbSession) -> dict[str, Any]:
    profile = svc.get_profile(db, ctx.user_id or "")
    if profile is None:
        return {
            "user_id": ctx.user_id,
            "profile_version": 0,
            "basics": {},
            "preferences": {},
        }
    return {
        "user_id": profile.user_id,
        "profile_version": profile.profile_version,
        "basics": json.loads(profile.basics or "{}"),
        "preferences": json.loads(profile.preferences or "{}"),
        "updated_at": profile.updated_at.isoformat(),
    }


@router.put("/profile")
def update_profile(
    payload: ProfileUpdate, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    profile = svc.upsert_profile(db, ctx.user_id or "", payload.basics, payload.preferences)
    return {
        "user_id": profile.user_id,
        "profile_version": profile.profile_version,
        "basics": json.loads(profile.basics or "{}"),
        "preferences": json.loads(profile.preferences or "{}"),
    }


@router.get("/evidence")
def list_evidence(ctx: RequiredUser, db: DbSession) -> list[dict[str, Any]]:
    return [
        {
            "id": ev.id,
            "concept_id": ev.concept_id,
            "skill_id": ev.skill_id,
            "evidence_type": ev.evidence_type,
            "evidence_label": svc.EVIDENCE_TYPES.get(ev.evidence_type, ev.evidence_type),
            "capability_state": ev.capability_state,
            "state_label": svc.CAPABILITY_STATES.get(ev.capability_state, ev.capability_state),
            "source_note": ev.source_note,
            "observed_at": ev.observed_at.isoformat(),
        }
        for ev in svc.list_evidence(db, ctx.user_id or "")
    ]


@router.post("/evidence", status_code=201)
def create_evidence(
    payload: EvidenceCreate, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    ev = svc.add_evidence(
        db,
        user_id=ctx.user_id or "",
        concept_id=payload.concept_id,
        skill_id=payload.skill_id,
        evidence_type=payload.evidence_type,
        capability_state=payload.capability_state,
        source_id=payload.source_id,
        source_note=payload.source_note,
    )
    return {"id": ev.id, "evidence_type": ev.evidence_type}


@router.post("/goals", status_code=201)
def create_goal(payload: GoalCreate, ctx: RequiredUser, db: DbSession) -> dict[str, Any]:
    import uuid
    from datetime import datetime

    goal = LearningGoal(
        id=f"goal_{uuid.uuid4().hex[:12]}",
        user_id=ctx.user_id or "",
        title=payload.title,
        goal_type=payload.goal_type,
        target_outcomes=json.dumps(payload.target_outcomes, ensure_ascii=False),
        target_date=(
            datetime.strptime(payload.target_date, "%Y-%m-%d").date()
            if payload.target_date
            else None
        ),
        weekly_available_minutes=payload.weekly_available_minutes,
        current_level=payload.current_level,
        constraints=json.dumps(payload.constraints, ensure_ascii=False),
        status="active",
        created_at=datetime.now(),
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {
        "id": goal.id,
        "title": goal.title,
        "goal_type": goal.goal_type,
        "target_outcomes": payload.target_outcomes,
        "weekly_available_minutes": goal.weekly_available_minutes,
    }


@router.get("/goals")
def list_goals(ctx: RequiredUser, db: DbSession) -> list[dict[str, Any]]:
    from sqlalchemy import select

    goals = db.execute(
        select(LearningGoal).where(LearningGoal.user_id == ctx.user_id)
    ).scalars().all()
    return [
        {
            "id": g.id,
            "title": g.title,
            "goal_type": g.goal_type,
            "target_outcomes": json.loads(g.target_outcomes or "[]"),
            "target_date": g.target_date.isoformat() if g.target_date else None,
            "weekly_available_minutes": g.weekly_available_minutes,
            "status": g.status,
        }
        for g in goals
    ]


@agent_router.post("/learning-plans/generate", response_model=AgentEnvelope)
def generate_plan(
    payload: PlanGenerateRequest, ctx: RequiredUser, db: DbSession
) -> AgentEnvelope:
    """生成计划草案。

    **只返回草案，不落库** —— 必须经用户确认（§6.9 的 present_plan_for_confirmation）。

    模型可用时由模型生成阶段与任务，但**服务端会重新校验一遍**
    （§6.10）：只保留真实可见的资源，知识点路径由服务端决定。
    模型不可用时退回规则版草案，并在 warnings 里说明。
    """
    from sqlalchemy import select

    goal = db.get(LearningGoal, payload.goal_id)
    if goal is None or goal.user_id != ctx.user_id:
        raise HTTPException(status_code=404, detail="学习目标不存在")

    plan_concepts = concepts_for_skills(db, payload.required_skill_ids)

    # 规则版草案：既是兜底，也是模型草案的校验基准
    fallback = svc.build_plan_draft(
        db,
        ctx,
        goal=goal,
        required_skill_ids=payload.required_skill_ids,
        plan_concepts=plan_concepts,
        plan_skills=payload.required_skill_ids,
        weekly_minutes=payload.weekly_available_minutes or goal.weekly_available_minutes,
    )

    warnings: list[str] = []
    draft = fallback
    generated_by = "rules"

    # ── 尝试用模型生成 ──
    try:
        skill_names = [svc._concept_name(db, cid) for cid in plan_concepts]
        # _match_resources 返回 (匹配到的资源列表, 缺失说明列表)
        matched_resources, _missing = svc._match_resources(
            db, ctx, fallback["coverage"]["to_learn_concepts"]
        )
        candidate_ids = [r["resource_id"] for r in matched_resources]
        raw = agent_llm.generate_plan_draft(
            db,
            goal_title=goal.title,
            goal_description=goal.goal_type,
            weekly_minutes=payload.weekly_available_minutes or goal.weekly_available_minutes or 360,
            max_weeks=12,
            skill_names=[n for n in skill_names if n],
            resource_ids=candidate_ids,
        )
        reconciled = svc.reconcile_llm_draft(db, ctx, raw, goal=goal, fallback=fallback)
        if reconciled.get("generated_by") == "llm":
            draft = reconciled
            generated_by = "llm"
    except llm_service.LlmError as exc:
        warnings.append(f"计划生成模型当前不可用，已改用规则版阶段划分（{exc}）。")

    problems = svc.validate_plan(db, ctx, draft, goal)

    status = "success"
    if problems:
        warnings.extend(problems)
        status = "partial"
    if any("不可用" in w for w in warnings):
        status = "partial"
    if draft["assumptions"]:
        warnings.append(
            "计划包含假设，用户修改后可只重算受影响阶段："
            + "、".join(a["text"] for a in draft["assumptions"])
        )

    return envelope(
        agent=AGENT_KEY,
        status=status,
        data={
            "draft": draft,
            "validation_errors": problems,
            "generated_by": generated_by,
        },
        warnings=warnings,
    )


class PlanConfirmRequest(BaseModel):
    """确认保存计划。

    草案由前端回传，但**服务端会重新校验一遍** ——
    不信任前端传来的内容（设计书 §9.1 同一原则）。
    """

    goal_id: str
    draft: dict[str, Any] = Field(default_factory=dict)


@router.post("/plans/confirm", status_code=201)
def confirm_plan(
    payload: PlanConfirmRequest, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """确认并保存草案。"""
    goal = db.get(LearningGoal, payload.goal_id)
    if goal is None or goal.user_id != ctx.user_id:
        raise HTTPException(status_code=404, detail="学习目标不存在")

    problems = svc.validate_plan(db, ctx, payload.draft, goal)
    if problems:
        raise HTTPException(status_code=422, detail={"validation_errors": problems})

    plan = svc.persist_plan(db, ctx, goal=goal, draft=payload.draft)
    return {"plan_id": plan.id, "version": plan.version, "status": plan.status}


@router.get("/plans/{plan_id}")
def get_plan(plan_id: str, ctx: RequiredUser, db: DbSession) -> dict[str, Any]:
    """查看计划详情。"""
    from sqlalchemy import select

    from app.models.learning import LearningTask, PlanStage

    plan = db.get(LearningPlan, plan_id)
    if plan is None or plan.user_id != ctx.user_id:
        raise HTTPException(status_code=404, detail="学习计划不存在")

    stages = db.execute(
        select(PlanStage).where(PlanStage.plan_id == plan.id).order_by(PlanStage.sequence)
    ).scalars().all()

    stage_payload = []
    for stage in stages:
        tasks = db.execute(
            select(LearningTask).where(LearningTask.stage_id == stage.id)
        ).scalars().all()
        stage_payload.append(
            {
                "stage_id": stage.id,
                "sequence": stage.sequence,
                "title": stage.title,
                "objective": stage.objective,
                "success_criteria": json.loads(stage.success_criteria or "[]"),
                "tasks": [
                    {
                        "task_id": t.id,
                        "title": t.title,
                        "estimated_minutes": t.estimated_minutes,
                        "status": t.status,
                        "completion_criteria": json.loads(t.completion_criteria or "[]"),
                        "resource_ids": [rt.resource_id for rt in t.resources],
                    }
                    for t in tasks
                ],
            }
        )

    return {
        "plan_id": plan.id,
        "goal_id": plan.goal_id,
        "version": plan.version,
        "status": plan.status,
        "lock_version": plan.lock_version,
        "assumptions": json.loads(plan.assumptions or "[]"),
        "stages": stage_payload,
    }


@router.post("/tasks/{task_id}/status")
def update_task(
    task_id: str, payload: TaskStatusUpdate, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """更新任务状态。

    **状态流转要校验前置状态**（设计书 §10.6.2）：
    从 pending 不能直接跳到 completed。
    """
    try:
        task = svc.update_task_status(
            db, ctx, task_id=task_id, new_status=payload.status
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"task_id": task.id, "status": task.status}


@router.post("/plans/{plan_id}/adjust")
def adjust_plan(
    plan_id: str, payload: PlanAdjustRequest, ctx: RequiredUser, db: DbSession
) -> dict[str, Any]:
    """调整计划 → 创建新版本。

    **乐观锁**：base_version 不匹配返回 409，不静默覆盖（设计书 §10.6.1）。
    """
    try:
        new_plan = svc.adjust_plan(
            db,
            ctx,
            plan_id=plan_id,
            base_version=payload.base_version,
            new_draft=payload.draft,
            adjustment_reason=payload.reason,
        )
    except ConflictError as exc:
        raise HTTPException(status_code=409, detail=exc.to_dict()["error"]) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {
        "plan_id": new_plan.id,
        "version": new_plan.version,
        "status": new_plan.status,
    }
