"""日志配置。

日志里要带 trace_id，方便把前端请求、后端处理与审计记录串起来
（设计书 §10.1）。
"""

from __future__ import annotations

import logging
import sys


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-7s [%(name)s] %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # 这些库太吵，压到 WARNING
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "pymysql"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
