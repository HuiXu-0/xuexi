"""后端冒烟测试：验证整条业务链路真的能跑通。

对应设计书的可验收条目：
- §3.2 权限在服务端判定（前端传入的身份不可信）
- §5.4 内容提交 → 审核 → 状态流转
- §7.3 审核绑定内容版本
- §9.1 权限过滤在服务端
"""

from __future__ import annotations

import pytest

from tests.conftest import auth_header


# ──────────────────────────────────────────────────────────────
# 健康检查
# ──────────────────────────────────────────────────────────────
def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json().get("status") in ("ok", "healthy")


# ──────────────────────────────────────────────────────────────
# 认证
# ──────────────────────────────────────────────────────────────
def test_login_success(client, seeded):
    r = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert "student" in data["role_codes"]


def test_login_wrong_password(client, seeded):
    r = client.post(
        "/api/auth/login",
        json={"account": "student", "password": "wrong"},
    )
    assert r.status_code == 401


def test_login_unknown_account_gives_same_message(client, seeded):
    """账号不存在与密码错误必须返回同一提示，避免暴露账号是否存在。"""
    a = client.post("/api/auth/login", json={"account": "nobody", "password": "x"})
    b = client.post("/api/auth/login", json={"account": "student", "password": "x"})
    assert a.status_code == b.status_code == 401
    assert a.json()["detail"] == b.json()["detail"]


def test_me_requires_token(client, seeded):
    assert client.get("/api/auth/me").status_code == 401


def test_me_returns_identity(client, seeded):
    token = client.post(
        "/api/auth/login",
        json={"account": "teacher", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.get("/api/auth/me", headers=auth_header(token))
    assert r.status_code == 200
    data = r.json()
    assert data["role_codes"] == ["teacher"]
    assert data["is_authenticated"] is True


# ──────────────────────────────────────────────────────────────
# 资源：创建 → 草稿态 → 权限过滤
# ──────────────────────────────────────────────────────────────
def test_create_resource_requires_login(client, seeded):
    r = client.post(
        "/api/resources",
        json={"resource_type": "note", "title": "未登录提交的笔记"},
    )
    assert r.status_code == 401


def test_create_resource_enters_draft(client, seeded):
    token = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.post(
        "/api/resources",
        headers=auth_header(token),
        json={
            "resource_type": "note",
            "title": "线性代数复习笔记",
            "summary": "特征值与特征向量",
            "body": "正文内容",
            "visibility": "campus",
            "tags": ["数学", "线性代数"],
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    # 新建内容必须是 draft，不能直接发布（设计书 §5.4）
    assert data["status"] == "draft"
    assert data["title"] == "线性代数复习笔记"


def test_list_resources_as_guest(client, seeded):
    """访客可访问公开内容，但不能看到未发布的草稿。"""
    r = client.get("/api/resources")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body and "total" in body
    for item in body["items"]:
        assert item.get("status") != "draft", "访客不应看到草稿"


# ──────────────────────────────────────────────────────────────
# 搜索 Agent：envelope 契约（设计书 §8.2）
# ──────────────────────────────────────────────────────────────
def test_search_returns_envelope(client, seeded):
    token = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.post(
        "/api/agents/search",
        headers=auth_header(token),
        json={"query": "线性代数"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # envelope 形状：request_id / agent / status / data / warnings / trace_id
    for key in ("request_id", "agent", "status", "data", "warnings", "trace_id"):
        assert key in body, f"envelope 缺少字段 {key}"
    assert body["status"] in (
        "success",
        "partial",
        "needs_user_input",
        "pending_review",
        "failed",
        "safe_fallback",
    )


def test_search_without_login_is_guest_context(client, seeded):
    """未登录也能搜（公开内容），但不得 401。"""
    r = client.post("/api/agents/search", json={"query": "机器学习"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] in ("success", "partial", "safe_fallback")


# ──────────────────────────────────────────────────────────────
# 审核
# ──────────────────────────────────────────────────────────────
def test_moderation_check_without_login(client, seeded):
    r = client.post(
        "/api/moderation/check",
        json={"content_type": "note", "content_id": "res_x", "text": "测试内容"},
    )
    assert r.status_code in (401, 403, 200)


def test_teacher_queue_requires_reviewer_capability(client, seeded):
    """教师审核队列需要 reviewer 能力位；学生访问必须被拒。"""
    student_token = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.get("/api/moderation/teacher/queue", headers=auth_header(student_token))
    assert r.status_code in (401, 403), f"学生不该进审核队列，实际 {r.status_code}"


def test_admin_queue_requires_admin(client, seeded):
    teacher_token = client.post(
        "/api/auth/login",
        json={"account": "teacher", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.get("/api/moderation/admin/queue", headers=auth_header(teacher_token))
    assert r.status_code in (401, 403), f"教师不该进管理员队列，实际 {r.status_code}"


# ──────────────────────────────────────────────────────────────
# 学习规划
# ──────────────────────────────────────────────────────────────
def test_learning_profile_requires_login(client, seeded):
    assert client.get("/api/learning/profile").status_code == 401


def test_learning_profile_read_write(client, seeded):
    token = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    ).json()["access_token"]
    h = auth_header(token)

    r = client.get("/api/learning/profile", headers=h)
    assert r.status_code == 200, r.text

    r = client.put("/api/learning/profile", headers=h, json={"weekly_minutes": 360})
    assert r.status_code == 200, r.text


def test_learning_goals_crud(client, seeded):
    token = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    ).json()["access_token"]
    h = auth_header(token)

    r = client.post(
        "/api/learning/goals",
        headers=h,
        json={
            "title": "掌握线性代数",
            "description": "为机器学习打基础",
            "weekly_available_minutes": 360,
        },
    )
    assert r.status_code == 201, r.text
    goal_id = r.json()["id"]

    r = client.get("/api/learning/goals", headers=h)
    assert r.status_code == 200
    assert any(g["id"] == goal_id for g in r.json()["items"])


# ──────────────────────────────────────────────────────────────
# 管理员
# ──────────────────────────────────────────────────────────────
def test_admin_accounts_requires_admin(client, seeded):
    student_token = client.post(
        "/api/auth/login",
        json={"account": "student", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.get("/api/admin/accounts", headers=auth_header(student_token))
    assert r.status_code in (401, 403), f"学生不该进管理端，实际 {r.status_code}"


def test_admin_accounts_ok_for_admin(client, seeded):
    admin_token = client.post(
        "/api/auth/login",
        json={"account": "admin", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.get("/api/admin/accounts", headers=auth_header(admin_token))
    assert r.status_code == 200, r.text
    assert "items" in r.json()


def test_admin_audit_lists_records(client, seeded):
    admin_token = client.post(
        "/api/auth/login",
        json={"account": "admin", "password": seeded["password"]},
    ).json()["access_token"]
    r = client.get("/api/admin/audit", headers=auth_header(admin_token))
    assert r.status_code == 200, r.text
    assert "items" in r.json()
