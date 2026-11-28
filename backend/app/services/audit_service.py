"""审计服务。

设计书 §10.1 要求记录关键操作：操作者、时间、对象、操作类型、原因、结果。

**审计是后端的职责，不是前端的。**
前端管理员端虽有 applyAdminAction，但它存在浏览器内存里，
刷新即清空、且任何人可改 —— 不能作为安全边界（设计书 §16.1）。
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.audit import AuditEvent


def record_audit(
    db: Session,
    *,
    actor_type: str,
    actor_id: str | None,
    action: str,
    target_type: str,
    target_id: str | None,
    reason: str = "",
    result: str = "",
    case_no: str | None = None,
    trace_id: str | None = None,
    extra: dict[str, Any] | None = None,
) -> AuditEvent:
    """写一条审计记录。

    设计书 §10.1 的字段清单：
    actor_type / actor_id / action / target_type / target_id /
    reason / result / case_no / trace_id / detail / created_at
    """
    event = AuditEvent(
        id=str(uuid.uuid4()),
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        result=result,
        case_no=case_no,
        trace_id=trace_id,
        # detail 是 Text 列，必须存 JSON 字符串 ——
        # 直接塞 dict 会报 "TypeError: dict can not be used as parameter"
        detail=json.dumps(extra or {}, ensure_ascii=False),
        created_at=datetime.now(),
    )
    db.add(event)
    # 审计必须立即落库：即使业务事务回滚，审计也说明"曾尝试过"
    db.commit()
    db.refresh(event)
    return event
