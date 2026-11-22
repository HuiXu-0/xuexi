"""数据库连接与会话管理。

用 SQLAlchemy 2.0 的声明式风格。

MySQL 注意事项：
- 引擎必须显式指定 charset=utf8mb4，否则中文/emoji 写入会报错；
- pool_pre_ping 用来避免 MySQL 8h 空闲断连（wait_timeout 默认 28800 秒）；
- 关系表的多对多关联用 secondary，映射到设计书 §2.7 的节点/边表。
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    """所有 ORM 模型的基类。"""


_settings = get_settings()

engine = create_engine(
    _settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    echo=False,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """FastAPI 依赖：每个请求一个会话。"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
