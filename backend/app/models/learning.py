"""学习规划与知识本体模型。

设计书 §2 与 §6。

**知识本体与学习本体的边界**（设计书 §2.6）：
- 知识本体回答「这个领域有哪些概念、技能，依赖关系是什么」；
- 学习本体回答「某个用户为了某个目标需要掌握什么，通过什么任务学，
  用什么证据证明进展」。
两者不能混为一谈 —— 知识图谱不存用户学习状态。

**证据类型分层**（设计书 §6.3，6 种）是最关键的设计：
用户自述掌握 ≠ 系统验证掌握。没有证据时必须保留 UNKNOWN。
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


# ══════════════════════════════════════════════════════════════
# 知识本体
# ══════════════════════════════════════════════════════════════


class KnowledgeDomain(Base):
    """知识领域（学科方向）。"""

    __tablename__ = "knowledge_domains"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class KnowledgeConcept(Base):
    """知识概念（知识点）。"""

    __tablename__ = "knowledge_concepts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    canonical_name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 难度：beginner / intermediate / advanced / unknown
    difficulty: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class KnowledgeRelation(Base):
    """知识概念关系（先修等）。

    **prerequisiteOf 必须构成 DAG**（设计书 §2.4 约束 1），
    写入前必须做防环检查（见 knowledge_service）。

    confidence_label：verified / reviewed / proposed / unknown
    source_type：admin / teacher / import / agent_suggestion
    —— Agent 只能提「proposed」，不能直接写 verified（设计书 §2.7）。
    """

    __tablename__ = "knowledge_relations"
    __table_args__ = (
        UniqueConstraint("source_id", "relation_type", "target_id", name="uq_knowledge_relation"),
        Index("ix_kr_source", "source_id", "relation_type"),
        Index("ix_kr_target", "target_id", "relation_type"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("knowledge_concepts.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False, default="prerequisite_of")
    target_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("knowledge_concepts.id", ondelete="CASCADE"), nullable=False
    )
    weight: Mapped[float | None] = mapped_column(nullable=True)
    confidence_label: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="teacher")
    source_ref_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Skill(Base):
    """能力项。"""

    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment_method: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")


class SkillConceptRelation(Base):
    """能力 ↔ 知识概念 映射。"""

    __tablename__ = "skill_concept_relations"
    __table_args__ = (
        UniqueConstraint("skill_id", "concept_id", name="uq_skill_concept"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    skill_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("skills.id", ondelete="CASCADE"), nullable=False
    )
    concept_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("knowledge_concepts.id", ondelete="CASCADE"), nullable=False
    )
    confidence_label: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="teacher")


class ResourceConcept(Base):
    """资源 ↔ 知识概念 关联。

    两种关系分开（设计书 §2.4）：
    - about_concept：资源讲解或涉及某知识点；
    - requires_concept：资源的前置知识。
    """

    __tablename__ = "resource_concepts"
    __table_args__ = (UniqueConstraint("resource_id", "concept_id", "relation_type", name="uq_res_concept"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False
    )
    concept_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("knowledge_concepts.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False, default="about")
    confidence_label: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="teacher")


class OntologyChangeRequest(Base):
    """本体变更请求。

    Agent 可以提出「建议新增知识关系」，但不能直接把建议写成
    已验证的正式本体关系（设计书 §2.7）。
    """

    __tablename__ = "ontology_change_requests"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    relation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="agent_suggestion")
    # proposed / approved / rejected
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="proposed")
    reviewed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


# ══════════════════════════════════════════════════════════════
# 学习过程
# ══════════════════════════════════════════════════════════════


class LearningProfile(Base):
    """用户学习画像。"""

    __tablename__ = "learning_profiles"

    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    profile_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # 专业方向、年级、兴趣等用户愿意提供的信息
    basics: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    # 偏好：每周可投入分钟、学习节奏、偏好形式
    preferences: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )


class LearningGoal(Base):
    """学习目标。"""

    __tablename__ = "learning_goals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # goal_type：course_learning / skill_learning / competition_preparation /
    #            project_practice / career_exploration
    goal_type: Mapped[str] = mapped_column(String(32), nullable=False, default="skill_learning")
    target_outcomes: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    weekly_available_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_level: Mapped[str | None] = mapped_column(String(64), nullable=True)
    constraints: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class CapabilityEvidence(Base):
    """能力证据。

    **evidence_type 六种**（设计书 §6.3）：
        USER_STATED / SELF_ASSESSED / TASK_VERIFIED /
        TEACHER_VERIFIED / SYSTEM_OBSERVED / UNKNOWN

    禁止规则（设计书 §6.3）：
    - 用户问过 Python ≠ 会 Python；
    - 收藏了资源 ≠ 正在学；
    - 看完视频 ≠ 掌握；
    - 自述掌握不能自动升级为 TASK_VERIFIED；
    - 没有证据必须保留 UNKNOWN。
    """

    __tablename__ = "capability_evidence"
    __table_args__ = (Index("ix_evidence_user", "user_id", "concept_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    concept_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    skill_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(32), nullable=False, default="UNKNOWN")
    # 能力状态：verified_mastered / self_reported / needs_assessment /
    #            not_started / in_progress / unknown
    capability_state: Mapped[str] = mapped_column(String(32), nullable=False, default="unknown")
    source_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class LearningPlan(Base):
    """学习计划主表。版本不可原地覆盖（设计书 §7.3）。"""

    __tablename__ = "learning_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    goal_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("learning_goals.id", ondelete="SET NULL"), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    # 结构化假设（设计书 §8.2.2）：
    # [{id, text, based_on, editable, affects:[stage_id]}]
    assumptions: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # 乐观锁字段（设计书 §10.6.1）
    lock_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    stages: Mapped[list["PlanStage"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", lazy="selectin"
    )


class PlanStage(Base):
    """计划阶段。"""

    __tablename__ = "learning_plan_stages"
    __table_args__ = (Index("ix_stage_plan", "plan_id", "sequence"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_plans.id", ondelete="CASCADE"), nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    objective: Mapped[str | None] = mapped_column(Text, nullable=True)
    success_criteria: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    plan: Mapped["LearningPlan"] = relationship(back_populates="stages")
    tasks: Mapped[list["LearningTask"]] = relationship(
        back_populates="stage", cascade="all, delete-orphan", lazy="selectin"
    )


class LearningTask(Base):
    """学习任务。"""

    __tablename__ = "learning_tasks"
    __table_args__ = (Index("ix_task_stage", "stage_id"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    stage_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_plan_stages.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # pending / in_progress / completed / blocked / skipped
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    completion_criteria: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    evidence_required: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # 前置任务（依赖）
    depends_on: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    stage: Mapped["PlanStage"] = relationship(back_populates="tasks")
    resources: Mapped[list["LearningTaskResource"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    concepts: Mapped[list["LearningTaskConcept"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )
    skills: Mapped[list["LearningTaskSkill"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", lazy="selectin"
    )


class LearningTaskResource(Base):
    """任务引用的资源。

    **必须引用真实存在的资源 ID，且展示时重新校验用户权限**
    （设计书 §2.4 约束 3）。
    """

    __tablename__ = "learning_task_resources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_tasks.id", ondelete="CASCADE"), nullable=False
    )
    resource_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False
    )

    task: Mapped["LearningTask"] = relationship(back_populates="resources")
    resource: Mapped["Resource"] = relationship(lazy="selectin")


class LearningTaskConcept(Base):
    """任务覆盖的知识点。"""

    __tablename__ = "learning_task_concepts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_tasks.id", ondelete="CASCADE"), nullable=False
    )
    concept_id: Mapped[str] = mapped_column(String(64), nullable=False)

    task: Mapped["LearningTask"] = relationship(back_populates="concepts")


class LearningTaskSkill(Base):
    """任务培养的能力。"""

    __tablename__ = "learning_task_skills"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("learning_tasks.id", ondelete="CASCADE"), nullable=False
    )
    skill_id: Mapped[str] = mapped_column(String(64), nullable=False)

    task: Mapped["LearningTask"] = relationship(back_populates="skills")


class LearningActivity(Base):
    """学习行为记录（LearningActivity）。"""

    __tablename__ = "learning_activities"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
