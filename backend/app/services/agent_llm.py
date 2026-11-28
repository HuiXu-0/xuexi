"""三个 Agent 的模型调用层。

对应设计书 §8.2 的三个 Agent：
- 搜索 A：意图解析（§4.4）
- 审核 B：语义风险分析（§5.6）
- 规划 C：计划草案生成（§6.6）

**三条不可让步的约束**（设计书 §8.1）：
1. **不编造**：模型只能基于平台真实条目给建议。提示词里明确约束，
   且结果里的资源引用**必须**由服务端用真实 ID 重新查一遍（§6.10 校验器）。
2. **失败要明说**：模型不可用时抛 `LlmError`，由调用方降级成
   `safe_fallback`，**绝不**返回「看起来正常的空结果」。
3. **事实与判断分离**（§8.2.2）：审核输出里 `evidence` 是可核查的事实，
   `reasoning` 是模型的主观解释，可以被推翻。

模型输出统一按 JSON 解析；解析失败按 `LlmError` 处理，不做「猜一个默认值」的兜底。
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.services import llm_service

_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)


def extract_json(text: str) -> dict[str, Any]:
    """从模型回复里提取 JSON 对象。

    模型有时会包 ```json 围栏，有时会前后带解释文字。
    这里做容错提取；实在提不出就抛错，让调用方降级。
    """
    raw = (text or "").strip()
    if not raw:
        raise llm_service.LlmError("模型返回了空内容")

    candidates = [raw]
    m = _JSON_FENCE.search(raw)
    if m:
        candidates.insert(0, m.group(1).strip())

    for cand in candidates:
        try:
            data = json.loads(cand)
            if isinstance(data, dict):
                return data
        except ValueError:
            continue
        # 退化：截取第一个 { 到最后一个 } 之间的内容
        start = cand.find("{")
        end = cand.rfind("}")
        if start != -1 and end > start:
            try:
                data = json.loads(cand[start : end + 1])
                if isinstance(data, dict):
                    return data
            except ValueError:
                continue

    raise llm_service.LlmError(f"模型输出无法解析为 JSON：{raw[:160]}")


# ── A. 搜索：意图解析 ─────────────────────────────────────────
_INTENT_SYSTEM = """你是校园学习平台的搜索意图解析器。
把用户的中文查询解析成结构化意图，用于在站内检索真实条目。

只输出一个 JSON 对象，不要任何解释文字。字段：
{
  "topics": ["主题词"],
  "resource_types": [],
  "difficulty": [],
  "expanded_terms": ["同义词/近义词/上位词，用于扩大召回"],
  "intent_type": "keyword_lookup | learning_goal | comparison | other",
  "is_complex": false,
  "clarification_needed": false,
  "clarification_question": ""
}

规则：
- resource_types 只能取以下之一或多个：platform_note(笔记)、project_case(案例)、
  external_resource(外部资源)、competition(竞赛)、official_notice(官方通知)、
  learning_group(学习小组)、forum_post(论坛帖子)。没有明确指向就留空数组。
- difficulty 只能取 beginner / intermediate / advanced，没提到就留空。
- expanded_terms 最多 8 个，是用户没直接说但检索时该一起搜的词。
- 查询含糊、指向不明时 clarification_needed=true，并给出一句澄清问题。
- 你只解析意图，**不要编造具体资源名称或链接**。"""


def parse_intent(db: Session, query: str) -> dict[str, Any]:
    """用模型解析搜索意图。

    返回 dict（字段与前端 `IntentResult` 对齐）。
    失败抛 `LlmError` —— 调用方应回退到规则解析，而不是报错。
    """
    reply = llm_service.chat(
        db,
        system=_INTENT_SYSTEM,
        user=f"用户查询：{query}",
        max_tokens=600,
        temperature=0.0,
    )
    data = extract_json(reply.text)

    # 兜底清洗：模型可能给出不受控的取值
    allowed_types = {
        "platform_note",
        "project_case",
        "external_resource",
        "competition",
        "official_notice",
        "learning_group",
        "forum_post",
    }
    allowed_diff = {"beginner", "intermediate", "advanced"}

    def _clean_list(value: Any, allowed: set[str] | None = None, limit: int = 8) -> list[str]:
        if not isinstance(value, list):
            return []
        out = []
        for item in value:
            if not isinstance(item, str):
                continue
            item = item.strip()
            if not item:
                continue
            if allowed is not None and item not in allowed:
                continue
            if item not in out:
                out.append(item)
            if len(out) >= limit:
                break
        return out

    return {
        "topics": _clean_list(data.get("topics"), limit=8),
        "resource_types": _clean_list(data.get("resource_types"), allowed=allowed_types),
        "difficulty": _clean_list(data.get("difficulty"), allowed=allowed_diff, limit=3),
        "expanded_terms": _clean_list(data.get("expanded_terms"), limit=8),
        "intent_type": (
            data.get("intent_type")
            if data.get("intent_type")
            in ("keyword_lookup", "learning_goal", "comparison", "other")
            else "keyword_lookup"
        ),
        "is_complex": bool(data.get("is_complex")),
        "clarification_needed": bool(data.get("clarification_needed")),
        "clarification_question": (
            str(data.get("clarification_question")).strip()
            if data.get("clarification_question")
            else None
        ),
    }


# ── B. 审核：语义风险分析 ─────────────────────────────────────
_MODERATION_SYSTEM = """你是校园学习平台的内容审核助手。
对用户提交的文字内容做初步风险识别，只输出一个 JSON 对象，不要解释文字。

字段：
{
  "recommendation": "allow | review | reject",
  "risk_categories": ["辱骂骚扰|垃圾广告|恶意链接|敏感信息|疑似侵权|其他"],
  "risk_level": "low | medium | high",
  "evidence": [{"text_span": "原文里出问题的那一小段", "rule_category": "风险类别", "explanation": "为什么"}],
  "uncertainty_reasons": ["你拿不准的地方"],
  "reasoning": "整体判断的简短说明"
}

规则：
- 只在 evidence.text_span 里引用**原文里真实出现过**的片段，不要改写、不要编造。
- 拿不准的一律给 "review"，不要硬判 reject。
- 你的结论只是建议，最终由人工审核员决定。"""


def analyze_content(db: Session, fields: dict[str, str]) -> dict[str, Any]:
    """语义风险分析。返回字段与 `moderation_service.analyze_case` 期望的一致。"""
    body = "\n\n".join(f"[{k}]\n{v}" for k, v in fields.items() if v)
    reply = llm_service.chat(
        db,
        system=_MODERATION_SYSTEM,
        user=f"待审核内容：\n\n{body}",
        max_tokens=1200,
        temperature=0.0,
    )
    data = extract_json(reply.text)

    recommendation = data.get("recommendation")
    if recommendation not in ("allow", "review", "reject"):
        recommendation = "review"

    risk_level = data.get("risk_level")
    if risk_level not in ("low", "medium", "high"):
        risk_level = "medium"

    evidence = data.get("evidence")
    if not isinstance(evidence, list):
        evidence = []
    clean_evidence = []
    for item in evidence[:10]:
        if isinstance(item, dict) and isinstance(item.get("text_span"), str):
            clean_evidence.append(
                {
                    "text_span": item["text_span"][:200],
                    "rule_category": str(item.get("rule_category") or "其他")[:32],
                    "explanation": str(item.get("explanation") or "")[:300],
                }
            )

    categories = data.get("risk_categories")
    if not isinstance(categories, list):
        categories = []
    clean_categories = [str(c)[:32] for c in categories[:10] if isinstance(c, str)]

    uncertainty = data.get("uncertainty_reasons")
    if not isinstance(uncertainty, list):
        uncertainty = []

    return {
        "recommendation": recommendation,
        "risk_categories": clean_categories,
        "risk_level": risk_level,
        "evidence": clean_evidence,
        "uncertainty_reasons": [str(u)[:200] for u in uncertainty[:5] if isinstance(u, str)],
        "reasoning": str(data.get("reasoning") or "")[:1000],
    }


# ── C. 规划：计划草案 ─────────────────────────────────────────
_PLAN_SYSTEM = """你是校园学习规划助手。为学生制定分阶段学习计划草案。
只输出一个 JSON 对象，不要解释文字。

字段：
{
  "stages": [
    {
      "title": "阶段名称",
      "objective": "这个阶段要达成什么",
      "duration_weeks": 2,
      "weekly_minutes": 180,
      "tasks": [
        {"title": "任务名", "detail": "具体做什么", "completion_criteria": "做到什么程度算完成"}
      ],
      "resource_refs": ["资源ID"]
    }
  ],
  "assumptions": [{"text": "你做的假设，如「按每周 6 小时估算」", "based_on": "依据是什么"}],
  "risks": ["可能让计划走偏的因素"]
}

规则：
- 阶段之间有先后依赖，从基础到进阶。
- 每阶段至少 2 个任务，每个任务都要有明确的 completion_criteria。
- resource_refs 只能填**给定资源列表里真实存在的 ID**，绝对不要编造 ID。
- 信息不足时在 assumptions 里写明假设，不要当成已知事实。
- 计划总时长不要超过给定的周数与每周时间。"""


def generate_plan_draft(
    db: Session,
    *,
    goal_title: str,
    goal_description: str,
    weekly_minutes: int,
    max_weeks: int,
    skill_names: list[str],
    resource_ids: list[str],
) -> dict[str, Any]:
    """生成计划草案（未落库，需用户确认后才保存）。

    返回的 stages 里的 resource_refs 会由调用方**重新校验**
    （只保留真实存在且用户有权访问的资源），模型说的不算数。
    """
    user = (
        f"学习目标：{goal_title}\n"
        f"目标说明：{goal_description or '（未填写）'}\n"
        f"每周可投入：{weekly_minutes} 分钟\n"
        f"最长周期：{max_weeks} 周\n"
        f"涉及技能：{'、'.join(skill_names) if skill_names else '（未指定）'}\n"
        f"可关联资源ID（只能用这些）：{', '.join(resource_ids) if resource_ids else '（无）'}"
    )
    reply = llm_service.chat(
        db,
        system=_PLAN_SYSTEM,
        user=user,
        max_tokens=2000,
        temperature=0.2,
    )
    data = extract_json(reply.text)

    stages_raw = data.get("stages")
    if not isinstance(stages_raw, list) or not stages_raw:
        raise llm_service.LlmError("模型没有生成有效的阶段列表")

    stages = []
    for raw in stages_raw[:8]:
        if not isinstance(raw, dict):
            continue
        tasks_raw = raw.get("tasks")
        tasks = []
        if isinstance(tasks_raw, list):
            for t in tasks_raw[:10]:
                if isinstance(t, dict) and t.get("title"):
                    tasks.append(
                        {
                            "title": str(t["title"])[:120],
                            "detail": str(t.get("detail") or "")[:500],
                            "completion_criteria": str(t.get("completion_criteria") or "")[:300],
                        }
                    )
        if not tasks:
            continue
        refs = raw.get("resource_refs")
        if not isinstance(refs, list):
            refs = []
        stages.append(
            {
                "title": str(raw.get("title") or "未命名阶段")[:120],
                "objective": str(raw.get("objective") or "")[:400],
                "duration_weeks": int(raw.get("duration_weeks") or 1),
                "weekly_minutes": int(raw.get("weekly_minutes") or weekly_minutes),
                "tasks": tasks,
                "resource_refs": [str(r)[:64] for r in refs[:20] if isinstance(r, str)],
            }
        )

    if not stages:
        raise llm_service.LlmError("模型生成的阶段里没有有效任务")

    assumptions_raw = data.get("assumptions")
    assumptions = []
    if isinstance(assumptions_raw, list):
        for a in assumptions_raw[:10]:
            if isinstance(a, dict) and a.get("text"):
                assumptions.append(
                    {
                        "text": str(a["text"])[:300],
                        "based_on": str(a.get("based_on") or "模型推断")[:200],
                    }
                )
            elif isinstance(a, str) and a.strip():
                assumptions.append({"text": a.strip()[:300], "based_on": "模型推断"})

    risks_raw = data.get("risks")
    risks = [str(r)[:200] for r in (risks_raw or [])[:8] if isinstance(r, str)] if isinstance(risks_raw, list) else []

    return {"stages": stages, "assumptions": assumptions, "risks": risks}
