"""审核治理模型。

设计书 §5。核心原则：
- **模型分析结果与内容状态流转分离**（§5.7）：Agent 只给建议，
  业务服务在确认权限、案件状态和操作理由后才执行状态变更；
- **规则版本化**（§5.5）：每次审核记录当时的 rule_version 与 model_version；
- **内容版本绑定**（§7.3）：审核案件绑定 content_version / content_hash，
  防止审核旧版本后误放新版本。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ModerationRule(Base):
    """审核规则。规则内容与版本分离，修改走新增版本（可回滚）。"""

    __tablename__ = "moderation_rules"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # rule_type：deterministic（确定性规则）/ semantic（语义规则）
    rule_type: Mapped[str] = mapped_column(String(32), nullable=False, default="semantic")
    scope: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # 规则体：确定性规则存表达式/关键词，语义规则存判定要点
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class ModerationRuleVersion(Base):
    """规则版本。修改规则 = 新增版本，旧版本保留以便回滚与归因。"""

    __tablename__ = "moderation_rule_versions"
    __table_args__ = (Index("ix_rule_version_rule", "rule_id", "version"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    rule_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("moderation_rules.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    change_reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    # 是否为当前生效版本
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class ModerationCase(Base):
    """审核案件。"""

    __tablename__ = "moderation_cases"
    __table_args__ = (
        Index("ix_case_status", "status"),
        Index("ix_case_target", "target_type", "target_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)
    content_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # 绑定内容版本（设计书 §7.3）
    content_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # 原始内容快照
    snapshot: Mapped[str] = mapped_column(Text, nullable=False, default="{}")

    submitter_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    # moderation_case_status（设计书 §2.5，9 态）
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="created")

    # 被分配的人工审核者（§5.12 教师审核路径）
    assigned_reviewer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    scope_grant_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )

    decisions: Mapped[list["ModerationDecision"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )


class ModerationDecision(Base):
    """审核决策记录。

    **事实与判断分离**（设计书 §8.2.2）：
    - facts 部分（rule_version / model_version / 证据 / 命中规则）可核查；
    - reasoning 部分（模型解释）是主观判断，可被推翻。

    这个区分让「误判率上升」能归因到具体规则或具体判断（§10.3.1）。
    """

    __tablename__ = "moderation_decisions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("moderation_cases.id", ondelete="CASCADE"), nullable=False
    )
    # moderation_decision：ALLOW / REVIEW / REJECT
    decision: Mapped[str] = mapped_column(String(16), nullable=False)
    risk_categories: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    risk_level: Mapped[str] = mapped_column(String(16), nullable=False, default="low")
    # 证据片段 JSON 数组 [{text_span, start_offset, end_offset, rule_category, explanation}]
    evidence: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    uncertainty_reasons: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # 规则命中结果 JSON 数组 [{rule_id, rule_version, matched}]
    rule_hits: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # 模型的主观解释
    reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)

    rule_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confidence: Mapped[float | None] = mapped_column(nullable=True)
    # 来源：agent / reviewer / rule_engine
    produced_by: Mapped[str] = mapped_column(String(32), nullable=False, default="agent")

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)

    case: Mapped["ModerationCase"] = relationship(back_populates="decisions")


class ModerationReview(Base):
    """人工复核记录。"""

    __tablename__ = "moderation_reviews"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("moderation_cases.id", ondelete="CASCADE"), nullable=False
    )
    reviewer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # reviewer_type：teacher / admin
    reviewer_type: Mapped[str] = mapped_column(String(16), nullable=False, default="admin")
    # 处置动作（教师 5 种：approve/return/defer/hide/reject；管理员另有管理动作）
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 是否推翻了 Agent 建议（§10.2 的人工推翻率指标）
    overrode_agent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Report(Base):
    """用户举报。"""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    reporter_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    target_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)


class Appeal(Base):
    """申诉记录。"""

    __tablename__ = "appeals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("moderation_cases.id", ondelete="CASCADE"), nullable=False
    )
    appellant_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
