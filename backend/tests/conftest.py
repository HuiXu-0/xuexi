"""pytest 夹具：跑在 **MySQL** 上（不用 SQLite）。

为什么必须是 MySQL：
- 本项目的检索走 InnoDB FULLTEXT + **ngram 解析器**（中文必需），
  这是 SQLite 模拟不出来的；
- `scripts/schema.sql` 里的 ngram 索引只有 MySQL 支持；
- 目标库就是 MySQL，测试环境应该跟生产同构。

**前置**：MySQL 已安装并已建库（见 backend/README.md）。
未连通时整个测试套件自动 skip，不会误报失败。

    DATABASE_URL=mysql+pymysql://campus:campus_pwd@127.0.0.1:3306/campus_platform \
        python -m pytest tests/ -v
"""

from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# 必须在导入 app 之前设置（config 用 lru_cache 缓存）
os.environ.setdefault(
    "DATABASE_URL",
    "mysql+pymysql://campus:campus_pwd@127.0.0.1:3306/campus_platform?charset=utf8mb4",
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("APP_ENV", "test")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.core.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.users import (  # noqa: E402
    Permission,
    Role,
    RolePermission,
    User,
    UserCapability,
    UserRole,
)
from app.services.auth_service import hash_password  # noqa: E402

TEST_DB_URL = os.environ["DATABASE_URL"]


def _mysql_available() -> tuple[bool, str]:
    """检查 MySQL 是否可连。返回 (可用, 原因)。"""
    try:
        eng = create_engine(
            TEST_DB_URL,
            future=True,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 3},
        )
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        eng.dispose()
        return True, ""
    except SQLAlchemyError as exc:
        return False, str(exc).split("\n")[0][:160]


_MYSQL_OK, _MYSQL_ERR = _mysql_available()

_SKIP_REASON = (
    f"MySQL 不可用，跳过整个测试套件。\n"
    f"  连接串: {TEST_DB_URL}\n"
    f"  原因: {_MYSQL_ERR}\n"
    f"  请先安装 MySQL 并执行 scripts/schema.sql 建库（见 backend/README.md）。"
)


@pytest.fixture(scope="session")
def engine():
    # 放在 fixture 里 skip —— conftest 模块级的 pytestmark 对测试模块无效
    if not _MYSQL_OK:
        pytest.skip(_SKIP_REASON, allow_module_level=True)

    eng = create_engine(
        TEST_DB_URL,
        future=True,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_size=5,
        max_overflow=10,
    )
    import app.models  # noqa: F401  —— 导入所有模型让 metadata 收齐表定义

    yield eng
    eng.dispose()


@pytest.fixture()
def db(engine) -> Iterator:
    """每个测试一张干净表。

    做法：删表重建。种子数据带唯一约束（role.code / permission.code /
    user_capabilities），复用同一批数据会撞 IntegrityError。
    """
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, future=True)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db) -> Iterator[TestClient]:
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def seeded(db) -> dict:
    """写入基础角色/权限与三个演示账号。"""
    roles = {}
    for code, name in [
        ("student", "学生"),
        ("teacher", "教师"),
        ("admin", "平台管理员"),
    ]:
        role = Role(id=f"role_{code}", code=code, name=name)
        db.add(role)
        roles[code] = role
    db.flush()

    perms = {}
    for code in [
        "resource.read",
        "resource.write",
        "moderation.review",
        "moderation.rule.manage",
        "user.manage",
        "audit.read",
        "config.manage",
    ]:
        p = Permission(id=f"perm_{code}", code=code)
        db.add(p)
        perms[code] = p
    db.flush()

    grants = {
        "student": ["resource.read", "resource.write"],
        "teacher": ["resource.read", "resource.write", "moderation.review"],
        "admin": list(perms.keys()),
    }
    for role_code, perm_codes in grants.items():
        for pc in perm_codes:
            # 外键指向 permissions.id，不是 permissions.code
            db.add(
                RolePermission(
                    role_id=roles[role_code].id, permission_id=perms[pc].id
                )
            )
    db.flush()

    pwd = hash_password("demo-pass-2026")
    accounts: dict[str, str] = {}
    for role_code in ("student", "teacher", "admin"):
        uid = f"u_{role_code}"
        u = User(
            id=uid,
            # display_name 直接用角色代号，方便测试用账号登录
            display_name=role_code,
            email=f"{role_code}@campus.test",
            password_hash=pwd,
            status="active",
        )
        db.add(u)
        db.flush()
        db.add(UserRole(user_id=uid, role_id=roles[role_code].id))
        accounts[role_code] = uid

    # 能力位：教师给 reviewer，管理员给 content_admin
    db.add(
        UserCapability(
            id="cap_t_reviewer", user_id=accounts["teacher"], code="reviewer"
        )
    )
    db.add(
        UserCapability(
            id="cap_a_content", user_id=accounts["admin"], code="content_admin"
        )
    )
    db.commit()

    return {"accounts": accounts, "password": "demo-pass-2026"}


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
