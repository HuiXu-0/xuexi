"""
框架开销 vs 网络开销 vs 业务开销 —— 把一次请求的时间拆干净。

问题：把 FastAPI 换成 Rust（axum/hyper）到底能省多少？

做法：
  A. 进程内直接调 ASGI app（不经过 socket、不经过 uvicorn）
     → 这是「Python 代码本身」的全部成本，也是换 Rust 能替换掉的部分
  B. 经真实 HTTP（loopback）→ A + 网络/调度
  C. 业务侧真实成本：bcrypt、JWT、MySQL 往返、LLM 往返

运行：cd backend && python scripts/bench_overhead.py
"""

from __future__ import annotations

import asyncio
import json
import statistics
import time
from typing import Any

import httpx
import uvicorn
from fastapi import FastAPI
from passlib.hash import bcrypt as pw_bcrypt
import jwt

N = 3000


def pct(v: list[float], p: float) -> float:
    o = sorted(v)
    return o[min(len(o) - 1, int(len(o) * p))]


def line(name: str, s: list[float], note: str = "") -> None:
    print(
        f"  {name:<40} p50={statistics.median(s)*1e6:9.1f} µs   "
        f"p95={pct(s,0.95)*1e6:9.1f} µs   {note}"
    )


# ── A. 进程内 ASGI ───────────────────────────────────────────
async def bench_in_process() -> list[float]:
    app = FastAPI()

    class Payload:
        pass

    @app.post("/echo")
    async def echo(payload: dict[str, Any]) -> dict[str, Any]:
        return {"n": len(payload)}

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/echo",
        "raw_path": b"/echo",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"host", b"t"), (b"content-type", b"application/json"),
                    (b"content-length", b"26")],
        "client": ("127.0.0.1", 5000),
        "server": ("127.0.0.1", 80),
    }
    body = json.dumps({"a": 1, "b": 2, "c": 3}).encode()

    samples: list[float] = []
    for _ in range(N):
        t0 = time.perf_counter()
        await app(scope, lambda _r: None, lambda _r: None)  # 占位，下面替换
        samples.append(time.perf_counter() - t0)
    return samples


async def bench_in_process_real(n: int = N) -> list[float]:
    """真正把请求体喂进去跑一次完整 ASGI 调用。"""
    app = FastAPI()

    @app.post("/echo")
    async def echo(payload: dict[str, Any]) -> dict[str, Any]:
        return {"n": len(payload)}

    body = json.dumps({"a": 1, "b": 2, "c": 3}).encode()
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/echo",
        "raw_path": b"/echo",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"host", b"t"), (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode())],
        "client": ("127.0.0.1", 5000),
        "server": ("127.0.0.1", 80),
    }

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": body, "more_body": False}

    samples: list[float] = []
    status: int | None = None
    for _ in range(n):
        async def receive_once() -> dict[str, Any]:
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(msg: dict[str, Any]) -> None:
            nonlocal status
            if msg.get("type") == "http.response.start":
                status = msg["status"]

        t0 = time.perf_counter()
        await app(scope, receive_once, send)
        samples.append(time.perf_counter() - t0)

    if status != 200:
        raise RuntimeError(f"进程内 ASGI 调用未返回 200（实际 {status}），基准无效")
    return samples


# ── B. 经真实 socket ─────────────────────────────────────────
async def bench_over_socket(concurrency: int) -> tuple[list[float], float]:
    app = FastAPI()

    @app.post("/echo")
    async def echo(payload: dict[str, Any]) -> dict[str, Any]:
        return {"n": len(payload)}

    cfg = uvicorn.Config(app, host="127.0.0.1", port=8801, log_level="error")
    server = uvicorn.Server(cfg)
    task = asyncio.create_task(server.serve())
    for _ in range(100):
        await asyncio.sleep(0.05)
        if server.started:
            break

    lat: list[float] = []
    try:
        async with httpx.AsyncClient(base_url="http://127.0.0.1:8801", timeout=30) as c:
            await c.post("/echo", json={"a": 1})

            async def worker() -> None:
                for _ in range(40):
                    t0 = time.perf_counter()
                    await c.post("/echo", json={"a": 1, "b": 2, "c": 3})
                    lat.append(time.perf_counter() - t0)

            t_start = time.perf_counter()
            await asyncio.gather(*[worker() for _ in range(concurrency)])
            wall = time.perf_counter() - t_start
    finally:
        server.should_exit = True
        await task
    return lat, wall


# ── C. 业务侧真实成本 ────────────────────────────────────────
def bench_business() -> None:
    # bcrypt
    h = pw_bcrypt.hash("demo-password-2026", rounds=12)
    s = []
    for _ in range(8):
        t0 = time.perf_counter()
        pw_bcrypt.verify("demo-password-2026", h)
        s.append(time.perf_counter() - t0)
    print(f"  {'bcrypt verify (rounds=12)':<40} {statistics.median(s)*1e3:9.1f} ms"
          f"   ← C 实现，Rust 也一样慢（故意设计成慢的）")

    # JWT
    key = "x" * 48
    payload = {"sub": "u_1", "role": "student", "exp": 9999999999}
    s = []
    for _ in range(3000):
        t0 = time.perf_counter()
        tok = jwt.encode(payload, key, algorithm="HS256")
        jwt.decode(tok, key, algorithms=["HS256"])
        s.append(time.perf_counter() - t0)
    print(f"  {'JWT 签发+校验':<40} {statistics.median(s)*1e6:9.1f} µs   ← 同量级，改 Rust 收益 <0.01ms")

    # JSON
    obj = {"data": {"items": [{"id": f"r_{i}", "title": "示例标题", "score": 0.8} for i in range(50)]}}
    s = []
    for _ in range(3000):
        t0 = time.perf_counter()
        json.dumps(obj, ensure_ascii=False)
        s.append(time.perf_counter() - t0)
    print(f"  {'JSON 序列化 50 条结果':<40} {statistics.median(s)*1e6:9.1f} µs   ← Rust 省约 10-20µs")


async def bench_network() -> None:
    print("\n【D】网络往返（本机 → 公网，实测代理路径）")
    for name, url in [
        ("api.github.com（公网 HTTPS）", "https://api.github.com/"),
        ("huixu-0.github.io（线上站点）", "https://huixu-0.github.io/xuexi/"),
    ]:
        try:
            t0 = time.perf_counter()
            async with httpx.AsyncClient(timeout=25) as c:
                r = await c.get(url)
            print(f"  {name:<40} {(time.perf_counter()-t0)*1000:9.1f} ms   (HTTP {r.status_code})")
        except Exception as e:
            print(f"  {name:<40} 失败: {str(e)[:50]}")


def bench_scoring(corpus_sizes: tuple[int, ...] = (100, 1000, 10000)) -> None:
    """模拟 resource_search_service 的打分循环。

    这是本项目里**唯一**真正跑在 Python CPU 上的批量计算。
    语料越大越吃亏 —— 所以要判断「值不值得上 Rust」，就看这一项。
    """
    keywords = ["嵌入式", "python", "机器学习", "线性代数", "单片机"]
    for size in corpus_sizes:
        titles = [f"资源条目 {i} 教程与实践指南" for i in range(size)]
        summaries = [f"涵盖 {keywords[i % len(keywords)]} 等内容的示例条目" for i in range(size)]
        t0 = time.perf_counter()
        hits = 0
        for i in range(size):
            score = 0.0
            for kw in keywords:
                if kw in titles[i]:
                    score += 3.0
                if kw in summaries[i]:
                    score += 1.0
            if score > 0:
                hits += 1
        el = time.perf_counter() - t0
        print(
            f"  {'打分语料 ' + str(size) + ' 条':<40} 总耗时 {el*1e3:8.3f} ms   "
            f"单条 {el/size*1e6:6.2f} µs   命中 {hits}"
        )


def bench_orjson() -> None:
    """标准库 json vs orjson（orjson 就是 Rust 写的）。"""
    try:
        import orjson
    except ImportError:
        print(f"  {'orjson 对比':<40} (跳过：orjson 未安装，pip install orjson)")
        return
    obj = {
        "data": {
            "items": [
                {"id": f"r_{i}", "title": "示例资源标题", "summary": "这是一个摘要",
                 "score": 0.87, "tags": ["a", "b", "c"]}
                for i in range(50)
            ]
        }
    }

    def bench(fn, n: int = 3000) -> float:
        s = []
        for _ in range(n):
            t0 = time.perf_counter()
            fn()
            s.append(time.perf_counter() - t0)
        return statistics.median(s)

    a = bench(lambda: json.dumps(obj, ensure_ascii=False))
    b = bench(lambda: orjson.dumps(obj))
    c = bench(lambda: json.loads(json.dumps(obj, ensure_ascii=False).encode()))
    d = bench(lambda: orjson.loads(orjson.dumps(obj)))
    print(f"  {'json.dumps（标准库）':<40} {a*1e6:8.1f} µs")
    print(f"  {'orjson.dumps（Rust 写的）':<40} {b*1e6:8.1f} µs   提速 {a/b:.1f}×")
    print(f"  {'json.loads':<40} {c*1e6:8.1f} µs")
    print(f"  {'orjson.loads':<40} {d*1e6:8.1f} µs   提速 {c/d:.1f}×")


# ══════════════════════════════════════════════════════════════
# main
# ══════════════════════════════════════════════════════════════
async def main() -> None:
    print("=" * 92)
    print("把一次请求的时间拆干净：Python 到底占多少？")
    print("=" * 92)

    print("\n【A】进程内 ASGI 调用（纯框架开销，不含 socket / uvicorn / 调度）")
    s = await bench_in_process_real()
    line("FastAPI 路由+解析+序列化", s, "← 这就是换 Rust 能替换掉的上限")

    print("\n【B】进程内 ASGI 纯吞吐（单核，无网络）")
    s2 = await bench_in_process_real(n=5000)
    total = sum(s2)
    print(f"  {'单核纯 ASGI 吞吐':<40} {len(s2)/total:9.0f} req/s   "
          f"平均 {total/len(s2)*1e6:.1f} µs/请求")

    print("\n【C】检索打分热路径（纯 Python CPU，本项目唯一的批量计算）")
    bench_scoring()

    print("\n【D】业务侧真实成本（本项目每个请求实际要付的钱）")
    bench_business()

    print("\n【E】JSON 序列化：标准库 vs Rust 写的 orjson")
    bench_orjson()

    await bench_network()

    print("\n" + "=" * 92)


if __name__ == "__main__":
    asyncio.run(main())
