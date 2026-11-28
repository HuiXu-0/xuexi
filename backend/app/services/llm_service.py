"""模型服务（LLM Provider）服务层。

职责：
1. 密钥的加密存储与掩码展示（**密钥永不下发到浏览器**）
2. 统一调用入口：兼容 `anthropic` 与 `openai` 两种协议
3. 自定义 API 地址的 SSRF 防护
4. 模型不可用时统一走 `safe_fallback`（设计书 §9.4 失败安全）

**为什么必须区分两种协议**
- `anthropic`：`POST {base}/v1/messages`，头 `x-api-key`，响应 `content[].text`
- `openai`：`POST {base}/v1/chat/completions`，头 `Authorization: Bearer`，
  响应 `choices[0].message.content`
DeepSeek 与 MiniMax 都提供 openai 兼容；本项目的「内置」服务是 anthropic 兼容。

**SSRF 防护为什么必须有**
管理员可以自定义 API 地址。如果不做校验，一个被盗的管理员账号就能让服务器
去请求内网地址（如 `http://127.0.0.1:8000`、`http://169.254.169.254/` 云元数据），
把内网服务暴露出去。管理员权限 ≠ 可以访问内网。
"""

from __future__ import annotations

import base64
import hashlib
import ipaddress
import socket
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.llm_providers import LlmProvider

_settings = get_settings()

PROTOCOL_ANTHROPIC = "anthropic"
PROTOCOL_OPENAI = "openai"
VALID_PROTOCOLS = (PROTOCOL_ANTHROPIC, PROTOCOL_OPENAI)


class LlmError(Exception):
    """模型调用相关错误。调用方应据此降级，不要吞掉。"""


class LlmNotConfigured(LlmError):
    """没有可用的模型服务。"""


class LlmConfigError(LlmError):
    """配置不合法（地址、协议、密钥缺失等）。"""


# ── 密钥加解密 ────────────────────────────────────────────────
def _fernet():
    """从应用密钥派生对称加密密钥。

    用 SHA256 把 SECRET_KEY 折成 32 字节再 base64url —— Fernet 要求
    恰好 32 字节的 urlsafe-base64 密钥。
    """
    from cryptography.fernet import Fernet

    digest = hashlib.sha256(_settings.secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_key(plain: str) -> str:
    """加密 API Key。空串原样返回（表示不设置）。"""
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_key(enc: str) -> str:
    """解密 API Key。解密失败（换了 SECRET_KEY）返回空串而不是抛异常。"""
    if not enc:
        return ""
    try:
        return _fernet().decrypt(enc.encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def mask_key(plain: str) -> str:
    """掩码展示：只留头尾各若干字符。

    给前端的任何响应里都**不能**出现完整密钥。
    """
    if not plain:
        return ""
    if len(plain) <= 10:
        return plain[:2] + "****"
    return f"{plain[:5]}…{plain[-4:]}"


# ── SSRF 防护 ─────────────────────────────────────────────────
_BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
}


def validate_base_url(url: str) -> str:
    """校验自定义 API 地址，拒绝指向内网/元数据服务的地址。

    规则：
    - 只允许 http / https
    - 主机名不能是 localhost / 云元数据域名
    - 解析出的所有 IP 都不能是私有、回环、链路本地、组播、保留地址

    管理员权限不等于可以访问内网 —— 这一层必须有。
    """
    raw = (url or "").strip()
    if not raw:
        raise LlmConfigError("API 地址不能为空")

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise LlmConfigError("API 地址必须以 http:// 或 https:// 开头")
    host = parsed.hostname
    if not host:
        raise LlmConfigError("API 地址缺少主机名")
    if host.lower() in _BLOCKED_HOSTNAMES:
        raise LlmConfigError(f"不允许使用内网主机名：{host}")

    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise LlmConfigError(f"API 地址主机名无法解析：{host}") from exc

    for info in infos:
        ip_text = info[4][0]
        try:
            ip = ipaddress.ip_address(ip_text)
        except ValueError:
            continue
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise LlmConfigError(
                f"不允许指向内网地址（{ip_text}）。请使用公网可访问的模型服务地址。"
            )
    return raw


def build_endpoint(base_url: str, protocol: str) -> str:
    """按协议拼出完整接口地址。

    - anthropic：`{base}/v1/messages`（base 已含 /v1 则不重复加）
    - openai：`{base}/v1/chat/completions`（同上）
    """
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise LlmConfigError("API 地址不能为空")
    if protocol == PROTOCOL_ANTHROPIC:
        return f"{base}/messages" if base.endswith("/v1") else f"{base}/v1/messages"
    if protocol == PROTOCOL_OPENAI:
        return f"{base}/chat/completions" if base.endswith("/v1") else f"{base}/v1/chat/completions"
    raise LlmConfigError(f"不支持的协议：{protocol}")


# ── Provider 读写 ─────────────────────────────────────────────
def list_providers(db: Session) -> list[LlmProvider]:
    return list(
        db.execute(
            select(LlmProvider).order_by(LlmProvider.sort_order, LlmProvider.code)
        ).scalars()
    )


def get_provider(db: Session, provider_id: str) -> LlmProvider | None:
    return db.get(LlmProvider, provider_id)


def get_active_provider(db: Session) -> LlmProvider | None:
    """当前生效的模型服务。

    只有一个 `is_active=True`。若因异常出现多个，取排序最靠前的一个。
    """
    return db.execute(
        select(LlmProvider)
        .where(LlmProvider.is_active.is_(True), LlmProvider.enabled.is_(True))
        .order_by(LlmProvider.sort_order, LlmProvider.code)
        .limit(1)
    ).scalar_one_or_none()


def provider_public_view(provider: LlmProvider) -> dict[str, Any]:
    """给前端的视图 —— **不含完整密钥**。"""
    plain = decrypt_key(provider.api_key_enc)
    return {
        "id": provider.id,
        "code": provider.code,
        "name": provider.name,
        "protocol": provider.protocol,
        "base_url": provider.base_url,
        "default_model": provider.default_model,
        "enabled": provider.enabled,
        "is_active": provider.is_active,
        "is_builtin": provider.is_builtin,
        "sort_order": provider.sort_order,
        "note": provider.note,
        # 只有掩码，没有明文
        "api_key_masked": mask_key(plain),
        "has_api_key": bool(plain),
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }


def upsert_provider(
    db: Session,
    *,
    code: str,
    name: str,
    protocol: str,
    base_url: str,
    api_key: str = "",
    default_model: str = "",
    enabled: bool = True,
    is_builtin: bool = False,
    sort_order: int = 100,
    note: str | None = None,
) -> LlmProvider:
    """新增或更新一个 provider。

    `api_key` 传空串表示「不修改现有密钥」。
    """
    if protocol not in VALID_PROTOCOLS:
        raise LlmConfigError(f"不支持的协议：{protocol}")
    clean_url = validate_base_url(base_url)

    provider = db.execute(
        select(LlmProvider).where(LlmProvider.code == code)
    ).scalar_one_or_none()

    if provider is None:
        provider = LlmProvider(
            id=f"llmp_{uuid.uuid4().hex[:12]}",
            code=code,
            name=name or code,
            protocol=protocol,
            base_url=clean_url,
            api_key_enc=encrypt_key(api_key),
            default_model=default_model,
            enabled=enabled,
            is_builtin=is_builtin,
            sort_order=sort_order,
            note=note,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(provider)
    else:
        provider.name = name or provider.name
        provider.protocol = protocol
        provider.base_url = clean_url
        if api_key:
            provider.api_key_enc = encrypt_key(api_key)
        provider.default_model = default_model or provider.default_model
        provider.enabled = enabled
        provider.sort_order = sort_order
        provider.note = note
        provider.updated_at = datetime.now()

    db.commit()
    db.refresh(provider)
    return provider


def set_active_provider(db: Session, provider_id: str) -> LlmProvider:
    """切换当前生效的模型服务。同一时刻只有一个 is_active。"""
    target = db.get(LlmProvider, provider_id)
    if target is None:
        raise LlmConfigError("模型服务不存在")
    if not target.enabled:
        raise LlmConfigError("该模型服务已停用，无法设为当前生效")

    for p in list_providers(db):
        p.is_active = p.id == target.id
    db.commit()
    db.refresh(target)
    return target


def delete_provider(db: Session, provider_id: str) -> None:
    provider = db.get(LlmProvider, provider_id)
    if provider is None:
        raise LlmConfigError("模型服务不存在")
    if provider.is_builtin:
        raise LlmConfigError("内置模型服务不可删除，可改为停用")
    db.delete(provider)
    db.commit()


# ── 调用 ──────────────────────────────────────────────────────
@dataclass
class LlmReply:
    text: str
    model: str
    provider_code: str
    usage: dict[str, Any]


def _request_kwargs(provider: LlmProvider, key: str, model: str) -> tuple[str, dict[str, str], dict[str, Any]]:
    endpoint = build_endpoint(provider.base_url, provider.protocol)
    if provider.protocol == PROTOCOL_ANTHROPIC:
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        body = {"model": model, "max_tokens": 1024}
    else:
        headers = {
            "Authorization": f"Bearer {key}",
            "content-type": "application/json",
        }
        body = {"model": model, "max_tokens": 1024}
    return endpoint, headers, body


def chat(
    db: Session,
    *,
    system: str,
    user: str,
    max_tokens: int = 1024,
    temperature: float | None = None,
    provider: LlmProvider | None = None,
) -> LlmReply:
    """调用当前生效的模型服务，返回文本。

    失败一律抛 `LlmError` —— 由调用方决定怎么降级。
    **这里绝不返回「看起来正常的空结果」**，否则前端无法区分
    「模型说没有」和「模型没调通」（设计书 §8.2.1）。
    """
    if provider is None:
        provider = get_active_provider(db)
    if provider is None:
        raise LlmNotConfigured("当前没有启用中的模型服务")

    key = decrypt_key(provider.api_key_enc)
    if not key:
        raise LlmNotConfigured(f"模型服务「{provider.name}」未配置 API Key")

    model = provider.default_model
    if not model:
        raise LlmConfigError(f"模型服务「{provider.name}」未配置默认模型名")

    endpoint, headers, body = _request_kwargs(provider, key, model)

    if provider.protocol == PROTOCOL_ANTHROPIC:
        body["system"] = system
        body["messages"] = [{"role": "user", "content": user}]
    else:
        body["messages"] = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
    if temperature is not None:
        body["temperature"] = temperature

    timeout = _settings.llm_timeout_seconds or 30
    try:
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            resp = client.post(endpoint, headers=headers, json=body)
    except httpx.TimeoutException as exc:
        raise LlmError(f"模型服务超时（{timeout}s）") from exc
    except httpx.HTTPError as exc:
        raise LlmError(f"模型服务连接失败：{exc}") from exc

    if resp.status_code >= 400:
        detail = resp.text[:300]
        raise LlmError(f"模型服务返回 {resp.status_code}：{detail}")

    try:
        data = resp.json()
    except ValueError as exc:
        raise LlmError("模型服务返回了非 JSON 响应") from exc

    text = ""
    if provider.protocol == PROTOCOL_ANTHROPIC:
        blocks = data.get("content") or []
        text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict))
    else:
        choices = data.get("choices") or []
        if choices and isinstance(choices[0], dict):
            text = (choices[0].get("message") or {}).get("content") or ""

    if not text:
        raise LlmError("模型服务返回了空内容")

    return LlmReply(
        text=text.strip(),
        model=data.get("model") or model,
        provider_code=provider.code,
        usage=data.get("usage") or {},
    )


def probe(provider: LlmProvider) -> dict[str, Any]:
    """连通性测试：发一个极短的请求，确认地址、密钥、模型都对。"""
    key = decrypt_key(provider.api_key_enc)
    if not key:
        raise LlmNotConfigured("该模型服务未配置 API Key")
    model = provider.default_model
    if not model:
        raise LlmConfigError("该模型服务未配置默认模型名")

    endpoint, headers, body = _request_kwargs(provider, key, model)
    if provider.protocol == PROTOCOL_ANTHROPIC:
        body["max_tokens"] = 16
        body["messages"] = [{"role": "user", "content": "ping"}]
    else:
        body["max_tokens"] = 16
        body["messages"] = [{"role": "user", "content": "ping"}]

    timeout = min(_settings.llm_timeout_seconds or 30, 20)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=False) as client:
            resp = client.post(endpoint, headers=headers, json=body)
    except httpx.TimeoutException as exc:
        raise LlmError(f"连接超时（{timeout}s）") from exc
    except httpx.HTTPError as exc:
        raise LlmError(f"连接失败：{exc}") from exc

    if resp.status_code >= 400:
        raise LlmError(f"服务返回 {resp.status_code}：{resp.text[:200]}")
    return {"ok": True, "status": resp.status_code, "endpoint": endpoint, "model": model}
