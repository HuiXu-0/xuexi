"""模型服务（LLM Provider）模型。

管理员可在管理端切换平台使用的模型服务（设计书 §7.8「Agent 管理」的延伸）。
界面上是四张卡片：内置 / DeepSeek / MiniMax / 自定义。

**为什么密钥必须存在服务端**：
前端管理员端可以操作这张卡片，但密钥**绝不能**下发到浏览器 ——
任何能打开开发者工具的人都能看到并拿去刷额度。
所以密钥加密存库，接口只回掩码（`sk-…abcd`），编辑时留空表示"不修改"。

**为什么要区分 protocol**：
不同厂商的接口协议不同，不能只靠一个「API 地址」抹平：
- `anthropic`：DeepSeek 之外的 Anthropic 兼容端点（`/v1/messages`，
  用 `x-api-key` 头）；本项目的「内置」服务即属此类
- `openai`：OpenAI 兼容端点（`/v1/chat/completions`，用 `Authorization: Bearer`）；
  DeepSeek 与 MiniMax 都提供这一套

卡片只给「名称 + 地址 + 密钥」是不够的 —— 地址相同但协议不同的服务，
请求体和响应结构完全不一样。所以协议是 provider 的一等属性。
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class LlmProvider(Base):
    """一个模型服务配置。

    `code` 是稳定的标识（builtin / deepseek / minimax / custom），
    `name` 是界面上显示的名字（自定义时可改）。
    """

    __tablename__ = "llm_providers"
    __table_args__ = (Index("ix_llm_providers_active", "is_active"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

    # anthropic | openai
    protocol: Mapped[str] = mapped_column(String(16), nullable=False, default="openai")

    # API 根地址（不含 /v1/... 具体路径，服务层按协议拼接）
    base_url: Mapped[str] = mapped_column(String(512), nullable=False, default="")

    # 加密后的密钥，绝不明文落库
    api_key_enc: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # 该服务下的默认模型名
    default_model: Mapped[str] = mapped_column(String(128), nullable=False, default="")

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # 当前生效的 provider（同时只能有一个）
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # 内置卡片不可删除（可禁用、可改地址与密钥）
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.now, onupdate=datetime.now
    )
