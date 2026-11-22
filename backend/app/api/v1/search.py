"""搜索 Agent 接口。

对应设计书 §4.8。

**响应形状严格按设计书 §8.2 的 envelope**：
    { request_id, agent, status, data, warnings, trace_id }

data 里的资源信息**全部由 ResourceService 从数据库填充**，
LLM 只能提供意图、扩展词和摘要草案（设计书 §4.5 第五步）。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import CurrentUser, DbSession
from app.core.envelope import AgentEnvelope, envelope
from app.models.resources import Resource
from app.services.resource_search_service import (
    SearchCandidate,
    coverage_of,
    hybrid_search,
)
from app.services.resource_service import build_resource_card

router = APIRouter(prefix="/api/agents", tags=["agents"])

AGENT_KEY = "search_agent"


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    filters: dict[str, Any] = Field(default_factory=dict)
    resource_types: list[str] = Field(default_factory=list)
    limit: int = Field(default=20, ge=1, le=100)


class IntentResult(BaseModel):
    """意图结构化结果。

    简单查询用规则解析即可；复杂查询可接入 LLM（设计书 §4.4）。
    无论哪种来源，**扩展词只能用于检索，不得直接成为结果事实**。
    """

    topics: list[str] = Field(default_factory=list)
    resource_types: list[str] = Field(default_factory=list)
    difficulty: list[str] = Field(default_factory=list)
    expanded_terms: list[str] = Field(default_factory=list)
    intent_type: str = "keyword_lookup"
    is_complex: bool = False
    clarification_needed: bool = False
    clarification_question: str | None = None


def parse_intent(query: str) -> IntentResult:
    """规则版意图解析。

    **这一版不调用 LLM**。原因（见分析）：
    平台当前内容仅几十条，字面匹配已接近全召回；
    意图理解的价值要等内容规模上来才能测量。
    接入 LLM 时只需替换本函数的实现，接口不变。
    """
    q = query.strip()
    lowered = q.lower()

    # 学习目标型查询：含「想学 / 从零 / 入门 / 怎么 / 如何 / 学习」等意图词
    goal_markers = ["从零", "零基础", "入门", "想学", "学习", "怎么", "如何", "准备", "计划"]
    is_goal = any(m in lowered for m in goal_markers)

    # 类型推断
    types: list[str] = []
    type_markers = {
        "笔记": "platform_note",
        "案例": "project_case",
        "资源": "external_resource",
        "竞赛": "competition",
        "通知": "official_notice",
        "小组": "learning_group",
        "帖子": "forum_post",
        "讨论": "forum_post",
    }
    for word, rtype in type_markers.items():
        if word in lowered:
            types.append(rtype)

    # 难度推断
    difficulty: list[str] = []
    if any(m in lowered for m in ["入门", "零基础", "初级", "简单"]):
        difficulty.append("beginner")
    if any(m in lowered for m in ["进阶", "高级", "深入"]):
        difficulty.append("advanced")

    # 主题与扩展词：取查询中的技术名词片段
    topics = [w for w in _split_terms(q) if len(w) >= 2]

    return IntentResult(
        topics=topics[:8],
        resource_types=types,
        difficulty=difficulty,
        expanded_terms=[],
        intent_type="learning_goal" if is_goal else "keyword_lookup",
        is_complex=is_goal and len(types) > 1,
    )


def _split_terms(text: str) -> list[str]:
    """从查询里切出候选术语。轻量实现，不做真正的分词。"""
    import re

    terms = re.findall(r"[A-Za-z][A-Za-z0-9+#._-]{1,30}|[一-鿿]{2,8}", text)
    return terms


@router.post("/search", response_model=AgentEnvelope)
def search(payload: SearchRequest, ctx: CurrentUser, db: DbSession) -> AgentEnvelope:
    """搜索。

    简单查询直通检索；复杂查询才需要多路编排（设计书 §4.6）。
    当前实现统一走混合检索 —— 编排逻辑在服务层，接口不变。
    """
    intent = parse_intent(payload.query)

    filters: dict[str, Any] = dict(payload.filters)
    filters["expanded_terms"] = intent.expanded_terms
    if intent.difficulty and not filters.get("difficulty"):
        filters["difficulty"] = intent.difficulty

    types = payload.resource_types or intent.resource_types

    candidates: list[SearchCandidate] = hybrid_search(
        db,
        ctx,
        payload.query,
        resource_types=types or None,
        filters=filters,
        limit=payload.limit,
    )

    # 卡片由数据库填充，不接受模型生成（设计书 §4.5 第五步）
    groups: dict[str, list[dict[str, Any]]] = {}
    for cand in candidates:
        resource = db.get(Resource, cand.resource_id)
        if resource is None:
            continue
        card = build_resource_card(db, ctx, resource)
        card["score"] = round(cand.score, 4)
        card["matched_channels"] = {
            k: round(v, 4) for k, v in cand.channels.items() if v > 0
        }
        groups.setdefault(cand.resource_type, []).append(card)

    coverage = coverage_of(candidates, types or None)

    warnings: list[str] = []
    if coverage["missing_types"]:
        warnings.append(
            "本次未找到以下类型的结果：" + "、".join(coverage["missing_types"])
        )
    if not candidates:
        warnings.append("没有找到匹配内容，可以尝试放宽关键词或换个说法。")

    status = "success" if candidates else "partial"

    return envelope(
        agent=AGENT_KEY,
        status=status,
        data={
            "interpreted_intent": {
                "topics": intent.topics,
                "intent_type": intent.intent_type,
                "resource_types": intent.resource_types,
                "expanded_terms": intent.expanded_terms,
                "is_complex": intent.is_complex,
            },
            "groups": [
                {"resource_type": rtype, "items": items} for rtype, items in groups.items()
            ],
            "coverage": coverage,
            "total": len(candidates),
        },
        warnings=warnings,
    )
