"""统一 Agent API 响应封装。

设计书 §8.2：

    {
      "request_id": "req_xxx",
      "agent": "search_agent",
      "status": "success",
      "data": {},
      "warnings": [],
      "trace_id": "trace_xxx"
    }

status 六种（设计书 §8.2）：success / partial / needs_user_input /
pending_review / failed / safe_fallback。

**为什么要区分 failed 与 safe_fallback**：
前者是"内容被拒"，后者是"审核服务挂了"。
前端若都渲染成同一个提示，就是在��用户说错话（设计书 §8.2.1）。
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

AgentStatus = Literal[
    "success",
    "partial",
    "needs_user_input",
    "pending_review",
    "failed",
    "safe_fallback",
]


class AgentEnvelope(BaseModel):
    """所有 Agent 接口的统一返回封装。"""

    request_id: str = Field(default_factory=lambda: f"req_{uuid.uuid4().hex[:16]}")
    agent: str
    status: AgentStatus = "success"
    data: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    trace_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:16])


def envelope(
    agent: str,
    status: AgentStatus = "success",
    data: dict[str, Any] | None = None,
    warnings: list[str] | None = None,
) -> AgentEnvelope:
    """构造统一封装的便捷函数。"""
    return AgentEnvelope(
        agent=agent,
        status=status,
        data=data or {},
        warnings=warnings or [],
    )


def safe_fallback(agent: str, reason: str, **extra: Any) -> AgentEnvelope:
    """构造安全降级响应。

    用于「模型不可用但业务必须继续」的场景（设计书 §9.4）。
    关键：降级时 data 里要说明当前实际生效的行为，
    不能让调用方误以为操作已经完成。
    """
    return AgentEnvelope(
        agent=agent,
        status="safe_fallback",
        data={
            "fallback": True,
            "reason": reason,
            "actual_behavior": extra.pop("actual_behavior", "已按安全策略暂缓，等待服务恢复"),
            **extra,
        },
        warnings=[reason],
    )
