"""知识服务。

对应设计书 §3.1 的 KnowledgeService。

**防环检查**（设计书 §2.4 约束 1）：
`prerequisiteOf` 必须是有向无环图（DAG）。禁止 A 先修 B、B 又先修 A。

**Agent 只能提建议**（设计书 §2.7）：
新增、合并、停用核心概念需管理员或指定维护者确认。
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import OntologyRelationInvalid
from app.models.learning import (
    KnowledgeConcept,
    KnowledgeRelation,
    Skill,
    SkillConceptRelation,
)


def get_concept(db: Session, concept_id: str) -> KnowledgeConcept | None:
    return db.get(KnowledgeConcept, concept_id)


def list_concepts(db: Session, domain_id: str | None = None) -> list[KnowledgeConcept]:
    query = select(KnowledgeConcept).where(KnowledgeConcept.status == "active")
    if domain_id:
        query = query.where(KnowledgeConcept.domain_id == domain_id)
    return list(db.execute(query.order_by(KnowledgeConcept.canonical_name)).scalars().all())


def would_create_cycle(
    db: Session, source_id: str, target_id: str, relation_type: str = "prerequisite_of"
) -> bool:
    """检查新增关系是否会形成环。

    做法：从 target 出发做 DFS，若能走回 source 就是环。
    """
    if source_id == target_id:
        return True

    adjacency: dict[str, list[str]] = {}
    rows = db.execute(
        select(KnowledgeRelation).where(
            KnowledgeRelation.relation_type == relation_type
        )
    ).scalars().all()
    for r in rows:
        adjacency.setdefault(r.source_id, []).append(r.target_id)

    # 假设新增 source → target，则从 target 出发能否回到 source？
    stack = [target_id]
    visited: set[str] = set()
    while stack:
        current = stack.pop()
        if current == source_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        stack.extend(adjacency.get(current, []))

    return False


def add_relation(
    db: Session,
    *,
    source_id: str,
    target_id: str,
    relation_type: str = "prerequisite_of",
    confidence_label: str = "unknown",
    source_type: str = "teacher",
    source_ref_id: str | None = None,
) -> KnowledgeRelation:
    """新增知识关系（带防环检查）。"""
    if get_concept(db, source_id) is None or get_concept(db, target_id) is None:
        raise OntologyRelationInvalid("知识概念不存在。")

    if would_create_cycle(db, source_id, target_id, relation_type):
        raise OntologyRelationInvalid(
            "该关系会形成循环依赖。先修关系必须是有向无环图（DAG）。"
        )

    relation = KnowledgeRelation(
        id=str(uuid.uuid4()),
        source_id=source_id,
        relation_type=relation_type,
        target_id=target_id,
        confidence_label=confidence_label,
        source_type=source_type,
        source_ref_id=source_ref_id,
        version=1,
    )
    db.add(relation)
    db.commit()
    db.refresh(relation)
    return relation


def prerequisites(db: Session, concept_id: str) -> list[str]:
    """取某概念的全部先修概念 ID。

    方向：relation source → target 表示 source 是 target 的先修。
    所以 concept_id 的先修是所有 source_id where target_id = concept_id。
    """
    rows = db.execute(
        select(KnowledgeRelation.source_id).where(
            KnowledgeRelation.target_id == concept_id,
            KnowledgeRelation.relation_type == "prerequisite_of",
        )
    ).scalars().all()
    return list(rows)


def descendants(db: Session, concept_id: str) -> list[str]:
    """取某概念的全部后继（依赖它的概念），用于知识路径展开。"""
    rows = db.execute(
        select(KnowledgeRelation.target_id).where(
            KnowledgeRelation.source_id == concept_id,
            KnowledgeRelation.relation_type == "prerequisite_of",
        )
    ).scalars().all()
    return list(rows)


def topological_order(db: Session, concept_ids: list[str]) -> list[str]:
    """对给定的概念集合做拓扑排序，得到学习顺序。

    只在子图内排序；子图有环时（理论上不该有，因为写入时做了防环检查）
    退化为原顺序，不抛错 —— 保证规划流程不中断。
    """
    subset = set(concept_ids)
    rows = db.execute(
        select(KnowledgeRelation).where(
            KnowledgeRelation.relation_type == "prerequisite_of",
            KnowledgeRelation.source_id.in_(subset),
            KnowledgeRelation.target_id.in_(subset),
        )
    ).scalars().all()

    in_degree: dict[str, int] = {cid: 0 for cid in concept_ids}
    adjacency: dict[str, list[str]] = {cid: [] for cid in concept_ids}
    for r in rows:
        adjacency[r.source_id].append(r.target_id)
        in_degree[r.target_id] = in_degree.get(r.target_id, 0) + 1

    queue = [cid for cid in concept_ids if in_degree.get(cid, 0) == 0]
    queue.sort()
    ordered: list[str] = []

    while queue:
        current = queue.pop(0)
        ordered.append(current)
        for nxt in adjacency.get(current, []):
            in_degree[nxt] -= 1
            if in_degree[nxt] == 0:
                queue.append(nxt)
        queue.sort()

    if len(ordered) != len(concept_ids):
        # 有环：补齐剩余节点，保持流程可用
        for cid in concept_ids:
            if cid not in ordered:
                ordered.append(cid)
    return ordered


def skills_for_concepts(db: Session, concept_ids: list[str]) -> list[str]:
    """取覆盖这些知识点的能力项。"""
    if not concept_ids:
        return []
    rows = db.execute(
        select(SkillConceptRelation.skill_id).where(
            SkillConceptRelation.concept_id.in_(concept_ids)
        )
    ).scalars().all()
    return list(dict.fromkeys(rows))


def concepts_for_skills(db: Session, skill_ids: list[str]) -> list[str]:
    """取这些能力项关联的知识概念。"""
    if not skill_ids:
        return []
    rows = db.execute(
        select(SkillConceptRelation.concept_id).where(
            SkillConceptRelation.skill_id.in_(skill_ids)
        )
    ).scalars().all()
    return list(dict.fromkeys(rows))
