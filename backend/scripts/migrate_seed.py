"""数据迁移：把前端 src/data/*.js 的静态演示数据导入 MySQL。

对应设计书 §16.1 的「前后端职责边界」——
后端落地后，前端的数据层要从 `import { notes } from '../data/pages.js'`
改成 API 调用。

这个脚本**可重复执行**（幂等）：先清空目标表再写入，
避免重复导入产生脏数据。

用法：
    cd backend
    python -m scripts.migrate_seed
"""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import delete, select  # noqa: E402

from app.core.db import SessionLocal, engine  # noqa: E402
from app.models import *  # noqa: E402,F403
from app.models.learning import (  # noqa: E402
    KnowledgeConcept,
    KnowledgeDomain,
    KnowledgeRelation,
    ResourceConcept,
    Skill,
    SkillConceptRelation,
)
from app.models.resources import (  # noqa: E402
    Category,
    ForumGroup,
    ForumPost,
    Resource,
    ResourceCompetition,
    ResourceNote,
    ResourceTag,
    Tag,
)
from app.models.users import Permission, Role, RolePermission, User, UserRole  # noqa: E402
from app.services.auth_service import hash_password  # noqa: E402

# ══════════════════════════════════════════════════════════════
# 基础角色与权限（设计书 §12 角色 + 能力位模型）
# ══════════════════════════════════════════════════════════════

ROLES = [
    ("role_student", "student", "学生", "基础角色：搜索、学习、分享、讨论、参与小组、提交反馈"),
    ("role_teacher", "teacher", "教师", "基础角色：创建教师小组、推荐资源、按授权处理审核"),
    ("role_admin", "admin", "平台管理员", "平台运营与管理，含全部模块权限"),
]

PERMISSIONS = [
    ("perm_resource_read", "resource:read", None, "查看资源"),
    ("perm_resource_write", "resource:write", None, "创建与编辑资源"),
    ("perm_resource_publish", "resource:publish", None, "发布内容"),
    ("perm_group_create", "group:create", None, "创建学习小组"),
    ("perm_group_manage", "group:manage", None, "管理学习小组"),
    ("perm_recommend", "case:recommend", None, "推荐优秀案例"),
    ("perm_content_admin", "content:admin", None, "校级内容管理"),
    ("perm_review", "content:review", None, "内容审核职责"),
    ("perm_account_manage", "account:manage", None, "管理账号"),
    ("perm_rule_manage", "rule:manage", None, "管理审核规则"),
    ("perm_audit_view", "audit:view", None, "查看操作审计"),
    ("perm_feedback_manage", "feedback:manage", None, "处理反馈建议"),
]

ROLE_PERMISSIONS = {
    "role_student": [
        "perm_resource_read",
        "perm_resource_write",
        "perm_resource_publish",
        "perm_group_create",
    ],
    "role_teacher": [
        "perm_resource_read",
        "perm_resource_write",
        "perm_resource_publish",
        "perm_group_create",
        "perm_group_manage",
        "perm_recommend",
    ],
    "role_admin": [p[0] for p in PERMISSIONS],
}

DEMO_USERS = [
    ("u_student", "学生演示账号", "student@campus.test", "student", "role_student"),
    ("u_teacher", "教师演示账号", "teacher@campus.test", "teacher", "role_teacher"),
    ("u_admin", "管理员演示账号", "admin@campus.test", "admin", "role_admin"),
]

DEMO_PASSWORD = "campus2026"


def seed_roles_and_users(db) -> None:
    for rid, code, name, desc in ROLES:
        if db.get(Role, rid) is None:
            db.add(Role(id=rid, code=code, name=name, description=desc))
    for pid, code, scope, desc in PERMISSIONS:
        if db.get(Permission, pid) is None:
            db.add(Permission(id=pid, code=code, scope=scope, description=desc))
    db.flush()

    for role_id, perm_ids in ROLE_PERMISSIONS.items():
        for pid in perm_ids:
            exists = db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role_id,
                    RolePermission.permission_id == pid,
                )
            ).scalar_one_or_none()
            if exists is None:
                db.add(RolePermission(role_id=role_id, permission_id=pid))

    for uid, name, email, _kind, role_id in DEMO_USERS:
        if db.get(User, uid) is None:
            db.add(
                User(
                    id=uid,
                    display_name=name,
                    email=email,
                    password_hash=hash_password(DEMO_PASSWORD),
                    status="active",
                    violations=0,
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )
            )
            db.add(UserRole(user_id=uid, role_id=role_id, granted_at=datetime.now()))
    db.commit()


def clear_content(db) -> None:
    """清空内容表（保留用户/角色/权限）。"""
    for model in (
        LearningTaskResource,
        LearningTaskConcept,
        LearningTaskSkill,
        LearningTask,
        PlanStage,
        LearningPlan,
        CapabilityEvidence,
        LearningGoal,
        LearningProfile,
        ResourceConcept,
        SkillConceptRelation,
        KnowledgeRelation,
        Skill,
        KnowledgeConcept,
        KnowledgeDomain,
        ResourceTag,
        Tag,
        Category,
        ForumPost,
        ForumGroup,
        ResourceNote,
        ResourceCompetition,
        Resource,
        ResourceExternal,
        ResourceProjectCase,
        ResourceOfficialNotice,
    ):
        db.execute(delete(model))
    db.commit()


def seed_content(db) -> None:
    """导入前端静态数据。

    数据源是前端的 data/*.js —— 保持两边内容一致，
    迁移后前端就能改成调 API 而不用重录内容。
    """
    import importlib.util

    def load_js(name: str):
        """加载前端 ES 模块数据（不启动 vite，只取数据）。"""
        path = PROJECT_ROOT / "src" / "data" / f"{name}.js"
        spec = importlib.util.spec_from_file_location(f"fe_{name}", path)
        module = importlib.util.module_from_spec(spec)
        # 前端数据文件不 import 其他前端模块，直接执行即可
        spec.loader.exec_module(module)
        return module

    pages = load_js("pages")
    content = load_js("content")
    dict_mod = load_js("dict")

    teacher = load_js("teacher")

    # ── 标签 ──
    tag_ids: dict[tuple[str, str], str] = {}
    for group_key, group_label in dict_mod.tagGroups:
        for name in dict_mod.tagOptions.get(group_key, []):
            tid = f"tag_{uuid.uuid4().hex[:8]}"
            db.add(
                Tag(id=tid, name=name, tag_group=group_key, status="active")
            )
            tag_ids[(group_key, name)] = tid
    db.flush()

    # ── 分类 ──
    cat_ids: dict[str, str] = {}
    for name in ["学习笔记", "外部资源", "优秀案例", "竞赛", "官方通知", "论坛讨论"]:
        cid = f"cat_{uuid.uuid4().hex[:8]}"
        db.add(Category(id=cid, name=name, kind="resource", status="active"))
        cat_ids[name] = cid
    db.flush()

    def add_resource(
        *,
        rid: str,
        rtype: str,
        title: str,
        summary: str,
        desc: str,
        tags: list[str],
        author_id: str | None,
        updated_at: str | None = None,
        quality: float = 0.5,
        recommended: bool = False,
        featured: bool = False,
        visibility: str = "campus",
    ) -> Resource:
        dt = _parse_date(updated_at)
        search_text = f"{title} {summary} {' '.join(tags)}"
        resource = Resource(
            id=rid,
            resource_type=rtype,
            title=title,
            summary=summary,
            author_id=author_id,
            created_by=author_id,
            status="published",
            visibility=visibility,
            license_code="allow_share_with_attribution",
            quality_score=quality,
            teacher_recommended=recommended,
            featured=featured,
            version=1,
            ft_search_text=search_text,
            published_at=dt,
            updated_at=dt or datetime.now(),
            created_at=dt or datetime.now(),
        )
        db.add(resource)
        for tag_name in tags:
            key = ("tech", tag_name)
            if key in tag_ids:
                db.add(ResourceTag(resource_id=rid, tag_id=tag_ids[key]))
        return resource

    # ── 官方通知 ──
    for notice in teacher.officialNotices:
        add_resource(
            rid=notice["id"],
            rtype="official_notice",
            title=notice["title"],
            summary=notice["body"],
            desc=notice["body"],
            tags=[],
            author_id="u_admin",
            updated_at=notice.get("publishedAt"),
            quality=0.95,
            featured=True,
        )

    # ── 学习笔记 ──
    for note in pages.notes:
        add_resource(
            rid=f"note_{note['id']}",
            rtype="platform_note",
            title=note["title"],
            summary=note["desc"],
            desc=note["desc"],
            tags=note.get("tags", []),
            author_id="u_student",
            updated_at="2026-10-30",
            quality=0.65,
        )

    # ── 外部资源 ──
    for res in pages.resources:
        add_resource(
            rid=f"res_{res['id']}",
            rtype="external_resource",
            title=res["title"],
            summary=res["desc"],
            desc=res["desc"],
            tags=res.get("tags", []),
            author_id="u_teacher",
            updated_at="2026-10-25",
            quality=0.75,
        )

    # ── 优秀案例 ──
    for case in pages.cases:
        add_resource(
            rid=f"case_{case['id']}",
            rtype="project_case",
            title=case["title"],
            summary=case["desc"],
            desc=case["desc"],
            tags=case.get("tags", []),
            author_id="u_student",
            updated_at="2026-11-03",
            quality=0.7,
        )

    # ── 竞赛 ──
    for comp in pages.competitionTimeline:
        add_resource(
            rid=f"comp_{comp['id']}",
            rtype="competition",
            title=comp["title"],
            summary=comp["desc"],
            desc=comp["desc"],
            tags=comp.get("category", "") and [comp["category"]] or [],
            author_id="u_admin",
            updated_at="2026-10-18",
            quality=0.9,
        )

    # ── 首页竞赛与发现（内容模块）──
    for comp in content.homeCompetitions:
        add_resource(
            rid=f"hcomp_{uuid.uuid4().hex[:8]}",
            rtype="competition",
            title=comp["title"],
            summary=comp["desc"],
            desc=comp["desc"],
            tags=comp.get("category", "") and [comp["category"]] or [],
            author_id="u_admin",
            updated_at="2026-10-20",
            quality=0.85,
        )
    for disc in content.homeDiscover:
        rtype = {
            "case": "project_case",
            "resource": "external_resource",
            "note": "platform_note",
        }.get(disc.get("type"), "platform_note")
        add_resource(
            rid=f"disc_{uuid.uuid4().hex[:8]}",
            rtype=rtype,
            title=disc["title"],
            summary=disc["desc"],
            desc=disc["desc"],
            tags=disc.get("tags", []),
            author_id="u_student",
            updated_at="2026-11-02",
            quality=0.7,
        )

    db.flush()

    # ── 小组 ──
    for group in pages.forumGroups:
        gid = f"fg_{group['id']}"
        db.add(
            ForumGroup(
                id=gid,
                name=group["title"],
                description=group.get("desc", ""),
                creator_id="u_teacher",
                join_policy="approve",
                visibility="campus",
                status="active",
                channels=json.dumps(
                    [
                        {"key": "notice", "label": "公告/通知", "enabled": True, "count": 2},
                        {"key": "discussion", "label": "讨论", "enabled": True, "count": 5},
                        {"key": "question", "label": "问题求助", "enabled": True, "count": 3},
                        {"key": "resource", "label": "资源分享", "enabled": True, "count": 4},
                        {"key": "task", "label": "活动/任务", "enabled": False, "count": 0},
                        {"key": "feedback", "label": "反馈建议", "enabled": False, "count": 0},
                    ],
                    ensure_ascii=False,
                ),
                rules=json.dumps(
                    ["提问时贴出复现步骤", "资源分享需注明来源", "禁止发布与主题无关的推广"],
                    ensure_ascii=False,
                ),
                member_count=len(group.get("tags", [])) * 6 + 4,
                created_at=datetime.now(),
            )
        )

    # ── 帖子 ──
    for post in pages.forumPostsSeed:
        db.add(
            ForumPost(
                id=f"fp_{post['id']}",
                group_id=None,
                author_id="u_student",
                title=post["title"],
                body=post.get("desc", ""),
                kind=post.get("kind"),
                status="published",
                created_at=datetime.now() - timedelta(days=7),
            )
        )

    db.flush()

    # ── 审核规则（确定性 + 语义）──
    rules = [
        ("mr_required", "必填字段缺失", "deterministic", "全部提交字段", "high", "标题与正文不得为空"),
        ("mr_length", "内容长度超限", "deterministic", "全部提交字段", "medium", "limit = 20000"),
        ("mr_badlink", "恶意链接域名", "deterministic", "帖子 / 资源链接", "high", ""),
        ("mr_repeat", "高频重复提交", "deterministic", "全部提交字段", "medium", ""),
        (
            "mr_abuse",
            "辱骂与人身攻击",
            "semantic",
            "全部文字字段",
            "high",
            "判断是否针对具体用户；引用、教学讨论、批评不计入",
        ),
        (
            "mr_spam",
            "垃圾广告与刷屏",
            "semantic",
            "笔记 / 帖子 / 资源简介",
            "medium",
            "结合频率与内容特征判断明显无关推广",
        ),
        (
            "mr_malicious",
            "恶意链接与诈骗",
            "semantic",
            "帖子 / 资源链接",
            "high",
            "识别诱导下载、虚假中奖、仿冒官方",
        ),
        (
            "mr_privacy",
            "未授权公开敏感信息",
            "semantic",
            "头像名称 / 个人简介",
            "high",
            "识别手机号、身份证号、住址等",
        ),
        (
            "mr_infringe",
            "侵权与未经授权转载",
            "semantic",
            "优秀案例 / 附件",
            "high",
            "只标记疑点，不自动作法律定性",
        ),
        (
            "mr_policy",
            "违反平台社区规则",
            "semantic",
            "全部文字字段",
            "medium",
            "必须对应已发布规则，不得自行扩充禁止范围",
        ),
    ]
    for rid, name, rtype, scope, severity, body in rules:
        db.add(
            ModerationRule(
                id=rid,
                name=name,
                rule_type=rtype,
                scope=scope,
                severity=severity,
                enabled=True,
                body=body,
                created_at=datetime.now(),
            )
        )
        db.add(
            ModerationRuleVersion(
                id=f"mrv_{rid}_1",
                rule_id=rid,
                version=1,
                body=body,
                change_reason="初始版本",
                created_by="u_admin",
                created_at=datetime.now(),
                is_current=True,
            )
        )

    db.flush()

    # ── 知识本体（最小可用集：够跑通规划流程）──
    domain = KnowledgeDomain(id="kd_embedded", name="嵌入式系统")
    db.add(domain)

    concepts = [
        ("kc_c", "C 语言基础", "kd_embedded", "beginner"),
        ("kc_espt", "ESP32 入门", "kd_embedded", "beginner"),
        ("kc_sensor", "传感器与采样", "kd_embedded", "intermediate"),
        ("kc_control", "闭环控制基础", "kd_embedded", "intermediate"),
        ("kc_project", "小车项目实践", "kd_embedded", "advanced"),
    ]
    for cid, name, did, diff in concepts:
        db.add(
            KnowledgeConcept(
                id=cid,
                canonical_name=name,
                description=f"{name}相关知识",
                domain_id=did,
                difficulty=diff,
                status="active",
            )
        )
    db.flush()

    # 先修关系（构成 DAG：c → espt → sensor → control → project）
    prereq = [
        ("kc_c", "kc_espt"),
        ("kc_espt", "kc_sensor"),
        ("kc_sensor", "kc_control"),
        ("kc_control", "kc_project"),
    ]
    for src, tgt in prereq:
        db.add(
            KnowledgeRelation(
                id=f"kr_{src}_{tgt}",
                source_id=src,
                relation_type="prerequisite_of",
                target_id=tgt,
                confidence_label="reviewed",
                source_type="teacher",
                version=1,
                created_at=datetime.now(),
            )
        )

    skills = [
        ("sk_c", "C 语言编程", "kc_c"),
        ("sk_embedded", "嵌入式开发", "kc_espt"),
        ("sk_sensor", "传感器应用", "kc_sensor"),
        ("sk_project", "完整项目交付", "kc_project"),
    ]
    for sid, sname, cid in skills:
        db.add(Skill(id=sid, name=sname, description=f"{sname}能力"))
        db.add(
            SkillConceptRelation(
                id=f"scr_{sid}",
                skill_id=sid,
                concept_id=cid,
                confidence_label="reviewed",
                source_type="teacher",
            )
        )

    # 资源 ↔ 知识点
    concept_resource_map = {
        "kc_c": [f"note_{n['id']}" for n in pages.notes[:2]],
        "kc_espt": [f"res_{r['id']}" for r in pages.resources[:2]],
        "kc_sensor": [f"res_{r['id']}" for r in pages.resources[2:]],
        "kc_project": [f"case_{c['id']}" for c in pages.cases],
    }
    for cid, rids in concept_resource_map.items():
        for rid in rids:
            if db.get(Resource, rid) is not None:
                db.add(
                    ResourceConcept(
                        id=f"rc_{uuid.uuid4().hex[:8]}",
                        resource_id=rid,
                        concept_id=cid,
                        relation_type="about",
                        confidence_label="reviewed",
                        source_type="teacher",
                    )
                )

    db.commit()


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M", "%Y/%m/%d"):
        try:
            return datetime.strptime(str(value), fmt)
        except ValueError:
            continue
    return None


def main() -> None:
    print("开始迁移…")
    db = SessionLocal()
    try:
        print("  1/3 角色与权限…")
        seed_roles_and_users(db)
        print("  2/3 清空内容表…")
        clear_content(db)
        print("  3/3 导入内容数据…")
        seed_content(db)

        counts = {
            "资源": db.execute(select(Resource.id)).scalars().all(),
            "小组": db.execute(select(ForumGroup.id)).scalars().all(),
            "帖子": db.execute(select(ForumPost.id)).scalars().all(),
            "标签": db.execute(select(Tag.id)).scalars().all(),
            "知识点": db.execute(select(KnowledgeConcept.id)).scalars().all(),
            "规则": db.execute(select(ModerationRule.id)).scalars().all(),
            "用户": db.execute(select(User.id)).scalars().all(),
        }
        print("\n导入完成：")
        for name, ids in counts.items():
            print(f"  {name}: {len(ids)}")
        print(f"\n演示账号密码：{DEMO_PASSWORD}")
        print("  学生演示账号 / teacher@campus.test / admin@campus.test")
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main()
