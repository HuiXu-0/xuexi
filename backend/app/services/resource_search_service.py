"""统一检索服务。

对应设计书 §4 的 ResourceSearchService。

**MySQL 的现实约束**（与设计书假设的 PostgreSQL 不同，这里做了取舍）：

设计书 §4.5 设想的是 PostgreSQL FTS + pgvector + RRF。
MySQL 8.x 的对应能力：
- 全文检索：InnoDB FULLTEXT 索引，支持 **ngram 解析器** ——
  中文分词的正确做法（默认的 latin parser 对中文无效）；
- 向量检索：MySQL 8 无原生向量类型。
  本实现把 embedding 存为 JSON，在应用层算余弦相似度。
  **当前数据量（几十条）下这完全够用**；数据量上万后再换专用向量库。

分阶段原则（设计书 §4.5「不要第一天就手工设定复杂的固定权重」
与 §4.6「首期最多允许一次自动二次检索」）：
- `enable_vector_search=false` 时只走全文 + 元数据通道；
- 语义扩展词作为第三种召回通道。

**权限过滤在检索阶段就做**，返回前再校验一次（设计书 §4.5 第三步）。
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.resources import Resource, ResourceTag, Tag
from app.services.permission_service import UserContext, visible_resource_filter


@dataclass
class SearchCandidate:
    """检索候选。只含用于排序的特征，不含最终展示内容。

    展示内容必须由 ResourceService 从数据库取（设计书 §4.5 第五步：
    「资源详情、作者、链接、时间、权限全部从数据库读取」）。
    """

    resource_id: str
    resource_type: str
    title: str
    summary: str
    tags: list[str] = field(default_factory=list)
    keywords: str = ""
    author_id: str | None = None
    updated_at: Any = None
    published_at: Any = None
    visibility: str = "campus"
    status: str = "published"
    difficulty: str | None = None
    quality_score: float = 0.5
    teacher_recommended: bool = False
    featured: bool = False
    # 命中的通道与分数，用于解释与调优
    channels: dict[str, float] = field(default_factory=dict)
    score: float = 0.0


# ── 中文分词与关键词提取 ─────────────────────────────────────

_CJK = re.compile(r"[一-鿿]+")
_LATIN = re.compile(r"[A-Za-z0-9_+#.-]+")


def tokenize(text: str) -> list[str]:
    """轻量分词：中文按字 + 双字组合，英文按词。

    不引入 jieba 之类的依赖 —— 索引规模小，双字组合已能覆盖大部分检索需求。
    """
    if not text:
        return []
    tokens: list[str] = []
    for seg in _CJK.findall(text):
        tokens.append(seg)
        for i in range(len(seg) - 1):
            tokens.append(seg[i : i + 2])
    tokens.extend(t.lower() for t in _LATIN.findall(text))
    return tokens


def extract_keywords(text: str) -> list[str]:
    """提取用于匹配的关键词。"""
    return [t for t in tokenize(text) if len(t) >= 2][:40]


# ── 全文检索 ────────────────────────────────────────────────


def _fulltext_search(db: Session, query: str, limit: int) -> list[tuple[str, float]]:
    """InnoDB 全文检索。

    优先用 MySQL 的 MATCH AGAINST（走 ngram 索引，性能好）；
    若索引不存在或查询失败，降级为 LIKE 扫描 —— 数据量小时完全可接受。

    注：MySQL 8.0.16+ 的 InnoDB FULLTEXT 需要显式建索引，且中文要用
    `WITH PARSER ngram`（默认 latin parser 对中文无效）。
    建表语句见 schema.sql 里的 `ft_search_text` 索引。
    """
    tokens = extract_keywords(query)
    if not tokens:
        return []

    try:
        # MySQL 的 BOOLEAN MODE 支持 + 前缀匹配
        boolean_query = " ".join(f"+{t}" for t in tokens[:6])
        rows = db.execute(
            select(
                Resource.id,
                func.match(Resource.ft_search_text, boolean_query).label("score"),
            )
            .limit(limit)
        ).all()
        if rows:
            return [(r[0], float(r[1] or 0)) for r in rows]
    except Exception:
        pass  # 索引不存在时降级

    # 降级：LIKE 扫描
    like_clauses = [Resource.title.like(f"%{t}%") for t in tokens[:4]]
    like_clauses += [Resource.summary.like(f"%{t}%") for t in tokens[:4]]
    rows = db.execute(
        select(Resource.id, Resource.updated_at)
        .where(or_(*like_clauses))
        .limit(limit)
    ).all()
    return [(r[0], 1.0) for r in rows]


# ── 向量检索 ────────────────────────────────────────────────


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _vector_search(db: Session, embedding: list[float], limit: int) -> list[tuple[str, float]]:
    """向量检索（应用层余弦相似度）。

    MySQL 8 无原生向量类型，embedding 存 resource_embedding_chunks.embedding_json。
    数据量小的时候全表算足够；上万条后应换 pgvector / 专用向量库。
    """
    from app.models.resources import ResourceEmbeddingChunk

    rows = db.execute(
        select(
            ResourceEmbeddingChunk.resource_id,
            ResourceEmbeddingChunk.embedding_json,
        ).limit(5000)
    ).all()
    scored: list[tuple[str, float]] = []
    for rid, emb_json in rows:
        try:
            import json

            vec = json.loads(emb_json)
        except (TypeError, ValueError):
            continue
        sim = _cosine(embedding, vec)
        if sim > 0.1:
            scored.append((rid, sim))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:limit]


# ── 排序融合 ────────────────────────────────────────────────


def rrf_fuse(channels: list[list[tuple[str, float]]], k: int = 60) -> dict[str, float]:
    """Reciprocal Rank Fusion。

    设计书 §4.5 第四步的公式：RRF(d) = Σ 1/(k + rank_r(d))
    首期用等权（不做复杂固定权重，设计书 §4.5 明确要求先积累标注再调）。
    """
    fused: dict[str, float] = {}
    for channel in channels:
        for rank, (doc_id, _score) in enumerate(channel):
            fused[doc_id] = fused.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return fused


def quality_signal(candidate: SearchCandidate) -> float:
    """质量信号（设计书 §4.5 第四步的排序因子之一）。"""
    base = candidate.quality_score
    if candidate.teacher_recommended:
        base += 0.15
    if candidate.featured:
        base += 0.1
    return min(base, 1.0)


def recency_score(updated_at: Any) -> float:
    """时效性：越新越靠前，但权重不高（设计书 §8.2.4「不应单纯因为新就排最前」）。"""
    if updated_at is None:
        return 0.3
    try:
        days = (datetime_now() - updated_at).days
    except (TypeError, AttributeError):
        return 0.3
    return max(0.15, 1.0 - days / 180.0)


def datetime_now():
    from datetime import datetime

    return datetime.now()


# ── 主入口 ──────────────────────────────────────────────────


def hybrid_search(
    db: Session,
    ctx: UserContext,
    query: str,
    resource_types: list[str] | None = None,
    filters: dict[str, Any] | None = None,
    limit: int = 30,
    embedding: list[float] | None = None,
) -> list[SearchCandidate]:
    """混合检索。

    通道：
      1. 全文检索（标题 + 摘要 + 关键词）
      2. 向量检索（可选，按配置开关）
      3. 元数据检索（类型 / 标签 / 作者 / 难度）

    权限过滤在**检索阶段**就完成（不是返回后过滤）。
    """
    filters = filters or {}
    tokens = extract_keywords(query)

    # ── 基础查询条件（含权限过滤）──
    base: Select = select(Resource)
    vis = visible_resource_filter(ctx)
    if vis is not None:
        base = base.where(vis)
    # 只检索可用状态的内容
    base = base.where(Resource.status.in_(["published", "pending", "review"]))
    if resource_types:
        base = base.where(Resource.resource_type.in_(resource_types))
    if filters.get("difficulty"):
        base = base.where(Resource.difficulty.in_(filters["difficulty"]))
    if filters.get("tag"):
        base = base.join(ResourceTag).join(Tag).where(Tag.name == filters["tag"])

    rows = db.execute(base).scalars().all()

    # ── 组装候选并打分 ──
    candidates: dict[str, SearchCandidate] = {}
    for r in rows:
        tag_names = [rt.tag.name for rt in r.tags if rt.tag]
        candidates[r.id] = SearchCandidate(
            resource_id=r.id,
            resource_type=r.resource_type,
            title=r.title,
            summary=r.summary or "",
            tags=tag_names,
            keywords=" ".join(tag_names),
            author_id=r.author_id,
            updated_at=r.updated_at,
            published_at=r.published_at,
            visibility=r.visibility,
            status=r.status,
            difficulty=r.difficulty,
            quality_score=r.quality_score,
            teacher_recommended=r.teacher_recommended,
            featured=r.featured,
        )

    if not candidates:
        return []

    # ── 通道 1：全文 / 字面匹配 ──
    literal_scores: dict[str, float] = {}
    for cid, cand in candidates.items():
        haystack = f"{cand.title} {cand.summary} {cand.keywords}".lower()
        score = 0.0
        for token in tokens:
            if token.lower() in haystack:
                # 标题命中权重更高（设计书 §4.5 第四步）
                score += 1.0 if token.lower() in cand.title.lower() else 0.4
        if score > 0:
            literal_scores[cid] = score

    # ── 通道 2：向量语义 ──
    vector_scores: dict[str, float] = {}
    if embedding:
        for rid, sim in _vector_search(db, embedding, limit):
            if rid in candidates:
                vector_scores[rid] = sim

    # ── 通道 3：语义扩展词匹配（LLM 生成的扩展词）──
    expansion_scores: dict[str, float] = {}
    expanded = filters.get("expanded_terms") or []
    if expanded:
        for cid, cand in candidates.items():
            haystack = f"{cand.title} {cand.summary} {cand.keywords}".lower()
            hit = sum(1.0 for term in expanded if str(term).lower() in haystack)
            if hit:
                expansion_scores[cid] = hit

    # ── 融合 ──
    channels = [
        sorted(literal_scores.items(), key=lambda x: x[1], reverse=True),
        sorted(vector_scores.items(), key=lambda x: x[1], reverse=True),
        sorted(expansion_scores.items(), key=lambda x: x[1], reverse=True),
    ]
    fused = rrf_fuse(channels)

    # ── 综合打分 ──
    for cid, cand in candidates.items():
        relevance = literal_scores.get(cid, 0.0)
        cand.channels = {
            "literal": relevance,
            "vector": vector_scores.get(cid, 0.0),
            "expansion": expansion_scores.get(cid, 0.0),
        }
        cand.score = (
            fused.get(cid, 0.0) * 100
            + relevance * 0.8
            + quality_signal(cand) * 0.5
            + recency_score(cand.updated_at) * 0.35
        )

    ranked = sorted(candidates.values(), key=lambda c: c.score, reverse=True)

    # ── 返回前二次校验权限（设计书 §4.5 第三步）──
    safe: list[SearchCandidate] = []
    for cand in ranked:
        resource = db.get(Resource, cand.resource_id)
        if resource is None:
            continue
        from app.services.permission_service import can_view_resource

        if not can_view_resource(ctx, resource):
            continue
        safe.append(cand)
        if len(safe) >= limit:
            break
    return safe


def validate_access(
    db: Session, ctx: UserContext, resource_ids: list[str]
) -> set[str]:
    """校验用户可访问的资源 ID 集合。

    对应设计书 §4.7 的 ResourceSearchService.validate_access。
    """
    if not resource_ids:
        return set()
    rows = db.execute(
        select(Resource).where(Resource.id.in_(resource_ids))
    ).scalars().all()
    from app.services.permission_service import can_view_resource

    return {r.id for r in rows if can_view_resource(ctx, r)}


def coverage_of(
    candidates: list[SearchCandidate], expected_types: list[str] | None
) -> dict[str, Any]:
    """计算检索覆盖度（设计书 §8.2.2 的 coverage 字段）。

    搜到 2 条笔记但一条小组都没搜到时，界面要显示
    「本次未找到学习小组类结果」——而不是让用户以为平台上就没有小组。
    """
    expected = expected_types or []
    found = sorted({c.resource_type for c in candidates})
    missing = [t for t in expected if t not in found]
    return {
        "expected_types": expected,
        "found_types": found,
        "missing_types": missing,
    }
