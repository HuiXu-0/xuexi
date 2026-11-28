"""审核规则引擎。

对应设计书 §5.5。

规则分两类：
- **确定性规则**：必填缺失、长度超限、禁用域名、高频刷屏、已确认的精确模式。
  这类**可以直接给出明确结果**。
- **语义规则**：辱骂是否针对具体用户、是引用还是攻击、是否误导、
  是否疑似冒用、是否有隐私泄露。这类**只产生风险证据，不直接作处罚**。

规则必须有 rule_id / rule_version / scope / severity / enabled /
effective_at / created_by / change_reason，且修改必须可回滚。
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.moderation import ModerationRule, ModerationRuleVersion

# ── 确定性规则的实现 ────────────────────────────────────────

# 明确的恶意/诱导域名片段。真实场景应由管理员在后台维护，
# 这里放的是演示数据 —— 设计书 §5.5「明确禁止的链接域名或已确认恶意 URL」。
BLOCKED_DOMAIN_PATTERNS = (
    "malicious-example.test",
    "phishing-example.test",
)

# 高频重复提交的阈值（同一提交者在短时间内提交相同内容的次数）
REPEAT_SUBMIT_THRESHOLD = 3


@dataclass
class RuleHit:
    """规则命中结果。**这是可核查的事实**，不是模型的判断。"""

    rule_id: str
    rule_version: str | None
    rule_name: str
    matched: bool
    severity: str
    detail: str = ""
    evidence: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class DeterministicResult:
    hits: list[RuleHit] = field(default_factory=list)
    hard_fail: bool = False
    """命中已启用的硬性规则 —— 只有这类才允许自动 REJECT（设计书 §5.7）。"""

    hard_fail_detail: str = ""


def _current_version(db: Session, rule_id: str) -> str | None:
    version = db.execute(
        select(ModerationRuleVersion)
        .where(
            ModerationRuleVersion.rule_id == rule_id,
            ModerationRuleVersion.is_current.is_(True),
        )
        .limit(1)
    ).scalar_one_or_none()
    # 注意是 rule_id —— 早前误写成 rule.id，而该作用域里没有 rule 变量，
    # 一旦某条规则存在版本记录就会抛 NameError。
    return f"{rule_id}@{version.version}" if version else rule_id


def check_deterministic(
    db: Session,
    *,
    fields: dict[str, str],
    submitter_id: str | None = None,
    recent_submissions: list[str] | None = None,
) -> DeterministicResult:
    """执行确定性规则检查。

    `fields` 是本次提交的文本字段映射（如 {"title": ..., "body": ...}）。
    """
    result = DeterministicResult()
    rules = db.execute(select(ModerationRule).where(ModerationRule.enabled.is_(True))).scalars().all()

    for rule in rules:
        version = _current_version(db, rule.id)
        if rule.rule_type != "deterministic":
            continue

        body = rule.body or ""
        matched = False
        detail = ""
        evidence: list[dict[str, Any]] = []

        if rule.name == "必填字段缺失":
            for fname, value in fields.items():
                if not (value or "").strip():
                    matched = True
                    detail = f"字段「{fname}」为空"
                    break

        elif rule.name == "内容长度超限":
            limit = 20000
            m = re.search(r"limit\s*=\s*(\d+)", body)
            if m:
                limit = int(m.group(1))
            for fname, value in fields.items():
                if len(value or "") > limit:
                    matched = True
                    detail = f"字段「{fname}」长度 {len(value)} 超过上限 {limit}"
                    break

        elif rule.name == "恶意链接域名":
            for fname, value in fields.items():
                for pattern in BLOCKED_DOMAIN_PATTERNS:
                    if pattern in (value or ""):
                        matched = True
                        detail = f"字段「{fname}」包含被禁用的域名"
                        evidence.append(
                            {"text_span": pattern, "rule_category": "malicious_link"}
                        )
                        break
                if matched:
                    break

        elif rule.name == "高频重复提交":
            if recent_submissions and len(recent_submissions) >= REPEAT_SUBMIT_THRESHOLD:
                matched = True
                detail = f"短时间内重复提交 {len(recent_submissions)} 次"

        if matched:
            hit = RuleHit(
                rule_id=rule.id,
                rule_version=version,
                rule_name=rule.name,
                matched=True,
                severity=rule.severity,
                detail=detail,
                evidence=evidence,
            )
            result.hits.append(hit)
            # 只有 severity=high 的确定性规则才允许自动拒绝
            if rule.severity == "high":
                result.hard_fail = True
                result.hard_fail_detail = detail

    return result


def get_enabled_rules(db: Session) -> list[ModerationRule]:
    """取全部启用的规则（确定性 + 语义），供语义分析提示词参考。

    语义规则只提供「判定要点」，**模型不得新增平台规则类别**
    （设计书 §5.6）。
    """
    return list(
        db.execute(select(ModerationRule).where(ModerationRule.enabled.is_(True))).scalars().all()
    )


def create_rule_version(
    db: Session,
    *,
    rule_id: str,
    body: str,
    change_reason: str,
    created_by: str | None,
) -> ModerationRuleVersion:
    """新增规则版本（旧版本保留以便回滚与归因）。"""
    import datetime

    current = db.execute(
        select(ModerationRuleVersion)
        .where(
            ModerationRuleVersion.rule_id == rule_id,
            ModerationRuleVersion.is_current.is_(True),
        )
        .limit(1)
    ).scalar_one_or_none()
    next_version = (current.version + 1) if current else 1

    if current:
        current.is_current = False

    version = ModerationRuleVersion(
        id=str(uuid.uuid4()),
        rule_id=rule_id,
        version=next_version,
        body=body,
        change_reason=change_reason,
        created_by=created_by,
        created_at=datetime.datetime.now(),
        is_current=True,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version
