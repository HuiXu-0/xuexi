# 校园学习平台 · 后端服务

FastAPI + SQLAlchemy 2 + MySQL。按《校园学习资源共享平台_三大Agent可执行设计与领域本体_V1.0》
（第三份设计书）实现。

> **当前状态**：代码已完成并通过语法自检，但**从未连过真实数据库运行**。
> MySQL Server 8.4 已于 2026-11-13 从开发机卸载（数据留档在 `D:\SQLDate`），
> 因此下述步骤尚未端到端验证过。

---

## 1. 目录结构

```
backend/
├── app/
│   ├── core/          config.py 配置 · db.py 会话 · envelope.py 统一响应
│   │                  errors.py 错误模型 · logging.py 日志
│   ├── models/        SQLAlchemy ORM
│   │                  users.py     用户/角色/能力位（scope_grant）
│   │                  resources.py 资源统一主表 + 扩展表 + 全文索引列
│   │                  moderation.py 审核案件/规则/快照
│   │                  learning.py  学习画像/目标/证据/计划/任务
│   │                  audit.py     审计事件
│   ├── services/      业务逻辑（与 API 层分离）
│   │                  auth_service / permission_service / audit_service
│   │                  resource_service / resource_search_service
│   │                  moderation_rules / moderation_service
│   │                  knowledge_service / learning_service
│   └── api/
│       ├── deps.py    依赖注入：当前用户、数据库会话
│       └── v1/        auth · resources · search · moderation · learning · admin
├── scripts/
│   ├── schema.sql     MySQL 建表脚本（含 ngram 中文全文索引）
│   └── migrate_seed.py 前端静态演示数据 → MySQL 的迁移脚本
├── tests/             pytest 用例目录（待补）
├── pyproject.toml
└── .env.example
```

### API 前缀

| 前缀 | 模块 | 说明 |
|---|---|---|
| `/api/auth` | 认证 | 注册、登录、JWT |
| `/api/resources` | 资源 | 统一资源 CRUD、权限过滤 |
| `/api/agents` | 搜索 Agent | 对应设计书 §4.8 的响应结构 |
| `/api/moderation` | 审核 | 案件流转、人工复核、申诉 |
| `/api/learning` | 学习规划 | 目标、证据、计划、任务 |
| `/api/admin` | 管理端 | 账号权限、审计、配置 |

所有 Agent 类接口统一返回设计书 §8.2 的 envelope：

```json
{ "request_id": "...", "agent": "...", "status": "success", "data": {}, "warnings": [], "trace_id": "..." }
```

`status` 共 6 种：`success` / `partial` / `needs_user_input` / `pending_review` / `failed` / `safe_fallback`。

---

## 2. 环境准备

### 2.1 Python 依赖

```bash
cd backend
pip install -e ".[dev]"
```

> ⚠️ **`bcrypt` 必须锁 4.0.1**（`pyproject.toml` 已锁）。
> passlib 1.7.4 与 bcrypt ≥ 4.1 不兼容，会在密码哈希时抛
> `AttributeError: module 'bcrypt' has no attribute '__about__'`。
> 若用 `pip install bcrypt` 单独装过最新版，会覆盖掉这个约束。

### 2.2 环境变量

```bash
cp .env.example .env
# 然后修改 DATABASE_URL 与 SECRET_KEY
python -c "import secrets;print(secrets.token_urlsafe(48))"   # 生成 SECRET_KEY
```

`.env` 已在 `.gitignore` 中，不入库。

### 2.3 MySQL（需自行安装）

数据库需要 **MySQL 8.4 LTS**，本项目不使用 pgvector，中文全文检索走 MySQL 自带的
**ngram** 解析器（见 `scripts/schema.sql` 里的全文索引定义）。

#### 下载哪个

官网 `mysql.com` 首页是**产品展示页**（HeatWave / Enterprise / Community 矩阵），
不是下载页。真正的下载在：

```
https://dev.mysql.com/downloads/mysql/8.4.html
```

路径：官网 → 往下找到 **MySQL Community Edition** 板块 → 点蓝色链接
**「MySQL Community (GPL) Downloads」**。

| 选项 | 建议 | 说明 |
|---|---|---|
| **8.4.13 LTS**（`mysql-8.4.13-winx64.msi`，129.9 MB） | ✅ **选这个** | 长期支持版；Windows 上装成服务、自带 my.ini 生成；**与 `D:\SQLDate` 里的 8.4.9 备份同大版本，可无缝恢复** |
| 8.4.13 ZIP 归档（268.1 MB） | 可选 | 免安装，但要自己初始化数据目录、配 my.ini、手动起服务 |
| 9.7.x / 26.x（Innovation） | ❌ | 新特性迭代版，非 LTS |
| 8.0.x | ❌ | 上一代 LTS，且已过维护期 |
| Debug Binaries（759 MB） | ❌ | 带调试符号，体积暴涨 |

> **为什么必须是 8.4 而不是 9.x**：
> `D:\SQLDate\MySQL_Data_Backup\edunova` 里存的是 8.4.9 的二进制 `.ibd`，
> InnoDB 数据字典与版本强绑定，跨大版本恢复会报错。

#### 安装时的几个选择

| 选项 | 选什么 | 理由 |
|---|---|---|
| 安装类型 | **Server only** | 不要选 Full —— 会额外装 Workbench 和一堆示例数据库，白占几百 MB |
| 服务器类型 | **Development Machine** | 本机开发用，内存占用最小 |
| 端口 | 3306（默认） | `.env` 里的 `DATABASE_URL` 就是这个 |
| 认证方式 | Strong Password Encryption（`caching_sha2_password`） | PyMySQL 支持，但需要 `cryptography` 包（已在 `pyproject.toml`） |
| root 密码 | 记下来 | 后端连接要用 |

> 这次可以把**数据目录放到 D 盘**（例如 `D:\MySQL_Data`），避免再占 C 盘
> （上次 MySQL 在 C 盘一共占了 780 MB）。装的时候改一下 Data Directory 即可；
> 装完告诉我实际路径，我把 `D:\SQLDate\README.md` 里的恢复路径同步改掉。

#### 装完之后

```bash
# 建库（用户名/密码按实际填）
mysql -u root -p -e "CREATE DATABASE campus_platform DEFAULT CHARSET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"

# 建表
mysql -u root -p campus_platform < scripts/schema.sql

# 导入前端演示数据（可重复执行）
python scripts/migrate_seed.py
```

> 如果只想把 `edunova` 的旧数据恢复回来（而不是用演示数据），
> 见 `D:\SQLDate\README.md` 第 6 节。
> 建议顺手跑一次 `mysqldump` 导出 `.sql` —— 二进制 `.ibd` 恢复门槛高。

---

## 3. 启动

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

- 接口文档：http://127.0.0.1:8000/docs
- 前端联调时把 `CORS_ORIGINS` 指向 Vite dev server（默认已配 `localhost:5173`）

---

## 4. 与前端的衔接

| 事项 | 位置 |
|---|---|
| 前端 Agent 契约（待改造成 envelope 形状） | `src/services/agentContract.js` |
| 前端 Agent 调用接入点 | `src/services/agentRuntime.js` 的 `runAgent()` |
| 受控词表（与设计书 §2.5 对齐） | `src/data/dict.js` |
| 词表一致性自动检查 | `npm run check:vocab`（仓库根目录） |
| 角色 + 能力位模型 | 设计书 §12 Phase 0 |

> 前端的 `canAccess()` 只是**界面上的入口显隐**，不是安全边界。
> 真正的权限判定在 `app/services/permission_service.py`（服务端强制）。

---

## 5. 已知问题

1. **SQLAlchemy 的 C 扩展在部分企业策略下被拦截**
   `import sqlalchemy` 可能报
   `ImportError: DLL load failed while importing _collections_cy`。
   原因是 Windows 代码完整性策略（WDAC，Policy ID `{0283ac0f-...}`）
   拦截了 `_collections_cy.cp313-win_amd64.pyd`。
   同目录的 cffi / markupsafe / yaml / cryptography / bcrypt 的 `.pyd` 均可正常加载。
   事件日志：`Microsoft-Windows-CodeIntegrity/Operational`（事件 3033 / 3077）。
   绕过方式：调整该机器的 WDAC 策略，或安装纯 Python 版 SQLAlchemy。

2. **LLM 与向量检索默认关闭**
   `.env` 里 `LLM_API_*` 与 `ENABLE_VECTOR_SEARCH` 默认留空 / false，
   对应接口会返回 `safe_fallback`（见设计书 §9.4），
   **不会默认放行审核**。

3. **Agent 本体未实现**
   按设计要求，审核的语义分析、搜索的意图理解、规划的生成逻辑
   **只留了接口与契约**，没有预置任何 Agent 框架。
   三者互不调用，统一走共享领域服务（设计书 §8.3）。
