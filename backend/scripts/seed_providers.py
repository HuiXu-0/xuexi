"""初始化四张模型服务卡片。

    内置 / DeepSeek / MiniMax / 自定义

**API Key 不写在代码里** —— 从环境变量读，存进数据库时加密。

环境变量：
    LLM_BUILTIN_API_KEY   内置服务的密钥（可选，缺省则该卡片留空待填）
    LLM_BUILTIN_BASE_URL  内置服务的地址（默认 https://api.xiaomimimo.com/anthropic）
    LLM_BUILTIN_MODEL     内置服务的默认模型（默认 mimo-v2.6-flash[1M]）

用法：
    cd backend
    python scripts/seed_providers.py
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# 密钥等配置写在 .env 里 —— pydantic-settings 会读，但本脚本用的是
# os.environ，必须自己把 .env 灌进来，否则永远读不到。
try:
    from dotenv import load_dotenv

    load_dotenv(BACKEND_ROOT / ".env", override=False)
except ImportError:  # pragma: no cover
    pass

from sqlalchemy import select  # noqa: E402

from app.core.db import SessionLocal  # noqa: E402
from app.models.llm_providers import LlmProvider  # noqa: E402
from app.services import llm_service as svc  # noqa: E402

# 四张卡片的默认配置。
# 注意 base_url 里不写 /v1/... 具体路径 —— 服务层按 protocol 拼接，
# 这样同一个地址在两种协议下都能用。
CARDS = [
    {
        "code": "builtin",
        "name": "内置服务",
        "protocol": svc.PROTOCOL_ANTHROPIC,
        "base_url": os.environ.get(
            "LLM_BUILTIN_BASE_URL", "https://api.xiaomimimo.com/anthropic"
        ),
        "default_model": os.environ.get("LLM_BUILTIN_MODEL", "mimo-v2.6-flash"),
        "is_builtin": True,
        "sort_order": 10,
        "note": "平台自带的模型服务，由平台方承担调用成本。",
    },
    {
        "code": "deepseek",
        "name": "DeepSeek",
        "protocol": svc.PROTOCOL_OPENAI,
        "base_url": "https://api.deepseek.com/v1",
        "default_model": "deepseek-chat",
        "is_builtin": False,
        "sort_order": 20,
        "note": "DeepSeek 官方服务，OpenAI 兼容协议。使用需自行填写 API Key。",
    },
    {
        "code": "minimax",
        "name": "MiniMax",
        "protocol": svc.PROTOCOL_OPENAI,
        "base_url": "https://api.minimax.chat/v1",
        "default_model": "MiniMax-Text-01",
        "is_builtin": False,
        "sort_order": 30,
        "note": "MiniMax 官方服务，OpenAI 兼容协议。使用需自行填写 API Key。",
    },
    {
        "code": "custom",
        "name": "自定义服务",
        "protocol": svc.PROTOCOL_OPENAI,
        "base_url": "",
        "default_model": "",
        "is_builtin": False,
        "sort_order": 40,
        "note": "自建或第三方代理服务，需自行填写 API 地址、API Key 与模型名。",
    },
]


def main() -> None:
    builtin_key = os.environ.get("LLM_BUILTIN_API_KEY", "").strip()
    db = SessionLocal()
    try:
        created = 0
        for card in CARDS:
            existing = db.execute(
                select(LlmProvider).where(LlmProvider.code == card["code"])
            ).scalar_one_or_none()
            if existing is not None:
                # 已存在：只有内置卡片允许在这里补写密钥
                if card["code"] == "builtin" and builtin_key and not existing.api_key_enc:
                    existing.api_key_enc = svc.encrypt_key(builtin_key)
                    existing.updated_at = datetime.now()
                    db.commit()
                    print(f"  ↻ {card['name']}：已存在，已补写 API Key")
                else:
                    print(f"  · {card['name']}：已存在，跳过")
                continue

            base_url = card["base_url"]
            if not base_url:
                # 自定义卡片没有默认地址，跳过建卡（管理员在界面上新建）
                print(f"  · {card['name']}：无默认地址，跳过")
                continue

            try:
                provider = svc.upsert_provider(
                    db,
                    code=card["code"],
                    name=card["name"],
                    protocol=card["protocol"],
                    base_url=base_url,
                    api_key=builtin_key if card["code"] == "builtin" else "",
                    default_model=card["default_model"],
                    enabled=True,
                    is_builtin=card["is_builtin"],
                    sort_order=card["sort_order"],
                    note=card["note"],
                )
            except svc.LlmConfigError as exc:
                print(f"  ✗ {card['name']}：{exc}")
                continue

            created += 1
            key_state = "已配置密钥" if provider.api_key_enc else "未配置密钥"
            print(f"  ✓ {provider.name}（{provider.protocol}）{key_state}")

        # 内置卡片默认生效 —— 前提是它有密钥，否则没有可用服务
        builtin = db.execute(
            select(LlmProvider).where(LlmProvider.code == "builtin")
        ).scalar_one_or_none()
        if builtin and builtin.api_key_enc and not builtin.is_active:
            svc.set_active_provider(db, builtin.id)
            print("  → 已将「内置服务」设为当前生效")
        elif builtin and not builtin.api_key_enc:
            print("  ! 内置服务未配置 API Key，当前没有生效中的模型服务")

        print(f"\n完成：新增 {created} 个模型服务配置")
    finally:
        db.close()


if __name__ == "__main__":
    main()
