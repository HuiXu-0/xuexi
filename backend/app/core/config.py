"""应用配置。

所有可调项都从环境变量读，敏感项（密钥、数据库口令）不写进代码。
配置集中在这里，避免散落在各模块里。
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """后端配置。字段名对应环境变量名（大小写不敏感）。"""

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── 应用 ──
    app_env: str = "development"
    debug: bool = True

    # ── 数据库 ──
    database_url: str = (
        "mysql+pymysql://campus:campus_pwd@127.0.0.1:3306"
        "/campus_platform?charset=utf8mb4"
    )

    # ── 认证 ──
    secret_key: str = "dev-only-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    # ── 跨域 ──
    cors_origins: str = "http://localhost:5173"

    # ── 检索 ──
    enable_vector_search: bool = False
    embedding_api_url: str = ""
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536

    # ── LLM ──
    llm_api_url: str = ""
    llm_api_key: str = ""
    llm_model: str = ""
    llm_timeout_seconds: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        """LLM 是否配置完整。未配置时相关接口走安全降级（设计书 §9.4）。"""
        return bool(self.llm_api_url and self.llm_api_key and self.llm_model)

    @property
    def embedding_enabled(self) -> bool:
        return bool(self.enable_vector_search and self.embedding_api_url and self.embedding_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
