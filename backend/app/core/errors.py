"""统一错误模型。

设计书 §3.4 规定的错误码，前端据此区分「拒绝」与「服务不可用」——
这两者对用户的含义完全不同，不能混成一个提示。

统一响应形状（设计书 §3.4）：
    {"error": {"code", "message", "retryable", "trace_id"}}
"""

from __future__ import annotations

import uuid
from typing import Any


class AppError(Exception):
    """业务异常基类。所有对外抛出的错误都应继承它。"""

    code: str = "INTERNAL_ERROR"
    message: str = "服务内部错误。"
    retryable: bool = False
    status_code: int = 500

    def __init__(self, message: str | None = None, **extra: Any) -> None:
        self.message = message or self.message
        self.extra = extra
        self.trace_id = uuid.uuid4().hex[:16]
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
                "trace_id": self.trace_id,
                **self.extra,
            }
        }


# ── 认证与权限 ──────────────────────────────────────────────
class AuthRequired(AppError):
    code = "AUTH_REQUIRED"
    message = "请先登录。"
    status_code = 401


class PermissionDenied(AppError):
    code = "PERMISSION_DENIED"
    message = "当前用户无权访问该资源。"
    status_code = 403


class ResourceNotFound(AppError):
    code = "RESOURCE_NOT_FOUND"
    message = "资源不存在或已被删除。"
    status_code = 404


class ResourceUnavailable(AppError):
    code = "RESOURCE_UNAVAILABLE"
    message = "资源当前不可用。"
    status_code = 409


# ── 数据与校验 ──────────────────────────────────────────────
class ValidationFailed(AppError):
    code = "VALIDATION_FAILED"
    message = "请求数据不符合要求。"
    status_code = 422


class ConflictError(AppError):
    """并发冲突：乐观锁失败（设计书 §10.6）。"""

    code = "CONFLICT"
    message = "数据已被其他操作修改，请重新加载后再试。"
    status_code = 409


# ── 外部依赖 ────────────────────────────────────────────────
class ModelTimeout(AppError):
    code = "MODEL_TIMEOUT"
    message = "模型调用超时，请稍后重试。"
    retryable = True
    status_code = 503


class ModelOutputInvalid(AppError):
    code = "MODEL_OUTPUT_INVALID"
    message = "模型输出未通过结构化校验。"
    retryable = True
    status_code = 502


class RetrievalUnavailable(AppError):
    code = "RETRIEVAL_UNAVAILABLE"
    message = "检索服务暂时不可用。"
    retryable = True
    status_code = 503


class OntologyRelationInvalid(AppError):
    code = "ONTOLOGY_RELATION_INVALID"
    message = "知识关系不合法（如存在循环依赖）。"
    status_code = 422


class WorkflowInterrupted(AppError):
    code = "WORKFLOW_INTERRUPTED"
    message = "工作流已中断，可稍后恢复。"
    retryable = True
    status_code = 409


class SafeFallbackRequired(AppError):
    """安全降级：模型不可用时必须走此路径，不能默认放行（设计书 §9.4）。"""

    code = "SAFE_FALLBACK_REQUIRED"
    message = "该操作依赖的模型服务当前不可用，已按安全策略暂缓。"
    retryable = True
    status_code = 503
