# 校园学习资源共享与知识协作平台
# 三大 Agent 可执行技术设计与领域本体说明书

**版本：V1.0**  
**设计基线：产品设计书 V1.0**  
**适用范围：全局搜索与发现 Agent、内容审核 Agent、个人学习规划 Agent**  
**架构原则：模块化单体优先、业务边界清晰、权限后端强制、资源真实可追溯、模型决策可审计**

---

# 0. 设计结论与实施边界

## 0.1 本方案要解决的问题

本方案将三个 Agent 从产品概念落实为可开发的业务系统，明确：

1. 每个 Agent 的职责、输入、输出、工具、状态和失败处理。
2. LangChain、LangGraph、检索引擎、规则引擎各自承担什么工作。
3. 三个 Agent 如何复用服务而不形成相互依赖。
4. 平台统一的领域本体、实体关系、数据表和知识关联方式。
5. 第一阶段可以交付的功能范围、接口、工作流、验收指标和开发顺序。

## 0.2 最终技术决策

| 领域 | 采用方案 | 不采用的做法 |
|---|---|---|
| 搜索 Agent | 独立混合检索服务 + LangChain + LangGraph | 不让 LLM 直接拼 SQL；不让每个查询都进入复杂 Agent Loop |
| 审核 Agent | 确定性规则引擎 + LangChain 结构化语义分析 + 决策服务 | 不让模型直接删除内容、封禁用户或修改规则 |
| 学习规划 Agent | 学习者领域模型 + 知识依赖图 + LangGraph 状态工作流 | 不把聊天记录当学习画像；不让模型凭空生成资源 |
| 本体与知识模型 | 关系型领域模型 + 受控词表 + PostgreSQL 节点/边表 | 第一阶段不强制部署 Neo4j、RDF/OWL 或独立知识图谱平台 |
| 后端形态 | FastAPI 模块化单体 | 不在早期拆成多个微服务 |
| 数据层 | PostgreSQL + pgvector + PostgreSQL FTS | 不把向量数据库当成唯一事实库 |
| 工作流 | LangGraph 用于需要分支、持久状态、重试和人工介入的流程 | 不把普通 CRUD、简单检索包装成图工作流 |
| 异步任务 | 初期 FastAPI BackgroundTasks/轻量任务表；有可靠队列需求后再引入 Celery/Redis | 不在第一阶段堆叠 Temporal、Celery、LangGraph 三套编排 |

## 0.3 产品边界必须遵守

本设计沿用产品设计书 V1.0 的范围：

- 平台内容包括官方通知、学习小组、论坛帖子、学习笔记、外部学习资源、竞赛条目、优秀案例、Bug 反馈、功能建议、举报案件和学习计划。
- 用户角色包括访客、学生、学习小组创建者、教师、学校内容管理员、平台管理员，以及可选的超级管理员。
- 平台核心是资源整合、知识发现、经验共享和学习协作，不是自动生产课程或批量生成学习内容。
- 不假定接入学校教务、学籍、成绩或统一身份认证系统。
- 第一阶段审核 Agent 以文本字段为主；文档、图片、视频内部内容识别不是必备能力。
- 作品可见范围与使用许可是两个不同维度。允许查看不等于允许转载、修改、下载或用于竞赛。
- 教师推荐学生案例不等于学生授权；授权范围必须由作者明确确认。
- 竞赛日期、官方通知、资源链接等事实必须有来源和核实时间，模型不能补造。

---

# 1. 总体系统架构

## 1.1 架构总览

```text
┌──────────────────────────────────────────────────────────────────┐
│                         Web / Mobile Frontend                    │
│   学生端             教师端              管理员端                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS / REST
┌──────────────────────────────▼───────────────────────────────────┐
│                       FastAPI Application                        │
│                                                                  │
│  Auth & RBAC       API Router       Rate Limit       DTO/Pydantic │
│                                                                  │
│  ┌────────────────┐ ┌────────────────┐ ┌───────────────────────┐ │
│  │ Search Agent   │ │ Moderation     │ │ Learning Planning     │ │
│  │ LangGraph      │ │ Rule + LC      │ │ Agent / LangGraph     │ │
│  └───────┬────────┘ └───────┬────────┘ └───────────┬───────────┘ │
│          │                  │                      │             │
│  ┌───────▼──────────────────▼──────────────────────▼───────────┐ │
│  │                  Shared Domain Services                     │ │
│  │ Resource Search | Resource | User Profile | Knowledge       │ │
│  │ Permission      | Moderation Case | Learning Plan | Audit   │ │
│  └──────────────────────────────┬───────────────────────────────┘ │
│                                 │                                 │
│  ┌──────────────────────────────▼───────────────────────────────┐ │
│  │                    Infrastructure Layer                      │ │
│  │ LLM Gateway | Embedding | Reranker | Tool Registry | Cache   │ │
│  │ Workflow Checkpointer | Logging | Evaluation | Task Runner   │ │
│  └──────────────────────────────┬───────────────────────────────┘ │
└─────────────────────────────────┼────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│                         PostgreSQL                               │
│  Users/Roles | Resources | Tags/Ontology | Permissions             │
│  Moderation | Learning Profile | Knowledge Graph | Plans           │
│  FTS Index | pgvector | Audit Events | Workflow Checkpoints        │
└──────────────────────────────────────────────────────────────────┘
```

## 1.2 架构层次与职责

### A. 表现层

只负责收集用户输入、展示结果和提交用户确认。不能把前端传入的 `role`、`is_admin`、`can_access_private` 当作可信权限。

### B. API 与身份权限层

负责身份认证、角色解析、请求校验、速率限制、权限上下文注入。每次 Agent 请求都必须携带服务端生成的 `user_id`、`tenant/school_id`（若未来多校）、角色与权限范围。

### C. Agent 应用层

三个 Agent 只负责各自领域内的意图理解、决策编排和结构化结果生成。Agent 不直接访问数据库连接，不自行构造任意 SQL，不绕过领域服务。

### D. 领域服务层

这是系统真正的业务核心。资源检索、权限判断、内容状态流转、学习画像更新等必须由领域服务完成。Agent 通过明确接口调用这些服务。

### E. 基础设施层

统一封装模型、Embedding、Reranker、工具注册、工作流持久化、日志、评估与异步任务。

### F. 数据层

PostgreSQL 是平台业务事实的唯一权威来源。向量、全文索引和图关系是服务于检索与推理的派生结构，不能取代资源主记录和权限记录。

## 1.3 三个 Agent 的调用边界

```text
Search Agent ───────────────► ResourceSearchService
                                      ▲
                                      │
Learning Agent ─────────────► ResourceSearchService

Moderation Agent ───────────► ModerationPolicyService
                                      │
                                      ▼
                              ModerationCaseService

Learning Agent ─────────────► UserLearningProfileService
Learning Agent ─────────────► KnowledgeService
Learning Agent ─────────────► LearningPlanService

All Agents ─────────────────► PermissionService
All Agents ─────────────────► LLMGateway / AuditService
```

禁止采用以下依赖：

```text
Learning Agent ──调用──► Search Agent 的内部 Agent Loop
Moderation Agent ──调用──► Learning Agent
Search Agent ──读取──► Learning Agent 的内部状态
```

学习规划需要资源时，直接调用共享的 `ResourceSearchService`，而不是把另一个完整 Agent 当成工具。这样可以减少上下文耦合、调用成本和故障传播。

---

# 2. 统一领域本体（Domain Ontology）

## 2.1 本体的定位

这里的“本体”不是单纯的数据库 ER 图，也不是第一阶段就必须部署 OWL/RDF 知识图谱。它是平台统一的领域语义规范，包含：

- 平台有哪些核心实体（Entity/Class）。
- 实体有哪些属性（Data Property）。
- 实体之间有哪些关系（Object Property）。
- 每种关系的方向、基数和约束。
- 哪些词汇必须使用统一枚举或受控词表。
- 哪些关系可以用于搜索、推荐和学习路径推理。

第一阶段采用“关系型数据模型 + 受控词表 + 图关系表”的实现。等实体规模、关系查询复杂度和跨系统知识交换需求上升，再评估 Neo4j 或 RDF/OWL。

## 2.2 顶层本体分类

```text
PlatformOntology
│
├── Actor（参与者）
│   ├── User
│   ├── Role
│   ├── Permission
│   └── Organization（学院/部门，可选）
│
├── LearningObject（学习对象）
│   ├── LearningResource
│   │   ├── PlatformNote
│   │   ├── ExternalResource
│   │   ├── ProjectCase
│   │   ├── Competition
│   │   └── OfficialNotice
│   ├── ForumPost
│   ├── LearningGroup
│   └── Attachment
│
├── Knowledge（知识）
│   ├── KnowledgeConcept
│   ├── Skill
│   ├── Subject
│   ├── CourseTopic（可选）
│   └── LearningStage
│
├── Learning（学习过程）
│   ├── LearningGoal
│   ├── LearningProfile
│   ├── CapabilityEvidence
│   ├── LearningPlan
│   ├── PlanStage
│   ├── LearningTask
│   └── LearningActivity
│
├── Governance（治理）
│   ├── VisibilityPolicy
│   ├── UsageLicense
│   ├── ModerationRule
│   ├── ModerationCase
│   ├── ModerationDecision
│   ├── Report
│   ├── Appeal
│   └── AuditEvent
│
└── Taxonomy（分类体系）
    ├── Category
    ├── Tag
    ├── ResourceType
    ├── DifficultyLevel
    └── CompetitionType
```

## 2.3 核心实体定义

| 实体 | 说明 | 核心字段 |
|---|---|---|
| User | 平台用户 | id、display_name、status、created_at |
| Role | 角色定义 | id、code、name |
| Permission | 可执行权限 | id、code、scope |
| LearningResource | 可被发现和推荐的统一资源抽象 | id、type、title、summary、owner_id、visibility、status |
| PlatformNote | 平台学习笔记 | resource_id、body、version、license_id |
| ExternalResource | 外部学习资源条目 | resource_id、url、source_platform、last_verified_at、link_status |
| ProjectCase | 优秀案例/实践成果 | resource_id、project_goal、implementation_summary、authorization_state |
| Competition | 竞赛条目 | resource_id、organizer、official_url、registration_start/end、date_certainty |
| OfficialNotice | 官方通知 | resource_id、publisher_org、effective_at、expires_at、importance |
| ForumPost | 论坛帖子/回复 | id、group_id、parent_post_id、author_id、body |
| LearningGroup | 学习小组 | id、name、creator_id、join_policy、visibility |
| KnowledgeConcept | 知识概念 | id、canonical_name、description、domain_id |
| Skill | 能力项 | id、name、description、assessment_method |
| LearningGoal | 学习目标 | id、user_id、title、target_date、status |
| LearningProfile | 用户学习画像 | user_id、profile_version、updated_at |
| CapabilityEvidence | 能力证据 | user_id、skill_id/concept_id、evidence_type、source_id、observed_at |
| LearningPlan | 学习计划 | id、user_id、goal_id、version、status |
| PlanStage | 计划阶段 | id、plan_id、sequence、title、success_criteria |
| LearningTask | 学习任务 | id、stage_id、title、status、estimated_minutes、completion_criteria |
| ModerationCase | 审核案件 | id、content_type、content_id、content_version、status |
| ModerationDecision | 审核决策记录 | case_id、decision、risk_categories、rule_version、model_version |
| Report | 用户举报 | id、reporter_id、target_type、target_id、reason、status |
| Appeal | 申诉记录 | id、case_id、appellant_id、reason、status |
| Tag | 标签 | id、name、tag_group、canonical_tag_id、status |
| Category | 内容分类 | id、name、parent_id、status |
| UsageLicense | 使用许可 | id、code、description |
| VisibilityPolicy | 可见范围 | id、code、description |
| AuditEvent | 审计事件 | id、actor_type、actor_id、action、target、timestamp |

`LearningResource` 是统一资源抽象，不意味着所有内容必须塞进一张宽表。建议采用资源主表 + 各内容类型扩展表的方式，保证搜索统一、业务字段清晰。

## 2.4 核心关系（Object Properties）

| 主体 | 关系 | 客体 | 约束/含义 |
|---|---|---|---|
| User | authors | LearningResource | 一个资源有一个主要作者；团队贡献者另建关联 |
| User | creates | LearningGroup | 小组创建者 |
| User | memberOf | LearningGroup | 用户加入小组 |
| User | ownsGoal | LearningGoal | 一个用户可有多个学习目标 |
| User | hasProfile | LearningProfile | 每个用户有一份当前画像，可保留版本 |
| LearningResource | hasTag | Tag | 多对多 |
| LearningResource | belongsToCategory | Category | 一个主分类，可有辅助分类 |
| LearningResource | aboutConcept | KnowledgeConcept | 资源讲解或涉及知识点 |
| LearningResource | requiresConcept | KnowledgeConcept | 资源的前置知识 |
| LearningResource | relatedTo | LearningResource | 内容关联，不改变权限 |
| LearningResource | references | ExternalResource | 资源引用外部条目 |
| ProjectCase | demonstratesSkill | Skill | 案例可证明某项能力，但需证据标注 |
| Competition | requiresSkill | Skill | 竞赛能力要求，注明来源与可信度 |
| KnowledgeConcept | prerequisiteOf | KnowledgeConcept | 有向先修关系 |
| Skill | supportedByConcept | KnowledgeConcept | 能力依赖的知识概念 |
| LearningGoal | requiresSkill | Skill | 目标需要的能力 |
| LearningPlan | realizesGoal | LearningGoal | 计划服务于目标 |
| LearningPlan | hasStage | PlanStage | 一对多、有序 |
| PlanStage | hasTask | LearningTask | 一对多、有序 |
| LearningTask | teachesConcept | KnowledgeConcept | 任务覆盖知识点 |
| LearningTask | developsSkill | Skill | 任务培养能力 |
| LearningTask | usesResource | LearningResource | 任务引用真实资源 |
| LearningTask | dependsOn | LearningTask | 任务依赖 |
| CapabilityEvidence | supports | Skill/KnowledgeConcept | 证据支持能力/知识掌握判断 |
| ModerationCase | reviews | LearningResource/ForumPost | 审核对象 |
| ModerationDecision | producedBy | ModerationAgent/Reviewer | 决策来源 |
| Report | reports | LearningResource/ForumPost/User | 举报对象 |
| Appeal | appeals | ModerationDecision | 对某次处理结果申诉 |
| User | grantedRole | Role | 角色授权 |
| Role | grants | Permission | 角色权限 |
| LearningResource | governedBy | VisibilityPolicy | 可见范围 |
| LearningResource | licensedUnder | UsageLicense | 使用许可 |

### 关系约束

1. `prerequisiteOf` 必须是有向无环图（DAG）；禁止 A 先修 B、B 又先修 A。
2. `relatedTo` 可以双向展示，但数据库只需保存一条规范关系或维护对称查询。
3. `usesResource` 必须引用真实存在的资源 ID，且在展示时重新校验用户权限。
4. `hasTag`、`aboutConcept` 不代表资源已通过审核，也不代表资源质量得到官方背书。
5. `demonstratesSkill` 必须记录证据来源，不能因为项目标题中出现某技术就认定作者掌握该技术。
6. `requiresSkill` 和知识先修关系应记录维护者、来源、版本和可信状态。
7. 删除或下架资源不能级联删除学习计划历史；历史任务应保留资源快照引用和不可访问提示。

## 2.5 受控词表（Controlled Vocabulary）

不要允许每个 Agent 自由创造核心枚举。建议首期维护以下词表：

### 资源类型 `resource_type`

- `platform_note`
- `external_resource`
- `project_case`
- `competition`
- `official_notice`
- `forum_post`
- `learning_group`

### 可见范围 `visibility`

- `private`
- `campus`
- `public`
- `members`

> **与前端实现的对齐说明（2026-11 补充）**
>
> 前端 `src/data/dict.js` 的 `visibilityScopes` 用的是 `members` 而非 `members_only`。
> **以代码为准**，本表统一改为 `members`。
>
> 原因：可见范围是后端权限过滤的主要入参，键名不一致会导致过滤条件永远匹配不上，
> 表现为「明明设为成员可见，但所有人都能看到」这类难以定位的问题。
> 命名上 `members` 也更短，前后端一致更省事。
>
> 另注：`members` 表示「仅指定小组或成员的成员可见」，属于**基于关系**的可见性，
> 与 `private`（仅作者本人）和 `campus`（全体校内用户）不同 ——
> 权限服务实现时需要单独处理，不能简单当作 `campus` 的子集。

### 使用许可 `usage_license`

- `all_rights_reserved`
- `view_only`
- `allow_share_with_attribution`
- `allow_derivatives`
- `custom`

注意：可见范围和许可必须分别存储。`public + all_rights_reserved` 是合法组合，表示公开查看但保留其他权利。

### 内容状态 `content_status`

- `draft`
- `pending`
- `review`
- `published`
- `returned`
- `hidden`
- `removed`
- `archived`
- `deleted`

> **与前端实现的对齐说明（2026-11 补充）**
>
> 本表以代码为准（`src/data/dict.js` 的 `contentStates`）。
> 初稿曾用 `pending_moderation` / `pending_review`，
> 现改为 `pending` / `review` 以与前端字典一致 ——
> 后端建表与前端字典必须使用同一套键名，否则状态流转会对不上。
>
> 语义对应：
>
> | 键名 | 含义 | 初稿曾用的名字 |
> |---|---|---|
> | `draft` | 草稿，仅自己可见 | `draft` |
> | `pending` | 已提交，等待审核 Agent 初筛 | `pending_moderation` |
> | `review` | 审核 Agent 置信不足或存在争议，转人工 | `pending_review` |
> | `published` | 已公开发布 | `published` |
> | `returned` | 退回修改 | `returned` |
> | `hidden` | 暂时隐藏，因争议下线 | `hidden` |
> | `removed` | 已下架，退出主要展示区 | （初稿遗漏） |
> | `archived` | 已归档，保留可查但不参与推荐 | `archived` |
> | `deleted` | 已删除 | `deleted` |
>
> 注意 `removed` 与 `archived` 的区别：前者是「主动下架」，后者是「历史归档」。
> 这个区分在产品设计书 §11.1 中已有定义（代码 `contentStates` 里两者 desc 不同），
> 本设计书初稿遗漏了 `removed`，此处补齐。
>
> **另外：`pending` 与 `review` 必须拆成两态，不能合并。**
> 审核 Agent 的 REVIEW 结论（§5.7）落到的就是 `review`；
> 如果只用一个 `pending`，则「还没审」和「审了但要人工看」无法区分，
> 人工复核队列（§5.8）也就无从筛选。
>
> 可用 `npm run check:vocab` 校验本表与代码是否一致（脚本见 §16.3）。

### 难度 `difficulty`

- `beginner`
- `intermediate`
- `advanced`
- `unknown`

### 学习阶段 `learning_stage`

- `foundation`
- `core`
- `practice`
- `project`
- `review`

### 证据类型 `evidence_type`

- `USER_STATED`
- `SELF_ASSESSED`
- `TASK_VERIFIED`
- `TEACHER_VERIFIED`
- `SYSTEM_OBSERVED`
- `UNKNOWN`

> **与《三大 Agent 技术架构与详细设计》的对齐（2026-11 补充）**
>
> 那份文档只列了 4 种（`USER_STATED` / `SELF_ASSESSED` / `TASK_VERIFIED` / `UNKNOWN`）。
> 本表是最终版本，补充的两项对本平台尤其重要：
>
> - `TEACHER_VERIFIED`：教师确认。
>   教师端本来就有「案例授权确认」流程（产品设计书 §5.6.5），教师确认过的能力
>   权重应高于用户自述。
> - `SYSTEM_OBSERVED`：系统行为记录，仅表示发生过行为，**不代表掌握**。
>   必须与 `TASK_VERIFIED` 严格区分 —— 「点开过视频」是 `SYSTEM_OBSERVED`，
>   「提交并通过了练习」才是 `TASK_VERIFIED`。§6.3 的禁止规则依赖这个区分。
>
> 两份文档需按本表统一。

### 竞赛日期确定性 `date_certainty`

- `official_confirmed`
- `estimated_from_previous_year`
- `user_submitted_unverified`
- `unknown`

### 审核结果 `moderation_decision`

- `ALLOW`
- `REVIEW`
- `REJECT`

### 审核案件状态 `moderation_case_status`

- `created`
- `analyzing`
- `pending_human_review`
- `returned_to_author`
- `approved`
- `rejected`
- `appealed`
- `closed`
- `failed_safe`

## 2.6 知识本体与学习本体的边界

**知识本体**回答“这个领域有哪些概念、技能，以及它们之间有什么依赖关系”。

**学习本体**回答“某个用户为了某个目标，需要掌握哪些知识和能力，通过哪些任务与资源学习，并用什么证据证明进展”。

两者不能混为一谈。例如：

- `Python基础 prerequisiteOf NumPy数据处理` 属于知识关系。
- `用户A TASK_VERIFIED 掌握 Python基础` 属于用户能力证据。
- `计划P的任务T usesResource 笔记R` 属于学习计划关系。

知识图谱不应该直接存储某个用户的全部个人学习状态；用户学习状态应由画像、证据和计划数据管理。

## 2.7 本体实现方式

第一阶段建议 PostgreSQL：

- `knowledge_concepts`：知识概念节点。
- `knowledge_relations`：知识概念关系边。
- `skills`：能力项。
- `skill_concept_relations`：能力与知识概念映射。
- `resource_concepts`：资源与知识概念关联。
- `resource_tags`：资源与标签关联。
- `learning_task_concepts`：任务覆盖知识点。
- `learning_task_skills`：任务培养能力。

关系表统一包含：

```text
id
source_id
relation_type
target_id
weight              -- 可选，仅用于有依据的排序/强度
confidence_label    -- verified / reviewed / proposed / unknown
source_type         -- admin / teacher / import / agent_suggestion
source_id_ref       -- 来源记录
version
created_at
updated_at
```

Agent 可以提出“建议新增知识关系”，但不能直接把建议写成已验证的正式本体关系。新增、合并、停用核心概念应经过管理员或指定维护者确认。

---

# 3. 共享领域服务与基础设施

## 3.1 必须建设的共享服务

| 服务 | 职责 | 主要调用方 |
|---|---|---|
| PermissionService | 用户、角色、资源、工具和操作权限检查 | 全部 Agent |
| ResourceService | 资源详情、状态、分类、标签、来源、授权信息 | 全部 Agent |
| ResourceSearchService | 全文、向量、元数据检索和排序 | 搜索、学习规划 |
| KnowledgeService | 知识概念、能力项、先修关系查询 | 学习规划、搜索 |
| UserLearningProfileService | 画像、证据、偏好和学习历史 | 学习规划 |
| ModerationPolicyService | 审核规则读取、版本管理、策略判定 | 审核 |
| ModerationCaseService | 审核案件、人工复核、申诉、状态流转 | 审核、管理员端 |
| LearningPlanService | 目标、计划、阶段、任务和进度持久化 | 学习规划 |
| AuditService | 关键操作与 Agent 决策审计 | 全部 Agent |
| LLMGateway | 模型统一调用、超时、重试、成本与日志 | 全部 Agent |

## 3.2 LLM Gateway

统一接口建议：

```python
class LLMGateway:
    async def generate_structured(
        self,
        *,
        task_name: str,
        messages: list,
        output_schema: type,
        model_profile: str,
        timeout_seconds: int = 30,
    ):
        """返回通过 Pydantic 校验的结构化结果。"""
        ...

    async def embed(
        self,
        texts: list[str],
        *,
        model_profile: str,
    ):
        ...

    async def rerank(
        self,
        query: str,
        documents: list[dict],
        *,
        model_profile: str,
    ):
        ...
```

模型配置按任务划分，而不是每个 Agent 写死一个模型：

- `query_understanding`
- `semantic_moderation`
- `learning_goal_analysis`
- `plan_generation`
- `resource_reranking`
- `embedding`

模型不可用时必须有明确降级策略。审核不可用不能默认放行；搜索可降级到关键词检索；学习规划可返回未完成的草案并说明缺少哪些数据。

## 3.3 Tool Registry

每个工具注册以下信息：

```python
class ToolDefinition:
    name: str
    description: str
    input_schema: type
    output_schema: type
    required_permissions: list[str]
    side_effect_level: str  # read / propose / write
    timeout_seconds: int
    retryable: bool
```

工具权限建议分级：

- `read`：只读查询。
- `propose`：生成建议，不修改业务事实。
- `write`：通过领域服务执行明确授权的写操作。

第一阶段三个 Agent 绝大多数工具应为 `read` 或 `propose`。对学习计划的保存、任务状态更新，应由用户确认或由明确的用户操作触发。

## 3.4 统一错误模型

```json
{
  "error": {
    "code": "RESOURCE_PERMISSION_DENIED",
    "message": "当前用户无权访问该资源。",
    "retryable": false,
    "trace_id": "trace_xxx"
  }
}
```

常见错误码：

- `AUTH_REQUIRED`
- `PERMISSION_DENIED`
- `RESOURCE_NOT_FOUND`
- `RESOURCE_UNAVAILABLE`
- `MODEL_TIMEOUT`
- `MODEL_OUTPUT_INVALID`
- `RETRIEVAL_UNAVAILABLE`
- `ONTOLOGY_RELATION_INVALID`
- `WORKFLOW_INTERRUPTED`
- `SAFE_FALLBACK_REQUIRED`

---

# 4. Agent A：全局搜索与发现 Agent

## 4.1 定位

帮助学生、教师和访客在用户有权访问的范围内，发现学校公告、学习笔记、论坛/小组、竞赛、外部学习资源和优秀案例。Agent 的价值是理解自然语言意图、扩展专业术语、跨类别组织真实结果，而不是替代检索引擎。

## 4.2 能力边界

### 必须实现

1. 关键词搜索和自然语言搜索。
2. 搜索意图识别。
3. 查询改写与同义词扩展。
4. 内容类型、专业方向、难度、时间等筛选。
5. 全文检索 + 向量检索 + 元数据检索。
6. 权限过滤。
7. 排序融合与可选重排。
8. 按资源类型组织结果。
9. 结果摘要、来源、更新时间和访问入口。
10. 无结果时给出可执行的改写建议。

### 不负责

- 不生成虚构资源。
- 不改变资源权限。
- 不代替内容审核。
- 不把浏览量直接当作质量。
- 不将失效竞赛日期当作当前有效日期。
- 不自动抓取并复制第三方完整课程或付费内容。

## 4.3 搜索架构

```text
Search API
   │
   ▼
Auth Context + Permission Scope
   │
   ▼
Query Understanding（LangChain structured output）
   │
   ├── simple query ───────────────┐
   │                               │
   └── complex query → LangGraph   │
                      │            │
                      ▼            │
                Query Decompose    │
                      │            │
                Parallel Retrieve │
                      │            │
                Result Merge       │
                      │            │
                Need More Search?  │
                      │            │
                Optional 2nd Pass  │
                      └─────┬──────┘
                            ▼
                  Permission Re-check
                            ▼
                    RRF / Ranking
                            ▼
                    Optional Reranker
                            ▼
                    Result Validation
                            ▼
                    Group & Summarize
                            ▼
                       Search DTO
```

## 4.4 搜索意图 Schema

```python
from pydantic import BaseModel, Field
from typing import Literal

class SearchIntent(BaseModel):
    original_query: str
    normalized_query: str
    intent_type: Literal[
        "keyword_lookup",
        "resource_discovery",
        "learning_goal",
        "competition_lookup",
        "project_lookup",
        "announcement_lookup",
        "discussion_lookup",
        "mixed"
    ]
    topics: list[str] = []
    expanded_terms: list[str] = []
    resource_types: list[str] = []
    difficulty: str | None = None
    time_constraint: str | None = None
    required_constraints: dict = {}
    is_complex: bool = False
    clarification_needed: bool = False
    clarification_question: str | None = None
```

规则：

- 简单关键词查询不应强制调用多轮 LLM。
- 只有跨主题、多约束、学习目标型查询才进入 LangGraph。
- 模型生成的扩展词只能用于检索，不得直接成为结果事实。
- 解析不确定时保留原始 query，不要覆盖用户原意。

## 4.5 混合检索流程

### 第一步：生成检索计划

根据意图生成受限计划，例如：

```json
{
  "queries": [
    {"text": "ESP32 入门", "types": ["platform_note", "external_resource"]},
    {"text": "ESP32 实践项目", "types": ["project_case"]},
    {"text": "嵌入式学习小组", "types": ["learning_group", "forum_post"]}
  ],
  "filters": {
    "difficulty": ["beginner", "unknown"],
    "status": ["published"]
  }
}
```

### 第二步：多路检索

1. PostgreSQL FTS/BM25 风格全文检索：适合精确术语、标题和关键词。
2. pgvector 向量检索：适合语义相似表达。
3. 元数据检索：类型、标签、作者、难度、时间、竞赛状态。
4. 本体扩展：利用同义词、上位概念、相关知识点扩展查询。

### 第三步：权限过滤

必须在检索阶段尽早过滤，并在结果返回前二次校验。不能只在前端隐藏无权限结果，因为标题、摘要、数量和作者信息本身也可能泄露隐私。

### 第四步：排序融合

初始使用 Reciprocal Rank Fusion（RRF）融合全文和向量排名：

\[
RRF(d)=\sum_{r \in R}\frac{1}{k+rank_r(d)}
\]

再结合：

- 语义相关性。
- 标题/正文匹配度。
- 内容状态和有效性。
- 更新时间与时效性。
- 教师推荐或人工精选标记。
- 资源质量反馈。
- 用户明确筛选条件。

不要第一天就手工设定复杂的固定权重。先保存检索特征和人工相关性标注，再用评估集调整。

### 第五步：重排与结果组织

仅对候选 Top-N 调用 Reranker，避免全量调用增加成本。结果按笔记、案例、外部资源、竞赛、论坛/小组、官方通知分组。

摘要应基于资源字段或正文片段生成，并附资源 ID。资源详情、作者、链接、时间、权限全部从数据库读取，不接受模型生成的 ID 或 URL。

## 4.6 LangGraph 工作流定义

建议首期只实现一个主图，避免过度拆分子图：

```text
START
  ↓
parse_intent
  ↓
classify_complexity
  ├── simple → build_single_query
  │               ↓
  │          hybrid_retrieve
  │               ↓
  │          validate_and_rank
  │
  └── complex → decompose_query
                  ↓
             parallel_retrieve
                  ↓
             merge_candidates
                  ↓
             evaluate_coverage
                  ├── sufficient → validate_and_rank
                  └── insufficient → refine_once → retrieve_again
                                                    ↓
                                              validate_and_rank
  ↓
organize_results
  ↓
END
```

首期最多允许一次自动二次检索，避免无限循环。每次检索都受 `max_candidates`、`max_queries`、`max_latency_ms` 约束。

### SearchState

```python
class SearchState(TypedDict):
    request_id: str
    user_id: str
    query: str
    intent: dict
    query_plan: list[dict]
    candidates: list[dict]
    authorized_candidates: list[dict]
    ranked_results: list[dict]
    coverage_sufficient: bool
    retry_count: int
    warnings: list[str]
    error: str | None
```

`user_id` 和权限范围必须由后端注入，不能由 LLM 输出或覆盖。

## 4.7 工具接口

```python
class ResourceSearchService:
    async def hybrid_search(
        self,
        *,
        user_context: UserContext,
        query: str,
        resource_types: list[str] | None,
        filters: dict,
        limit: int = 30,
    ) -> list[SearchCandidate]:
        ...

    async def get_resource_cards(
        self,
        *,
        user_context: UserContext,
        resource_ids: list[str],
    ) -> list[ResourceCard]:
        ...

    async def validate_access(
        self,
        *,
        user_context: UserContext,
        resource_ids: list[str],
    ) -> set[str]:
        ...
```

禁止提供 `execute_sql(sql: str)` 这类任意数据库工具。

## 4.8 API

`POST /api/agents/search`

请求：

```json
{
  "query": "我想从零开始学 ESP32，最好有实践项目",
  "filters": {
    "resource_types": [],
    "difficulty": ["beginner"]
  },
  "limit": 20
}
```

响应：

```json
{
  "request_id": "srch_xxx",
  "status": "success",
  "query": "我想从零开始学 ESP32，最好有实践项目",
  "interpreted_intent": {
    "topics": ["ESP32", "嵌入式基础"],
    "intent_type": "learning_goal"
  },
  "groups": [
    {
      "resource_type": "platform_note",
      "items": [
        {
          "resource_id": "res_xxx",
          "title": "ESP32 入门笔记",
          "summary": "……",
          "difficulty": "beginner",
          "updated_at": "2026-10-01T10:00:00Z",
          "access_url": "/resources/res_xxx"
        }
      ]
    }
  ],
  "warnings": [],
  "total": 1
}
```

响应中的资源信息必须由 ResourceService 填充；LLM 只能提供意图、扩展词和摘要草案。

## 4.9 搜索评估

建立至少 100 条人工标注查询作为第一版评估集，覆盖：

- 精确关键词。
- 同义词/别名。
- 跨类型查询。
- 自然语言学习目标。
- 竞赛时间查询。
- 无结果查询。
- 有权限/无权限资源混合查询。

指标：

- Recall@5、Recall@10。
- Precision@5。
- NDCG@10。
- MRR。
- Empty Result Accuracy。
- Permission Violation Rate，目标严格为 0。
- p50/p95 延迟。
- 每次查询模型成本。

---

# 5. Agent B：内容审核 Agent

## 5.1 定位

内容审核 Agent 是受约束的内容风险识别系统。它负责发现风险、给出证据、提出处理建议并将不确定事项交给人工。它不是最终处罚者，也不是平台规则制定者。

## 5.2 第一阶段审核范围

严格遵循产品设计书：

- 笔记标题和正文。
- 优秀案例标题、摘要和作者文字介绍。
- 论坛帖子、回复和小组介绍。
- 外部资源标题、简介与提交说明。
- 用户头像名称、个人简介中允许公开的文字字段。

第一阶段不承诺识别文档、图片、视频内部内容。未扫描的附件必须显示“未进行内容识别”或等效提示，不能宣称已经完整审核。

## 5.3 审核风险分类

| code | 风险类别 | 典型判断 |
|---|---|---|
| `abuse_harassment` | 辱骂、人身攻击、恶意骚扰 | 结合上下文判断 |
| `spam_promotion` | 垃圾广告、刷屏、明显无关推广 | 结合频率和内容特征 |
| `malicious_link` | 恶意链接、诈骗或有害诱导 | URL 风险与人工核验 |
| `privacy_exposure` | 未经授权公开个人敏感信息 | 需要谨慎处理 |
| `copyright_concern` | 疑似侵权、未经授权转载、冒名成果 | 只标记疑点，不自动作法律定性 |
| `platform_policy` | 明确违反平台社区规则 | 必须对应已发布规则 |
| `context_uncertain` | 语境不清、证据不足 | 默认进入复核 |

## 5.4 审核流水线

```text
Content Submitted
       ↓
Create ModerationCase + Content Snapshot
       ↓
Normalize Text / Extract Allowed Fields
       ↓
Deterministic Rule Engine
       ↓
LangChain Semantic Analyzer
       ↓
Evidence Validation
       ↓
Risk Aggregator
       ↓
Decision Policy
   ┌───┼───────────┐
   ↓   ↓           ↓
 ALLOW REVIEW     REJECT
   ↓   ↓           ↓
Business state    Human Review Queue
transition         ↓
   └───────┬───────┘
           ↓
       Audit Event
```

## 5.5 Rule Engine

规则分两类：

### 确定性规则

- 必填字段缺失。
- 内容长度、格式、附件大小超限。
- 明确禁止的链接域名或已确认恶意 URL。
- 高频重复提交或明显刷屏。
- 已确认违规的精确模式。

### 语义规则

- 辱骂是否针对具体用户。
- 某段内容是引用、教学讨论还是实际攻击。
- 外部资源描述是否存在明显误导。
- 案例是否疑似冒用他人成果。
- 是否存在隐私泄露风险。

确定性规则可以直接给出明确结果；语义规则应优先产生风险证据，而不是直接作处罚。

规则必须有 `rule_id`、`rule_version`、`scope`、`severity`、`enabled`、`effective_at`、`created_by`、`change_reason`。规则修改必须可回滚。

## 5.6 LangChain 语义分析

第一阶段不需要自主 Agent Loop。直接使用 Prompt + 模型调用 + Pydantic Structured Output 即可。

```python
class RiskEvidence(BaseModel):
    text_span: str
    start_offset: int | None = None
    end_offset: int | None = None
    explanation: str
    rule_category: str

class SemanticModerationResult(BaseModel):
    risk_categories: list[str]
    risk_level: Literal["low", "medium", "high", "critical"]
    evidence: list[RiskEvidence]
    context_notes: list[str]
    recommendation: Literal["allow", "review", "reject"]
    uncertainty_reasons: list[str]
```

约束：

- 模型必须引用输入中的原文片段，不能虚构证据。
- 服务端验证 `text_span` 是否真实存在于原文。
- 模型不得新增平台规则类别。
- `confidence` 不是违规概率，不能单独作为自动拒绝依据。
- 对版权、隐私、团队成果授权等争议，模型只能标记风险并转人工。

## 5.7 决策引擎

| 情况 | 系统决策 | 后续 |
|---|---|---|
| 未命中规则，语义风险低 | ALLOW | 由业务服务推进发布 |
| 语义不确定或存在争议 | REVIEW | 进入人工复核 |
| 明确命中已启用的硬性规则 | REJECT | 向作者展示原因与修改/申诉入口 |
| 模型超时、格式错误或规则服务异常 | FAILED_SAFE / REVIEW | 暂缓发布，不默认放行 |
| 附件未扫描 | 按附件策略处理 | 明确显示未检查范围 |

自动拒绝只允许用于经过平台确认、可解释、可测试的硬规则。其余模型判断默认 REVIEW。阈值需在标注数据上验证，不在设计文档中拍脑袋给固定分数。

## 5.8 人工复核与申诉

审核案件状态：

```text
created
  → analyzing
  → pending_human_review
      → approved
      → returned_to_author
      → rejected
  → appealed
      → re_reviewing
      → appeal_accepted / appeal_rejected
  → closed
```

复核界面必须展示：

- 原始内容快照和版本。
- 规则命中项及规则版本。
- 模型风险类别、证据片段和不确定原因。
- 用户此前修改记录。
- 举报上下文（仅在审核人员有权限时）。
- 人工处理选项和理由输入。

审核 Agent 可以调用 `create_review_task()` 创建复核任务，但不能调用 `delete_content()`、`ban_user()` 或 `update_policy()`。

## 5.9 API

- `POST /api/moderation/check`：创建审核案件。
- `GET /api/moderation/cases/{case_id}`：查看案件状态（权限控制）。
- `POST /api/moderation/cases/{case_id}/review`：人工复核决定。
- `POST /api/moderation/cases/{case_id}/appeal`：提交申诉。
- `GET /api/admin/moderation/queue`：管理员复核队列。

模型分析结果与内容状态流转必须分开。业务服务在确认权限、案件状态和操作理由后，才执行发布、退回、隐藏或拒绝。

## 5.10 审计字段

每次审核保存：

- `case_id`
- `content_id`、`content_type`、`content_version`
- 原文快照哈希
- 提交者
- 规则版本
- Prompt 版本
- 模型名称/版本
- 结构化模型输出
- 规则命中结果
- 最终 Agent 建议
- 人工决定及理由
- 状态变更操作者和时间
- trace_id

## 5.11 审核评估

构建人工标注集，按风险类别分层，不能只统计总体准确率：

- Precision / Recall / F1。
- False Positive Rate。
- False Negative Rate。
- Review Rate。
- 各类别混淆矩阵。
- 证据片段有效率。
- 人工复核推翻率。
- 审核记录完整率。
- 模型超时后的安全降级成功率。

首期建议先运行“影子模式”：模型给出建议但不自动拦截，人工审核照常进行；比较模型结果与人工结果后，再逐步开放低风险自动放行和少量硬规则拦截。

## 5.12 教师审核路径（2026-11 补充）

前面 §5.8 描述的是**管理员**人工复核队列。但产品设计书 §6.4 规定了一条并行的、
独立的管理路径：被授予内容审核职责的教师，可以在授权范围内查看待审核队列并处置。

**这两条路径必须分开设计，不能合并成一个队列。**

### 两条路径的差异

| | 教师审核（§6.4） | 管理员复核（§7） |
|---|---|---|
| 授权依据 | 单独授予的审核职责 | 平台管理员角色 |
| 范围 | 明确限定的授权范围（如某类内容、某个学科） | 全站 |
| 可做动作 | 5 种：通过 / 退回修改 / 暂缓并转交 / 隐藏待核实 / 拒绝并说明理由 | 全套管理动作，含封禁、规则修改 |
| 明确禁止 | 处理不属于自己的账号、全站规则、其他部门的官方通知 | —— |
| 审核对象 | 分配给本人的审核任务 | 全站举报、审核异常、申诉 |

产品设计书 §6.4 原文：「教师不能随意处理不属于其权限范围的用户账号、
全站规则或其他部门的官方通知。」这条边界在数据层要体现出来，
不能只靠界面隐藏。

### 教师可执行的动作

| 动作 | 语义 | 对内容状态的影响 |
|---|---|---|
| `approve` | 通过，内容符合规则 | → `published` |
| `return` | 退回修改，说明需要改什么 | → `returned` |
| `defer` | 暂缓并转交，超出本人判断范围 | 案件 → `transferred`，内容状态不变 |
| `hide` | 隐藏待核实，存在争议暂时下线 | → `hidden` |
| `reject` | 拒绝并说明理由 | → `removed`（区别于 `deleted`） |

> **`reject` 落 `removed` 而不是 `deleted`**：
> `removed` 是「已下架，仍可查」，`deleted` 是「已删除」。
> 教师拒绝一条内容不应让它从记录里消失 —— 学生要能看到拒绝理由并申诉，
> 管理员要能看到历史处置。这与 §7.3「学习计划版本不可原地覆盖」是同一种取向：
> 处置留痕，不抹除。

### 与审核 Agent 的关系

教师审核队列里的内容，**同样经过审核 Agent 初筛**（§5.4 流水线），
教师看到的是 Agent 建议 + 风险证据 + 不确定原因（§5.8 复核界面要求）。

因此 §5.8 的复核界面要求（原始快照、规则命中项及版本、模型风险类别、
证据片段、用户修改记录）**对教师复核同样适用**。

**教师无权做的事**：不能通过教师审核接口修改审核规则、不能封禁账号、
不能处置官方通知。教师只能对**内容本身**做 §6.4 的 5 种处置。

### API

- `GET /api/teacher/reviews`：教师待审核队列（按授权范围过滤）。
- `POST /api/moderation/cases/{case_id}/teacher-action`：教师处置。
  动作必须在 §6.4 的 5 种之内，服务端校验：
  1. 该教师对该案件有审核职责；
  2. 该案件在其授权范围内；
  3. 动作类型合法；
  4. 需要理由的动作（退回、拒绝）必须带理由。

### 数据层要求

`ModerationCase` 增加 `assigned_reviewer_id` 与 `scope_grant_id`
（指向授权该教师审核范围的能力位记录）。

**待审核队列的过滤必须在后端按授权范围完成** ——
不能把全站案件取出来再在前端过滤，那等于把不该看的内容暴露给了前端
（与 §9.1 同一原则）。

---

# 6. Agent C：个人学习规划 Agent

## 6.1 定位

结合用户目标、可验证能力、学习进度和平台真实资源，制定分阶段、可执行、可跟踪、可调整的学习计划。其核心不是生成长篇计划，而是建立可信的学习状态并持续改善任务安排。

## 6.2 规划所依赖的领域模型

```text
User
 ├── LearningProfile
 │    ├── LearningPreference
 │    ├── LearningGoal
 │    ├── CapabilityEvidence
 │    └── LearningActivity
 │
 └── LearningPlan
      ├── PlanStage
      │    └── LearningTask
      │         ├── TaskConcept
      │         ├── TaskSkill
      │         ├── TaskResource
      │         ├── CompletionCriterion
      │         └── TaskEvidence
      └── PlanVersion
```

## 6.3 学习画像设计

画像分成四个区块：

1. **用户明确资料**：专业/方向、年级（用户愿意提供时）、兴趣、目标。
2. **学习偏好**：偏好视频/文档/实践、每周可投入时间、学习节奏。
3. **能力状态**：知识点和技能的掌握状态及证据。
4. **学习历史**：任务完成、测验结果、项目成果、用户反馈。

每条能力状态必须带证据类型：

- `USER_STATED`：用户明确说自己掌握。
- `SELF_ASSESSED`：用户自评。
- `TASK_VERIFIED`：通过任务或测验验证。
- `TEACHER_VERIFIED`：教师确认。
- `SYSTEM_OBSERVED`：系统行为记录，仅表示发生过行为，不直接代表掌握。
- `UNKNOWN`：无足够证据。

禁止规则：

- 用户问过 Python，不代表会 Python。
- 用户收藏了机器学习资源，不代表正在学习机器学习。
- 用户完成视频播放，不代表掌握视频内容。
- 用户自述掌握不能自动升级为 `TASK_VERIFIED`。
- 没有证据时必须保留 `UNKNOWN`。

## 6.4 目标结构化

```python
class LearningGoalInput(BaseModel):
    title: str
    goal_type: Literal[
        "course_learning",
        "skill_learning",
        "competition_preparation",
        "project_practice",
        "career_exploration"
    ]
    target_outcomes: list[str]
    target_date: date | None = None
    weekly_available_minutes: int | None = None
    current_level: str | None = None
    constraints: list[str] = []
```

缺少关键条件时，Agent 可以先给出草案，但必须把假设标出来。例如“暂按每周 6 小时估算”。不能默认为用户每天有固定时间。

## 6.5 能力差距分析

计算逻辑分三步：

1. 从目标映射出所需技能与知识概念。
2. 从画像和证据读取当前状态。
3. 计算已验证、待验证、待学习的差距。

建议状态：

- `verified_mastered`
- `self_reported`
- `needs_assessment`
- `not_started`
- `in_progress`
- `unknown`

Agent 只能提出评估建议，不能无证据地把 `unknown` 改成 `not_started` 或 `mastered`。

## 6.6 知识路径生成

使用知识本体中的 `prerequisiteOf` 有向无环图：

1. 找出目标技能关联知识点。
2. 沿先修边向前追溯。
3. 去重并构建依赖子图。
4. 按拓扑排序得到候选学习顺序。
5. 根据用户已验证能力跳过或压缩已掌握节点。
6. 对未知节点安排诊断任务，而不是直接假定掌握。

先修关系需要有维护状态。未经审核的 Agent 建议关系只能作为候选边，不可直接影响正式计划。

## 6.7 资源匹配

学习规划调用共享 `ResourceSearchService`，根据每个阶段的知识点、技能、难度、资源类型和时间约束匹配资源。

资源匹配顺序：

1. 资源必须存在且状态允许使用。
2. 用户必须有权访问。
3. 资源必须与知识点/技能相关。
4. 难度与用户当前阶段匹配。
5. 资源有效性、更新时间、质量反馈。
6. 教师推荐或人工精选可作为辅助信号。

如果平台没有匹配资源，计划中显示“平台暂未找到对应资源”，可以建议用户搜索或提交资源，不允许伪造标题、作者和链接。

## 6.8 计划数据结构

```json
{
  "plan_id": "plan_xxx",
  "user_id": "user_xxx",
  "goal_id": "goal_xxx",
  "version": 1,
  "status": "active",
  "assumptions": [
    "每周可投入时间暂按 6 小时估算，等待用户确认"
  ],
  "stages": [
    {
      "stage_id": "stage_01",
      "sequence": 1,
      "title": "基础准备",
      "objective": "建立必要的编程与数学基础",
      "success_criteria": [
        "完成基础练习",
        "能够独立解释关键概念"
      ],
      "tasks": [
        {
          "task_id": "task_01",
          "title": "完成 Python 数据处理练习",
          "estimated_minutes": 180,
          "status": "pending",
          "concept_ids": ["concept_python_basic"],
          "skill_ids": ["skill_python_data"],
          "resource_ids": ["res_real_001"],
          "completion_criteria": [
            "提交练习代码",
            "通过指定测试"
          ],
          "evidence_required": ["code_submission", "test_result"]
        }
      ]
    }
  ]
}
```

## 6.9 LangGraph 工作流

```text
START
  ↓
parse_goal
  ↓
load_learning_profile
  ↓
check_missing_constraints
  ├── critical_missing → ask_user / save_draft
  └── sufficient
        ↓
map_goal_to_skills
        ↓
analyze_capability_evidence
        ↓
build_knowledge_subgraph
        ↓
topological_learning_order
        ↓
match_real_resources
        ↓
generate_plan_draft
        ↓
validate_plan
        ├── invalid → revise_plan_once
        └── valid
              ↓
        present_plan_for_confirmation
              ↓
        user_confirm
              ↓
        persist_plan_version
              ↓
             END
```

### LearningPlanState

```python
class LearningPlanState(TypedDict):
    user_id: str
    goal_input: dict
    profile_snapshot: dict
    required_skills: list[dict]
    capability_gaps: list[dict]
    knowledge_nodes: list[dict]
    ordered_concepts: list[str]
    matched_resources: list[dict]
    plan_draft: dict
    validation_errors: list[str]
    assumptions: list[str]
    user_confirmed: bool
    plan_id: str | None
    plan_version: int | None
```

LangGraph Checkpointer 用于工作流暂停、恢复和故障续跑；学习画像、目标、计划、任务和证据仍保存在 PostgreSQL。不能把 Checkpointer 当成业务数据库。

## 6.10 计划校验器（Plan Validator）

计划生成后必须通过确定性校验：

- 每个任务必须有目标。
- 每个任务必须有完成标准。
- 资源 ID 必须真实存在。
- 资源必须对当前用户可访问。
- 前置任务必须先于依赖任务。
- 预计总时间不能明显超过用户时间约束。
- 不允许出现知识图谱中的循环依赖。
- 不允许将未知能力标记为已掌握。
- 计划阶段必须覆盖用户目标要求的关键能力。
- 竞赛计划必须区分官方时间与预计时间。

校验失败时最多自动修订一次；仍失败则返回具体问题，不要无限调用模型。

## 6.11 进度与计划调整

任务状态：

- `pending`
- `in_progress`
- `completed`
- `blocked`
- `skipped`

任务完成必须来自用户确认、任务提交或明确的验证事件。Agent 可以根据对话建议更新，但必须获得用户确认或由业务规则认可。

触发计划调整的事件：

- 目标或截止日期改变。
- 每周可投入时间改变。
- 任务完成或失败。
- 测验结果更新。
- 用户反馈任务太难/太简单。
- 推荐资源失效或下架。
- 先修知识评估结果改变。

调整时创建新版本，不覆盖旧计划。系统应给出“为什么调整、调整了什么、对截止时间有何影响”。

## 6.12 API

- `POST /api/learning/goals`：创建目标。
- `POST /api/agents/learning-plans/generate`：生成计划草案。
- `POST /api/learning/plans/{plan_id}/confirm`：确认保存。
- `GET /api/learning/plans/{plan_id}`：查看计划。
- `POST /api/learning/tasks/{task_id}/status`：更新任务状态。
- `POST /api/learning/evidence`：提交测验/任务/作品证据。
- `POST /api/agents/learning-plans/{plan_id}/adjust`：请求调整计划。

---

# 7. 数据库逻辑模型（首期）

## 7.1 核心表建议

### 用户与权限

- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `resource_acl`（若可见范围规则不足以覆盖具体授权）
- `audit_events`

### 内容与资源

- `resources`
- `resource_notes`
- `resource_external_links`
- `resource_project_cases`
- `resource_competitions`
- `resource_official_notices`
- `forum_groups`
- `forum_posts`
- `attachments`
- `categories`
- `tags`
- `resource_tags`
- `resource_relations`
- `resource_concepts`
- `resource_licenses`

### 本体与知识

- `knowledge_domains`
- `knowledge_concepts`
- `knowledge_relations`
- `skills`
- `skill_concept_relations`
- `ontology_change_requests`

### 审核治理

- `moderation_rules`
- `moderation_rule_versions`
- `moderation_cases`
- `moderation_rule_hits`
- `moderation_model_results`
- `moderation_decisions`
- `moderation_reviews`
- `reports`
- `appeals`

### 学习规划

- `learning_profiles`
- `learning_preferences`
- `learning_goals`
- `capability_evidence`
- `learning_plans`
- `learning_plan_versions`
- `learning_plan_stages`
- `learning_tasks`
- `learning_task_resources`
- `learning_task_concepts`
- `learning_task_skills`
- `learning_activities`

### 检索与运行

- `resource_search_documents`
- `resource_embedding_chunks`
- `agent_runs`
- `agent_feedback`
- `workflow_checkpoints`（若使用 LangGraph Postgres Checkpointer，由其管理对应表）

## 7.2 资源主表设计要点

`resources` 统一存储跨类型共有字段：

```text
id UUID PK
resource_type VARCHAR
title VARCHAR
summary TEXT
author_id UUID
created_by UUID
status VARCHAR
visibility VARCHAR
license_id UUID NULL
category_id UUID NULL
difficulty VARCHAR NULL
language VARCHAR NULL
published_at TIMESTAMP NULL
updated_at TIMESTAMP
last_verified_at TIMESTAMP NULL
source_type VARCHAR
source_url TEXT NULL
content_hash VARCHAR NULL
created_at TIMESTAMP
```

内容特有字段放在扩展表中。搜索服务通过统一视图或索引文档聚合，不要让 Agent 依赖复杂的多表 SQL。

## 7.3 重要数据约束

- 所有资源 ID 使用稳定 UUID，不使用标题作为主键。
- 资源详情查询必须再次检查权限。
- `visibility` 与 `license_id` 分离。
- 审核案件绑定内容版本或内容哈希，防止审核旧版本后误放新版本。
- 学习计划版本不可原地覆盖。
- 证据记录不可被普通计划调整逻辑删除。
- 知识先修关系需要防环检查。
- 标签合并需保留 `canonical_tag_id` 或迁移映射。
- 竞赛日期需保存 `date_certainty`、来源 URL 和 `last_verified_at`。
- 外部链接失效不应删除历史记录，应更新 `link_status`。

---

# 8. API 与服务契约

## 8.1 API 通用规范

- 前缀：`/api`
- 请求/响应：JSON
- 数据校验：Pydantic
- 认证：由现有认证系统提供；若尚未接入，先实现服务端 Session/JWT 认证。
- 权限：统一依赖 `PermissionService`。
- 幂等：审核创建、任务状态更新等写接口支持 `Idempotency-Key`。
- 追踪：每个请求生成 `trace_id`。
- 分页：统一 `limit` + `cursor` 或 `page` + `page_size`，不要混用。

## 8.2 Agent API 返回统一封装

```json
{
  "request_id": "req_xxx",
  "agent": "search_agent",
  "status": "success",
  "data": {},
  "warnings": [],
  "trace_id": "trace_xxx"
}
```

状态：

- `success`
- `partial`
- `needs_user_input`
- `pending_review`
- `failed`
- `safe_fallback`

### 8.2.1 与前端契约的对齐（2026-11 补充，重要）

前端已有一层 Agent 契约预留：`src/services/agentContract.js` + `src/services/agentRuntime.js`。
**当前前端契约的形状与上表不同**，若后端照上表实现、前端不改，
接入时前端全部要返工。因此这里明确以哪边为准。

**结论：以本节的上表（envelope）为最终契约，前端按此调整。**

调整前后的差异：

| | 前端现状 | 本设计书最终契约 |
|---|---|---|
| 顶层字段 | `agentKey` / `status` / `handledByAgent` / `items` / `notes` / `suggestions` / `needsHumanReview` / `message` | `request_id` / `agent` / `status` / `data` / `warnings` / `trace_id` |
| 结果数据位置 | 平铺在顶层 | 收进 `data` |
| 状态取值 | 只有 `unavailable` | 6 种，见上表 |
| 降级表达 | 无 | `safe_fallback` |
| 追踪 | 无 | `trace_id` |

**为什么必须改 —— 一个具体的失效场景：**

§3.2 要求「审核不可用不能默认放行」，§9.4 的失败安全表规定
「LLM 不可用 → 审核 Agent 暂缓自动决策，转人工」。

前端若只有 `unavailable` 一个状态，就**无法区分下面两件事**：

| 实际发生的事 | 后端真实状态 | 用户应该看到 |
|---|---|---|
| 内容命中硬规则被拒 | `failed` / 拒绝 | 「你的内容违反 XX 规则，请修改后重新提交」 |
| 审核服务挂了，降级转人工 | `safe_fallback` | 「当前审核服务不可用，内容已暂缓，审核恢复后会通知你」 |

两者对用户的含义完全相反 —— 一个是「你违规了」，一个是「我们暂时没法审，稍后再看」。
前端若都渲染成「Agent 未接入」，就是在对用户说错话。
**这是安全降级能否落地的前提，不是接口洁癖。**

### 8.2.2 各 Agent 的 `data` 内容约定

`data` 的形状按 Agent 不同，但**顶层 envelope 完全一致** —— 这样前端可以写一套通用渲染逻辑。

**搜索 Agent：**

```json
{
  "data": {
    "interpreted_intent": { "topics": ["ESP32"], "intent_type": "learning_goal" },
    "groups": [
      {
        "resource_type": "platform_note",
        "items": [
          {
            "resource_id": "res_xxx",
            "title": "ESP32 入门笔记",
            "summary": "……",
            "difficulty": "beginner",
            "updated_at": "2026-10-01T10:00:00Z",
            "access_url": "/resources/res_xxx"
          }
        ]
      }
    ],
    "coverage": {
      "expected_types": ["platform_note", "project_case", "learning_group"],
      "found_types": ["platform_note", "project_case"],
      "missing_types": ["learning_group"]
    },
    "total": 2
  }
}
```

> **`coverage` 字段的作用**（对应产品设计书 §8.2.4「某一类资源缺失，应明确告知」）：
>
> 搜到 2 条笔记但一条小组都没搜到时，界面必须显示
> 「本次未找到学习小组类结果」，而不是让用户以为平台上就没有小组。
> `missing_types` 就是给这句话用的。
> 规划 Agent 同理 —— §6.8 的每个阶段都可能因缺资源而不完整，
> `coverage` 让「这个阶段缺什么」可以被结构化表达，而不是塞进一句自然语言。

**审核 Agent：**

```json
{
  "data": {
    "case_id": "mod_xxx",
    "decision": "REVIEW",
    "risk_categories": ["context_uncertain"],
    "risk_level": "medium",
    "evidence": [
      {
        "text_span": "……",
        "start_offset": 12,
        "end_offset": 20,
        "rule_category": "context_uncertain",
        "explanation": "……"
      }
    ],
    "uncertainty_reasons": ["上下文不足以判断是否为引用"],
    "rule_version": "R-02@v3",
    "model_version": "moderation-2026-11",
    "requires_human_review": true
  }
}
```

> **`data` 内的事实与判断是分开的**：
> `evidence` / `rule_version` / `model_version` 是**可核查的事实**，
> `explanation` / `uncertainty_reasons` 是**模型的主观判断**。
>
> 这个区分对 §5.7 的误判闭环至关重要：用户反馈「误判」时，
> 要能回答是**规则错了**（改规则）还是**判断错了**（调阈值/改 Prompt）——
> 两者的修法完全不同。若两者混在一段自然语言里，就无法做归因统计。
>
> 因此 `evidence` 的 `text_span` 必须由服务端校验确实存在于原文（§5.6 已要求）。

**学习规划 Agent：**

```json
{
  "data": {
    "plan_id": "plan_xxx",
    "goal_id": "goal_xxx",
    "version": 3,
    "status": "draft",
    "assumptions": [
      {
        "id": "a1",
        "text": "每周可投入时间暂按 6 小时估算",
        "based_on": "未填写，默认值",
        "editable": true,
        "affects": ["stage_01", "stage_02"]
      }
    ],
    "stages": [ /* 见 §6.8 */ ],
    "coverage": {
      "missing_resources": [
        { "stage_id": "stage_03", "reason": "平台暂未找到匹配资源" }
      ]
    }
  }
}
```

> **`assumptions` 必须是结构化对象，不能是字符串数组。**
>
> 原 §6.8 写的是 `"assumptions": ["每周可投入时间暂按 6 小时估算，等待用户确认"]`，
> 这样设计有个致命问题：产品设计书 §8.4.4 要求
> 「学生可修改目标、周期和可投入时间」，但假设若是纯字符串，
> 系统**不知道改哪一个假设会让哪些阶段失效**，只能全量重算计划 ——
> 既浪费算力，也让用户看到「我改了一个小时的时间，整个计划全变了」。
>
> 结构化后：改 `a1` → 精确定位 `affects: ["stage_01","stage_02"]` →
> 只重算受影响的阶段 → 并在响应里说明「因为每周时间从 6 小时改为 4 小时，
> 第一、二阶段的周任务量已下调」。
>
> 顺带解决一个产品问题：§8.4.4 特别强调
> 「不应把未完成任务简单归因于学生缺乏努力」。
> 计划挂在**可编辑的假设**上，学生改了假设，计划跟着变 ——
> 而不是学生「没努力」。这是结构化假设的额外收益。

### 8.2.3 契约迁移方式

前端 `agentContract.js` 的 `emptyAgentResponse()` 与 `buildAgentRequest()`
是唯一的前后端接触面。改动应**只发生在这一层**，上层组件（搜索浮层、
审核面板、规划页）不改。

`agentRuntime.js` 的 `runAgent()` 已经是唯一接入点，
接真实后端时替换其内部实现即可 —— 这正是当初预留的目的。

### 8.3 服务间调用规则

- 使用 Python 接口调用同一模块化单体中的领域服务。
- 不通过 HTTP 自己调用自己制造内部网络开销。
- 未来拆分服务时，再将领域服务接口替换成内部 HTTP/gRPC。
- Agent 不能绕过服务直接写表。
- 所有写操作必须校验调用用户、权限、资源状态和幂等键。

---

# 9. 安全、权限和可信性

## 9.1 权限过滤必须发生在后端

搜索、推荐、摘要、知识关系展开和学习计划生成都必须使用当前用户权限上下文。禁止先将所有资源交给 LLM，再让模型决定哪些内容可以展示。

## 9.2 Prompt Injection 防护

平台资源、论坛帖子、外部网页内容都属于不可信输入：

- 检索到的内容只能作为待分析数据，不能成为系统指令。
- 不允许资源正文覆盖系统 Prompt 或工具权限。
- 工具采用白名单。
- 模型输出必须经过 Pydantic 校验和业务校验。
- 资源摘要不能执行其中的命令或链接操作。
- 外部 URL 抓取需防 SSRF、内网地址访问和重定向绕过。

## 9.3 数据最小化

- 学习规划只收集完成规划需要的信息。
- 画像字段允许用户查看、更正和删除（受平台数据保留政策约束）。
- 个人联系方式默认不公开。
- 私有内容不进入公共 Embedding 检索集合，或必须使用严格的权限过滤和隔离策略。
- 审核人员只在处理案件所需范围内访问敏感内容。

## 9.4 失败安全策略

| 故障 | 搜索 Agent | 审核 Agent | 学习规划 Agent |
|---|---|---|---|
| LLM 不可用 | 退化为关键词/过滤搜索 | 暂缓自动决策，转人工 | 返回草案失败原因，可保存未完成状态 |
| 向量服务不可用 | 退化为 FTS | 不影响规则检测 | 资源匹配退化为关键词检索 |
| PostgreSQL 不可用 | 返回服务不可用 | 不允许确认发布 | 不允许保存计划 |
| 权限服务不可用 | 不返回资源 | 不自动放行 | 不展示资源和画像 |
| Checkpointer 不可用 | 简单搜索可绕过图 | 不适用 | 暂停可恢复工作流，不丢失已持久化业务数据 |

---

# 10. 可观测性与评估体系

## 10.1 每次 Agent 运行记录

- `agent_name`
- `agent_version`
- `prompt_version`
- `model_profile`
- `model_name`
- `request_id`
- `trace_id`
- `user_id`（日志中按隐私策略脱敏）
- 输入摘要/哈希
- 工具调用名称和耗时
- Token 数和成本
- 最终状态
- 错误码
- 输出校验结果
- 用户反馈（若有）

不建议默认长期保存所有原始私密输入；按业务需要设置脱敏、保留期限和访问控制。

## 10.2 业务指标

| Agent | 核心指标 | 必须监控的风险 |
|---|---|---|
| 搜索 | Recall@K、NDCG@K、MRR、点击率、无结果准确率 | 权限泄露、虚构资源、过期资源 |
| 审核 | Precision、Recall、FPR、FNR、人工推翻率 | 正常内容误杀、违规漏过、证据伪造 |
| 学习规划 | 资源有效率、计划可行性、目标覆盖率、任务完成率 | 无证据画像、虚构资源、不合理时间安排 |

## 10.3 用户反馈闭环

- 搜索结果：相关/不相关、资源失效、权限错误。
- 审核结果：误判、漏判、理由不清。
- 学习计划：太难、太简单、资源不适用、时间不合理。

反馈不能直接自动修改模型或本体。先进入评估数据集，经人工确认后再用于调整规则、Prompt、排序或本体关系。

### 10.3.1 三类反馈的归口不同（2026-11 补充）

原设计只列了反馈类型，但没说反馈**去哪里**。这一点必须定死，
否则反馈进了错的地方，就形成不了闭环 —— 比如误判反馈进了客服工单，
就永远看不到「这条规则的误判率在涨」。

| 来源 Agent | 反馈类型 | 归口 | 后续动作 |
|---|---|---|---|
| 搜索 | 相关/不相关 | 检索排序评估集 | 调整排序权重或 Query 改写 |
| 搜索 | 资源失效 | 内容维护（`link_status` 更新） | 转资源维护组核实 |
| 搜索 | 权限错误 | 安全事件 | 立即排查权限过滤，优先级最高 |
| 审核 | 误判（内容合规却被拦） | 审核规则误判计数 | 按规则归因：规则错 → 改规则；判断错 → 调阈值/Prompt |
| 审核 | 漏判（违规却放行） | 安全事件 + 规则缺口 | 补规则或提高该类优先级 |
| 审核 | 理由不清 | Prompt 优化 | 改进证据呈现方式 |
| 规划 | 太难/太简单 | 计划评估集 | 调整难度匹配与阶段切分 |
| 规划 | 资源不适用 | 资源维护 | 关联关系修正 |
| 规划 | 时间不合理 | 计划评估集 | 调整时间预算校验 |

**关键点**：审核的误判反馈必须能**归因到具体规则**，
所以反馈记录里要带 `rule_version` 和 `matched_rule_id`。
否则「误判率上升」这个指标无法定位到是哪条规则的问题。

### 10.3.2 `agent_feedback` 表结构

§7.1 只给了表名，这里补字段定义 —— 这张表是评估闭环的入口：

```text
id                    UUID PK
agent_name            VARCHAR        -- search / moderation / learning
run_id                UUID NULL      -- 关联 agent_runs.id
request_id            VARCHAR        -- 关联具体一次调用
user_id               UUID           -- 反馈提交者
target_type           VARCHAR        -- resource / case / plan / task
target_id             UUID
feedback_type         VARCHAR        -- 见 §10.3.1 的类型枚举
reason_code           VARCHAR        -- 结构化原因码
reason_text           TEXT NULL      -- 用户补充说明
matched_rule_id       VARCHAR NULL   -- 审核误判时必填，用于归因
rule_version          VARCHAR NULL
severity              VARCHAR        -- low / medium / high
status                VARCHAR        -- new / triaged / accepted / rejected / fixed
triaged_by            UUID NULL
triaged_at            TIMESTAMP NULL
resolution_note       TEXT NULL
created_at            TIMESTAMP
```

`status` 的流转：`new → triaged → accepted/rejected → fixed`。
只有 `accepted` 且已归因的反馈才进入评估数据集（§10.3 的最后一句）。

### 10.3.3 反馈入口的位置

反馈入口应**紧贴产生它的界面**，不要做成一个统一的「意见反馈」表单：

- 搜索结果每条 → 「不相关」「已失效」
- 审核结论处 → 「误判」「理由不清」（仅对被处置的作者可见）
- 计划阶段/任务处 → 「太难」「太简单」「时间不合理」
- 审核复核页 → 「这条应该放行」（管理员用）

产品设计书 §12.3 要求「提交者应能看到处理进度」——
反馈提交后要能看到状态（已收到 / 已受理 / 已修复），
这与 §7.5 的反馈 9 状态思路一致，可以复用同一套状态语义。

---

## 10.4 索引维护与资源失效检测（2026-11 补充）

§4.5 定义了检索流程，§7.2 定义了 `last_verified_at` / `link_status` 字段，
但**没有定义谁在什么时候维护它们**。检索索引如果不同步，
搜出来的会是过期内容 —— 而这恰恰是 §8.2.4 明确要求避免的
（「对已过期的竞赛信息、失效的链接或被下架的内容进行标记或排除」）。

### 10.4.1 索引同步

| 事件 | 动作 | 触发方式 |
|---|---|---|
| 资源创建/更新 | 重建该资源的 embedding 分片，更新 FTS 索引 | 写操作后异步任务 |
| 资源状态变为 `archived`/`removed`/`deleted` | 从检索索引移除 | 写操作后异步任务 |
| 资源可见范围变更 | 重建权限标记 | 写操作后异步任务 |
| 批量导入 | 全量重建 | 后台任务 |

**索引是派生结构，不是事实源**（§1.2 F 层已明确）。
所以允许索引短暂滞后，但**必须能检测到滞后**：
`resources.updated_at` 与 `resource_embedding_chunks.indexed_at` 的差值
应可被监控，超过阈值告警。

### 10.4.2 外部链接失效检测

`ExternalResource` 有 `link_status` 和 `last_verified_at`，但没人去更新。

需要一个周期性后台任务：
- 定期 HEAD/GET 外部链接，更新 `link_status`（`active` / `broken` / `redirected`）。
- **失效不删除记录**，只更新状态（§7.3 已明确）。
- 失效链接在搜索结果中要**标记**而非静默剔除 ——
  用户可能想找的是"这个教程虽然链接失效了但内容还在讨论里"。

§13.5 提到「链接检查」是引入 Celery 的时机之一，这个任务就是那个时机。

### 10.4.3 竞赛日期复核

竞赛条目有 `date_certainty` 和 `last_verified_at`（§2.5、§7.3）。
同样需要周期性复核，尤其是 `estimated_from_previous_year` 这一类 ——
按往年推算的日期到了本年必须重新核实，不能直接沿用。

---

## 10.5 通知投递（2026-11 补充）

三个 Agent 的产物都会产生「需要告知某人」的事件，但文档里没有通知机制：

| 事件 | 接收人 | 时机 |
|---|---|---|
| 审核 ALLOW / 自动放行 | 作者 | 发布成功 |
| 审核 REVIEW 转人工 | 教师/管理员审核员 | 进入队列时 |
| 审核 REJECT | 作者 | 拒绝时，附理由与申诉入口 |
| 审核被申诉 | 审核员 | 申诉提交时 |
| 计划草案生成 | 学生 | 生成完成待确认 |
| 计划调整 | 学生 | 调整完成，附「为什么调整」 |
| 推荐资源失效 | 学生 | 计划中引用的资源失效时 |
| 反馈状态变化 | 反馈提交者 | 受理/修复时（§12.3 状态可见） |

**关键约束**：通知内容必须与 Agent 结论**分离**。
Agent 可以生成摘要文案，但「你的内容被拒绝，理由是 XX」这句话里的
**事实部分（哪个规则、哪段证据、谁处理的）必须来自业务数据**，
不能由模型生成 —— 否则会出现通知里说的和实际处置不一致。

这与 §8.2 的「LLM 只能提供意图、扩展词和摘要草案」是同一条原则。

---

## 10.6 并发控制（2026-11 补充）

§7.3 说「学习计划版本不可原地覆盖」「审核案件绑定内容版本」，
但没定义并发场景下的行为。

### 10.6.1 计划版本并发

两个终端（手机 + 电脑）同时调整同一份计划时：

- `learning_plans` 加乐观锁字段 `lock_version`。
- 调整接口必须携带 `base_version`。
- 版本不匹配 → 返回 `409 CONFLICT`，并附当前版本供客户端比对。
- **不静默覆盖**。静默覆盖会让用户丢掉自己刚做的调整，
  且难以复现。

### 10.6.2 任务状态并发

同一个任务被重复标记完成（如用户点了两次、或客户端重试）：
- 任务状态更新接口要求 `Idempotency-Key`（§8.1 已要求）。
- 状态流转本身也要校验前置状态 ——
  从 `in_progress` 才能到 `completed`，不能从 `pending` 直接跳。

### 10.6.3 审核案件并发

同一内容被提交两次（如用户改了又改）：
- `ModerationCase` 绑定 `content_version`（§7.3 已要求）。
- 内容更新后，旧案件的裁决**不能自动应用到新版本**。
- 新版本需要新的审核案件，或显式触发重新审核。

---

# 11. 项目目录结构建议

采用模块化单体，建议：

```text
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   ├── logging.py
│   │   ├── llm_gateway.py
│   │   └── exceptions.py
│   │
│   ├── api/
│   │   ├── deps.py
│   │   └── v1/
│   │       ├── search.py
│   │       ├── moderation.py
│   │       └── learning.py
│   │
│   ├── domain/
│   │   ├── users/
│   │   ├── resources/
│   │   ├── permissions/
│   │   ├── ontology/
│   │   ├── knowledge/
│   │   ├── moderation/
│   │   └── learning/
│   │
│   ├── services/
│   │   ├── resource_search_service.py
│   │   ├── resource_service.py
│   │   ├── permission_service.py
│   │   ├── knowledge_service.py
│   │   ├── audit_service.py
│   │   └── llm_gateway.py
│   │
│   ├── agents/
│   │   ├── search/
│   │   │   ├── graph.py
│   │   │   ├── state.py
│   │   │   ├── schemas.py
│   │   │   ├── prompts.py
│   │   │   └── nodes.py
│   │   ├── moderation/
│   │   │   ├── pipeline.py
│   │   │   ├── schemas.py
│   │   │   ├── prompts.py
│   │   │   ├── rules.py
│   │   │   └── decision.py
│   │   └── learning/
│   │       ├── graph.py
│   │       ├── state.py
│   │       ├── schemas.py
│   │       ├── prompts.py
│   │       ├── nodes.py
│   │       └── validators.py
│   │
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── vector/
│   │   ├── embeddings/
│   │   ├── reranker/
│   │   ├── checkpointer/
│   │   └── tasks/
│   │
│   └── evaluation/
│       ├── search/
│       ├── moderation/
│       └── learning/
│
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── permission/
│   └── evaluation/
├── scripts/
├── pyproject.toml
└── README.md
```

---

# 12. 开发阶段与交付门槛

## Phase 0：数据与权限地基

交付：

- 用户/角色/权限模型。
- 资源统一主表和扩展表。
- 可见范围与使用许可分离。
- 标签、分类和知识概念初始词表。
- 审计事件模型。
- LLM Gateway。
- ResourceService、PermissionService。

验收：

- 私有资源不能被其他用户通过 API、搜索、摘要或关联关系访问。
- 每个资源有稳定 ID、作者、状态、可见范围。
- 不同资源类型可统一查询卡片。
- 关键状态变更可追溯。

**Phase 0 补充交付项（2026-11 补充，原清单遗漏）：**

- 角色模型定稿（见下方「角色模型定稿」）。
- 受控词表与前端 `src/data/dict.js` 对齐（§2.5、§16.3）。
- Agent 契约定稿并同步前端（§8.2.1、§16.2）。

### 角色模型定稿（2026-11 补充）

产品设计书 §3.1 定义了 7 个角色（访客/学生/学习小组创建者/教师/
学校内容管理员/平台管理员/超级管理员），但前端实现是
「3 个角色 + 2 个能力位」（`contentAdmin` / `canReview`）。
这两套必须在 Phase 0 定稿，不能带到后端。

**结论：采用「角色 + 能力位」模型，不是 7 个独立角色。**

| 产品设计书角色 | 落地方式 |
|---|---|
| 访客 | 独立身份（未登录态），不是角色，是 `user_id IS NULL` 的访问上下文 |
| 学生 | 基础角色 `student` |
| 学习小组创建者 | 能力位 `group_owner`（学生或教师创建小组后获得） |
| 教师 | 基础角色 `teacher` |
| 学校内容管理员 | 能力位 `content_admin`（教师或平台管理员被授予后获得） |
| 平台管理员 | 基础角色 `admin` |
| 超级管理员（可选） | 首期不做，等真有管理需求时再加 |

**为什么这样拆**：

1. 「学习小组创建者」和「学校内容管理员」描述的是**能力范围**而非身份 ——
   一个教师可以同时是小组创建者，也可以被授予校级内容管理。
   做成独立角色会导致「教师教师」「内容管理员内容管理员」这类组合爆炸。
2. 前端已有 `contentAdmin` / `canReview` 两个能力位且在用
   （教师登录页勾选两项），改造成本低。
3. §5.12 教师审核需要的第三个能力位 `reviewer`（审核职责）
   与 `canReview` 对应，同样走能力位。

**能力位清单（首期）：**

| 能力位 | 含义 | 来源 |
|---|---|---|
| `group_owner` | 管理自己创建的小组 | 创建小组时自动获得 |
| `content_admin` | 校级内容管理（产品设计书 §6.5） | 管理员授予 |
| `reviewer` | 内容审核职责（产品设计书 §6.4） | 管理员授予，需带范围 |
| `scope_grant` | 审核/管理的作用域（学科、内容类型、组） | 随 `reviewer` 授予 |

`reviewer` 必须与 `scope_grant` 绑定 —— 产品设计书 §6.4 说
「在授权范围内查看待审核队列」，没有范围的审核职责等于全站审核，
那就不是授权而是管理员。

**验收补充：**

- 同一账号可同时拥有多个能力位，且能力位之间互不隐含。
- 撤销能力位后，相关接口立即返回 403（不依赖前端隐藏）。
- 「学习小组创建者」不得被实现为独立角色。

## Phase 1：搜索 Agent 最小闭环

交付：

- PostgreSQL FTS。
- Embedding 与 pgvector。
- ResourceSearchService。
- 简单查询直通检索。
- 复杂查询 LangGraph 编排。
- 权限过滤、RRF、结果分组。
- 搜索评估集。

验收：

- 搜索结果全部对应真实资源 ID。
- Permission Violation Rate = 0。
- 简单查询不触发不必要的多轮 Agent Loop。
- 无结果时不编造内容。

## Phase 2：审核 Agent

交付：

- 审核案件与内容快照。
- 确定性规则引擎。
- LangChain 语义分析。
- ALLOW/REVIEW/REJECT 决策。
- 人工复核队列。
- 申诉和审计。
- 影子模式评估。

验收：

- 模型输出通过结构化 Schema。
- 模型证据必须能在原文定位。
- 模型/规则服务失败时不默认放行。
- Agent 无删除内容、封禁用户、修改规则权限。
- 人工复核能完整追溯原始版本和规则版本。

**Phase 2 补充交付项（2026-11 补充，原清单遗漏）：**

- 教师审核路径：5 种动作 + 授权范围过滤（§5.12）。
- `agent_feedback` 表与反馈归口（§10.3）。
- 审核结论与作者通知（§10.5）。
- 前端契约对齐（§8.2.1、§16.2）。

**Phase 2 补充验收项：**

- 教师审核队列只返回其授权范围内的案件（越权案件不出现在响应中，也不泄漏标题）。
- 教师不能通过审核接口修改规则、封禁账号或处置官方通知。
- 审核服务不可用时，接口返回 `safe_fallback` 而不是 `success`，
  且内容状态为 `pending`（暂缓），**不是** `published`。
- 作者收到的通知中的理由与审计记录一致。

## Phase 3：学习领域模型

交付：

- LearningProfile。
- LearningGoal。
- CapabilityEvidence。
- KnowledgeConcept、Skill。
- 先修关系维护与防环检查。
- Resource-Concept/Skill 关联。
- 学习任务和进度模型。

验收：

- 自述能力和任务验证能力区分。
- UNKNOWN 不会被自动改成掌握/未掌握。
- 先修关系无环。
- 学习计划关联资源均真实存在且有权限。

## Phase 4：学习规划 Agent

交付：

- LangGraph 规划工作流。
- 目标结构化。
- 能力差距分析。
- 知识路径拓扑排序。
- 资源匹配。
- 计划生成和校验。
- 用户确认保存。
- 计划版本和进度调整。

**Phase 4 补充交付项（2026-11 补充，原清单遗漏）：**

- 结构化 `assumptions` 与 `affects` 失效传播（§8.2.2）。
- `coverage.missing_resources` 的阶段级资源缺失表达（§8.2.2）。
- 计划调整的乐观锁与 409 冲突处理（§10.6.1）。
- 计划变更通知（§10.5）。

**Phase 4 补充验收项：**

- 修改一个假设只重算 `affects` 列出的阶段，其余阶段保持不变。
- 计划中引用的资源失效时，学生收到通知且该任务被标记为待重新匹配。
- 两个终端同时调整同一计划时，后提交方收到 409 而不是静默覆盖。

## Phase 5：系统联调与优化

交付：

- 三个 Agent 统一 API。
- 用户反馈入口。
- 运行监控和评估报表。
- 规则/Prompt/本体版本管理。
- 负载、延迟和成本测试。
- 索引同步任务与外部链接失效检测（§10.4）。
- 反馈评估集的定期回流（§10.3.2）。

验收：

- 端到端权限测试通过。
- 核心工作流可恢复。
- 关键决策可审计。
- 三个 Agent 的业务状态互不污染。

---

# 13. 关键技术选型说明

## 13.1 LangChain

用于模型调用、Prompt、结构化输出、工具封装、模型切换和中间件。三个 Agent 可以共用 LangChain 的模型接入层。

审核 Agent 首期使用 LangChain 的结构化调用即可，不需要为了“Agent”这个名字强行建立自主工具循环。

## 13.2 LangGraph

用于有明确状态、多步骤分支、重试、持久化和人工介入的工作流：

- 搜索：只为复杂自然语言查询启用。
- 学习规划：作为核心工作流运行时。
- 审核：首期不需要自定义复杂图；若未来出现长时间人工等待、跨阶段复核、可恢复审批链，再考虑 LangGraph 或专门工作流引擎。

## 13.3 LlamaIndex

不是首期必选。只有当外部资料导入、文件解析、复杂分块、索引流水线和多数据源连接明显变复杂时，再评估引入。不要同时让 LlamaIndex 和 LangGraph 承担同一套流程编排。

## 13.4 PostgreSQL + pgvector

首期足够承担：

- 业务事实数据。
- 关系型领域模型。
- 全文检索。
- 向量检索。
- 知识节点/边关系。
- 审核、学习计划和审计数据。

当图查询复杂度和规模真实成为瓶颈，再评估独立图数据库。不要为了“本体”一词过早增加数据库运维成本。

## 13.5 Redis / Celery

Redis 可用于缓存、限流、任务队列或分布式锁；Celery 在出现持续后台任务、批量 Embedding、链接检查、长时间文件处理时再引入。第一阶段不要为了技术完整性而提前部署。

---

# 14. 需要明确的设计决策与风险

| 风险 | 常见错误设计 | 本方案控制方式 |
|---|---|---|
| 搜索泄露私密资源 | 检索后只在前端隐藏 | 检索前后都执行后端权限过滤 |
| LLM 编造资源 | 让模型直接输出标题和 URL | 资源 ID/字段由数据库填充 |
| 审核误杀 | 模型输出 reject 就拒绝发布 | 硬规则与语义风险分离；不确定进入人工复核 |
| 规则失控 | 模型自行扩充违禁范围 | 规则由管理员维护并版本化 |
| 学习画像失真 | 从聊天推断掌握程度 | 证据类型和来源分层 |
| 学习计划不可执行 | 只生成漂亮的长计划 | 任务完成标准、时间预算、确定性校验 |
| 知识图谱失真 | 模型生成边后直接入库 | 候选关系审核、来源记录、防环检查 |
| Agent 耦合 | 一个 Agent 调另一个完整 Agent | 共享领域服务，不共享内部状态 |
| 技术栈过重 | 同时上多个图数据库/编排器 | 模块化单体、PostgreSQL 起步 |
| 附件审核夸大 | 未解析附件却显示已审核 | 明确标识实际检查范围 |
| **降级被当成拒绝**（2026-11 补充） | 服务不可用时前端只显示「Agent 未接入」 | 契约区分 `failed` 与 `safe_fallback`，作者与审核员看到的文案不同（§8.2.1） |
| **教师越权处理**（2026-11 补充） | 教师审核接口不校验授权范围 | 授权范围在后端强制；队列过滤在服务端（§5.12） |
| **反馈进错地方**（2026-11 补充） | 所有反馈进一个通用工单列表 | 按来源归口，误判反馈带规则版本以支持归因（§10.3.1） |
| **索引与事实不一致**（2026-11 补充） | 内容更新后检索索引仍是旧的 | 写后异步重建 + 滞后可监控（§10.4.1） |
| **并发覆盖用户操作**（2026-11 补充） | 后保存的计划静默覆盖先保存的 | 乐观锁 + 409 冲突，不静默覆盖（§10.6.1） |
| **通知与处置不一致**（2026-11 补充） | 通知文案由模型自由生成 | 通知事实部分来自业务数据，模型只写摘要（§10.5） |
| **前后端词表漂移**（2026-11 补充） | 两边各定义一套状态枚举 | `npm run check:vocab` 自动比对（§2.5、§16.3） |

---

# 15. 最终落地建议

## 15.1 先完成的最小可运行版本（MVP）

不要一开始追求三个 Agent 都“很智能”。第一版只要求完成以下闭环：

### 搜索 Agent MVP

用户输入自然语言 → 意图结构化 → FTS + 向量检索 → 权限过滤 → 排序 → 返回真实资源卡片。

### 审核 Agent MVP

用户提交文本 → 确定性规则 → LangChain 语义风险分析 → ALLOW/REVIEW/REJECT → 人工复核/作者修改 → 审计记录。

### 学习规划 Agent MVP

用户设定目标 → 读取画像 → 标记未知能力 → 查询知识先修关系 → 匹配真实资源 → 生成任务计划 → 确定性校验 → 用户确认保存 → 任务进度更新。

## 15.2 不要首期建设的东西

- 不要建设一个总控 Agent 再把三个 Agent 作为子 Agent。
- 不要把所有用户聊天记录直接放入长期记忆。
- 不要让三个 Agent 共享一份无限制的 Memory。
- 不要让 LLM 直接访问数据库或任意 Python 工具。
- 不要让模型自动修改平台权限、审核规则或本体正式关系。
- 不要一开始部署独立图数据库、Temporal、复杂消息总线和微服务集群。
- 不要把每次简单搜索都交给 LangGraph。
- 不要把学习计划生成等同于学习效果验证。

## 15.3 推荐实施顺序

**权限与资源模型 → 共享检索服务 → 搜索 Agent → 审核 Agent → 知识/能力本体 → 学习画像 → 学习规划 Agent → 评估与持续优化。**

这样可以先让平台的资源被发现、内容被安全治理，再让学习规划使用已经存在且可检索的资源。学习规划 Agent 不应建立在一个尚无可靠资源数据的空平台上。

## 15.4 最终架构判断

三个 Agent 应是三个独立的业务智能系统，而不是三个互相管理的机器人：

- 搜索 Agent 是“资源发现与检索决策系统”。
- 审核 Agent 是“受规则约束的内容风险决策系统”。
- 学习规划 Agent 是“基于学习者状态与知识依赖的持续规划系统”。

三者共享统一领域本体和领域服务，但拥有各自独立的工作流状态、输入输出契约、权限范围和评估指标。

**真正决定系统质量的不是 Agent 数量，也不是 LangGraph 节点数量，而是资源数据是否可信、权限是否严谨、知识关系是否可靠、用户能力是否有证据、工作流是否可恢复，以及每个结果是否能被验证。**

---

# 16. 与现有前端的衔接（2026-11 补充）

本设计书描述的是后端目标架构。但项目当前形态是**纯前端原型**：
无后端、无数据库、无真实登录，数据层是静态演示数据 + 内存 store。
本节说明二者如何衔接，避免后端落地时前端大改。

## 16.1 前后端职责边界

| | 当前前端 | 后端落地后 |
|---|---|---|
| 数据来源 | `import { notes } from '../data/pages.js'` | API 调用 |
| 权限判定 | 前端 `canAccess()` 拦截路由 | **后端 `PermissionService` 强制** |
| 登录态 | `localStorage` 存角色 | 服务端 Session/JWT |
| 搜索 | `useSearch.js` 本地扫静态数据 | `ResourceSearchService` |
| 内容状态 | `stores/demo.js` 内存 | PostgreSQL |
| 审计 | `stores/admin.js` 内存 | `audit_events` 表 |

> **最重要的一条**：现在的 `canAccess()` 只是前端路由拦截，
> 越权访问会被弹回首页 —— 但**这不是安全机制**，只是体验机制。
> 后端落地后，`PermissionService` 才是唯一的权限判定点，
> 前端的 `canAccess()` 降级为「界面上的入口显隐」。
>
> §9.1 要求的「禁止先将所有资源交给 LLM，再让模型决定哪些内容可以展示」
> 在后端落地前**无法真正保证** —— 因为前端根本没有服务端。
> 这是 Phase 0 存在的意义。

## 16.2 前端 Agent 契约的调整清单

`src/services/agentContract.js` 与 `src/services/agentRuntime.js`
是前后端唯一的接触面。按 §8.2.1 的最终契约，需要改的只有这两个文件，
上层组件（搜索浮层、审核面板、规划页）不动。

具体改动：

1. `emptyAgentResponse()` 的形状改为 envelope 形状：
   `{ request_id, agent, status, data, warnings, trace_id }`。
2. `status` 取值补齐为 6 种：
   `success` / `partial` / `needs_user_input` / `pending_review` / `failed` / `safe_fallback`。
3. 原顶层字段（`items` / `notes` / `suggestions` / `needsHumanReview`）
   移入 `data` 的对应 Agent 专属结构（§8.2.2）。
4. `buildAgentRequest()` 中的 `context` 改为**由后端注入**：
   前端不再传 `role` / `visibleScope` —— 按 §9.1，前端传入的角色不可信。
   当前代码里的 `role: 'student'` 是占位，接后端时移除。
5. `runAgent()` 内部替换为真实 HTTP 调用，保留 `status` 状态机
   （`idle` / `loading` / `ready` / `error`）供界面显示。

**不需要改的**：搜索结果浮层的渲染、审核处置面板、规划页的展示逻辑 ——
它们只消费 `data` 里的内容，不关心 envelope。

## 16.3 词表一致性检查

§2.5 的受控词表与前端 `src/data/dict.js` 必须一致。
`scripts/check-vocab.mjs` 会逐项比对并在不一致时报错，
可接入 CI 或构建流程，避免两边各改各的。

当前已核对出并已在 §2.5 修正的差异：
`content_status`（`pending`/`review`/`removed`）、`visibility`（`members`）、
`evidence_type`（6 种，以本表为准）。

## 16.4 与管理员端已实现能力的衔接

前端管理员端已实现统一动作层 `src/stores/admin.js` 的 `applyAdminAction()`：
所有高影响操作强制填写理由、自动写审计记录。

这个模式与 §5.7 的「模型分析结果与内容状态流转必须分开」是同一个思路：
**决策与执行分离，执行留痕。**

后端落地时，管理员端的高影响操作（封禁、规则修改、通知撤回）
应改为调用后端接口，后端复用同一套审计模型。
前端的 `applyAdminAction` 可作为交互参考，但**不能作为安全边界**。

§5.10 要求的审计字段（`case_id` / `rule_version` / `model_version` /
`prompt_version` / 内容哈希）比当前前端的审计记录更细，
后端实现时补齐即可，前端结构不用大改。
