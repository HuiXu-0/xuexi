/**
 * 子页内容数据（学习论坛 / 学习笔记 / 竞赛资源 / 资源导航 / 优秀案例 / 教师工作台 / 管理员控制台）。
 */

/* ---------- 学习论坛 ---------- */
export const forumGroupFilters = [
  { value: 'all', label: '全部小组' },
  { value: 'student', label: '学生创建' },
  { value: 'teacher', label: '教师创建' },
]

export const forumGroups = [
  {
    id: 'group-1',
    origin: 'student',
    originLabel: '学生创建',
    originClass: 'green',
    visibility: '公开组',
    demoLabel: '演示内容',
    title: '嵌入式实践学习小组',
    desc: '从基础电路、开发板入门到小型原型项目，围绕阶段目标分享资源与实践经验。',
    tags: ['嵌入式', 'ESP32', '项目实战'],
    metas: ['成员数量待接入', '讨论示例 3 条'],
    detailItem: 'group-1',
    detailLabel: '查看小组',
    joinLabel: '加入小组',
    joinMode: '',
    keywords: '嵌入式实践学习小组 ESP32 硬件 初学者 项目 学生创建',
  },
  {
    id: 'group-2',
    origin: 'student',
    originLabel: '学生创建',
    originClass: 'green',
    visibility: '申请加入',
    demoLabel: '演示内容',
    title: '编程基础共学小组',
    desc: '通过基础练习、小项目拆解和同伴复盘，形成可坚持的编程学习节奏。',
    tags: ['Python', '算法', '入门'],
    metas: ['成员数量待接入', '学习目标：持续练习'],
    detailItem: null,
    detailLabel: '查看详情',
    joinLabel: '申请加入',
    joinMode: '申请',
    keywords: '编程基础共学小组 Python 算法 编程 入门 学生创建',
  },
  {
    id: 'group-3',
    origin: 'teacher',
    originLabel: '教师创建',
    originClass: 'blue',
    visibility: '校内可见',
    demoLabel: '演示内容',
    title: '项目实践交流',
    desc: '围绕需求分析、技术选型、工程实现和项目复盘分享实践经验。实际加入规则由教师设置。',
    tags: ['工程实践', '复盘', '项目文档'],
    metas: ['指导教师待确认', '讨论状态待接入'],
    detailItem: null,
    detailLabel: '查看详情',
    joinLabel: '进入小组',
    joinMode: '',
    keywords: '项目实践交流 教师指导 复盘 文档 项目方法 教师创建',
  },
]

export const forumRules = [
  '提问尽量描述目标、环境和已尝试的方法。',
  '分享外部资源时保留原始来源。',
  '尊重作者的内容授权与隐私设置。',
  '小组管理权限仅限于对应小组。',
]

export const forumPostsSeed = [
  {
    id: 'post-a',
    icon: 'i-message',
    title: '从点亮 LED 开始：项目第一步怎么做？',
    desc: '想开始嵌入式实践，如何选择入门板、搭建开发环境并验证第一个输出？',
    group: '嵌入式实践学习小组',
    kind: '问题求助',
    status: '待回答',
    statusClass: 'amber',
    keywords: '点亮 LED 开发板 嵌入式 初学者 项目第一步',
  },
  {
    id: 'post-b',
    icon: 'i-book',
    title: '如何把 Python 基础练习变成一个小项目？',
    desc: '从语法练习走向实践时，怎样控制项目范围并把过程整理成可复用的笔记？',
    group: '编程基础共学小组',
    kind: '经验交流',
    status: '讨论中',
    statusClass: 'blue',
    keywords: 'Python 基础练习 小项目 编程入门 经验交流',
  },
  {
    id: 'post-c',
    icon: 'i-spark',
    title: '项目结束后，哪些经验值得留下来？',
    desc: '讨论如何记录失败尝试、架构取舍与可验证成果，帮助后来者少走弯路。',
    group: '项目实践交流',
    kind: '普通讨论',
    status: '已解决',
    statusClass: 'green',
    keywords: '项目结束 复盘 文档 实践经验 分享',
  },
]

/* ---------- 学习笔记 ---------- */
export const noteFilters = [
  { value: 'all', label: '全部笔记' },
  { value: 'programming', label: '编程基础' },
  { value: 'hardware', label: '硬件与嵌入式' },
  { value: 'practice', label: '项目复盘' },
]

export const notes = [
  {
    id: 'note-a',
    category: 'programming',
    badges: [['blue', '学习笔记'], [null, '适合入门']],
    demoLabel: '演示内容',
    title: 'Python 入门：从基础语法到小项目',
    desc: '用阶段化方式整理基础语法、常见练习和动手实践顺序。',
    tags: ['Python', '编程基础', '入门'],
    metas: ['作者：学生示例作者', '更新时间：待接入'],
    detailItem: 'note-1',
    keywords: 'Python 入门 语法 编程 基础 学习路线',
  },
  {
    id: 'note-b',
    category: 'hardware',
    badges: [['blue', '实验记录'], [null, '实践方向']],
    demoLabel: '演示内容',
    title: 'ESP32 开发环境与外设调试记录',
    desc: '记录开发环境准备、串口日志、外设验证与常见问题排查的整理思路。',
    tags: ['ESP32', '嵌入式', '调试'],
    metas: ['作者：示例作者', '原始来源：待确认'],
    detailItem: null,
    keywords: 'ESP32 嵌入式 开发板 外设 调试 实验记录',
  },
  {
    id: 'note-c',
    category: 'practice',
    badges: [['green', '项目复盘']],
    demoLabel: '演示内容',
    title: '项目复盘：如何记录技术取舍与失败尝试',
    desc: '把目标、约束、方案对比、验证结果和后续问题整理成可复用的实践记录。',
    tags: ['工程实践', '文档', '复盘'],
    metas: ['作者：示例作者', '引用：待补充'],
    detailItem: null,
    keywords: '项目复盘 实验记录 技术选型 失败经验 文档',
  },
]

/* ---------- 竞赛资源 ---------- */
export const competitionFilters = [
  { value: 'all', label: '全部方向' },
  { value: 'ai', label: '人工智能' },
  { value: 'hardware', label: '智能硬件' },
  { value: 'programming', label: '程序设计' },
]

export const competitionStatusOptions = [
  { value: 'all', label: '全部信息状态' },
  { value: 'verify', label: '信息待核实' },
  { value: 'history', label: '往届参考' },
]

export const competitionYearOptions = [
  { value: '2026', label: '2026 年' },
  { value: '2025', label: '2025 年（历史）' },
]

export const competitionTimeline = [
  {
    id: 'comp-a',
    icon: 'i-spark',
    category: 'ai',
    status: 'verify',
    statusLabel: '待核实',
    statusClass: 'amber',
    title: '人工智能应用方向赛事',
    desc: '关注算法、模型应用与实践项目。主办方、参赛条件和报名安排尚待官方核实。',
    meta: '月份：待核实 · 官方链接待录入 · 最后核实时间待录入',
    keywords: '人工智能 应用 算法 模型 竞赛',
    /* 设计书 §5.4.3：竞赛卡片需要来源、日期、状态与最后核实时间 */
    source: '主办方官网（待录入）',
    sourceUrl: '',
    dateRange: '日期待官方公布',
    lastVerified: '尚未核实',
    registerState: '报名信息待核实',
  },
  {
    id: 'comp-b',
    icon: 'i-circuit',
    category: 'hardware',
    status: 'history',
    statusLabel: '往届参考',
    statusClass: 'blue',
    title: '智能硬件与嵌入式实践赛事方向',
    desc: '适合关注硬件、嵌入式开发与原型验证的学生，当前仅展示方向与备赛内容。',
    meta: '时间：往届资料待整理 · 官方规则待核验',
    keywords: '智能硬件 嵌入式 电子设计 ESP32 竞赛',
    source: '往届主办方公告（示例）',
    sourceUrl: '',
    dateRange: '往届时间参考',
    lastVerified: '2026-10-15',
    registerState: '往届赛事，不接受报名',
  },
  {
    id: 'comp-c',
    icon: 'i-book',
    category: 'programming',
    status: 'verify',
    statusLabel: '待核实',
    statusClass: 'amber',
    title: '程序设计能力挑战',
    desc: '围绕编程基础、算法思维与问题求解能力的赛事方向，具体赛项和资格待确认。',
    meta: '报名时间待核实 · 个人/团队形式待确认',
    keywords: '程序设计 编程 算法 Python 团队 竞赛',
    source: '主办方官网（待录入）',
    sourceUrl: '',
    dateRange: '日期待官方公布',
    lastVerified: '尚未核实',
    registerState: '报名方式待确认',
  },
]

export const competitionChecklist = [
  { icon: 'i-calendar', title: '时间来源', desc: '区分官方公布日期、预计时间与往届参考。' },
  { icon: 'i-external', title: '官方报名入口', desc: '优先查看主办方发布的规则与入口。' },
  { icon: 'i-book', title: '相关学习内容', desc: '关联站内笔记、外部资源、学习小组和往届案例。' },
]

/* ---------- 资源导航 ---------- */
export const resourceFilters = [
  { value: 'all', label: '全部方向' },
  { value: 'programming', label: '编程基础' },
  { value: 'ai', label: '人工智能' },
  { value: 'hardware', label: '嵌入式与硬件' },
  { value: 'math', label: '数学基础' },
]

export const resources = [
  {
    id: 'res-a',
    category: 'programming',
    badges: [[null, '编程基础'], ['green', '文档/教程']],
    title: 'Python 学习资源入口',
    desc: '整理 Python 基础语法、标准库和入门实践的资源方向。正式条目需填写并核实具体原始链接。',
    metas: ['来源链接：待录入', '作者/机构：待确认'],
    footBadge: ['amber', '链接待核实'],
    detailItem: 'resource-1',
    keywords: 'Python 入门 官方文档 编程基础 教程',
  },
  {
    id: 'res-b',
    category: 'ai',
    badges: [[null, '人工智能'], ['green', '教程/工具']],
    title: '机器学习与人工智能资源集合',
    desc: '围绕数学基础、模型概念、数据集和实践环境整理外部学习入口。',
    metas: ['原始链接：待录入', '最近核实：待接入'],
    footBadge: ['amber', '示例条目'],
    detailItem: null,
    keywords: '机器学习 人工智能 数据集 教程 模型',
  },
  {
    id: 'res-c',
    category: 'hardware',
    badges: [[null, '嵌入式与硬件'], ['green', '文档/仓库']],
    title: '从零学硬件：基础知识与实践方向',
    desc: '按电路基础、开发工具、嵌入式入门和小项目实践整理学习路径。',
    metas: ['来源链接：待录入', '适合基础：入门'],
    footBadge: ['amber', '链接待核实'],
    detailItem: 'resource-1',
    keywords: 'ESP32 嵌入式 单片机 硬件 电路 开发工具',
  },
  {
    id: 'res-d',
    category: 'math',
    badges: [[null, '数学基础'], ['green', '课程/讲义']],
    title: '数学基础学习入口',
    desc: '按线性代数、概率论、统计学和优化基础整理可公开学习资源。',
    metas: ['原始链接：待录入', '授权信息：待核实'],
    footBadge: ['amber', '示例条目'],
    detailItem: null,
    keywords: '线性代数 概率论 数学基础 人工智能',
  },
]

/* ---------- 优秀案例 ---------- */
export const caseFilters = [
  { value: 'all', label: '全部案例' },
  { value: 'hardware', label: '智能硬件' },
  { value: 'ai', label: '人工智能' },
  { value: 'software', label: '软件项目' },
]

export const cases = [
  {
    id: 'case-a',
    category: 'hardware',
    badges: [['green', '智能硬件'], [null, '作者确认范围']],
    demoLabel: '演示内容',
    title: '从想法到原型：智能硬件项目实践复盘',
    desc: '展示项目目标、实现思路、关键难点和实践复盘。源代码、设计文件及详细原理默认不自动公开。',
    tags: ['ESP32', '原型设计', '项目复盘'],
    metas: ['团队：需由作者确认', '获奖信息：未提供'],
    detailItem: 'case-1',
    footBadge: ['amber', '示例案例'],
    keywords: '智能硬件 项目原型 ESP32 电路 实践复盘',
  },
  {
    id: 'case-b',
    category: 'ai',
    badges: [['green', '人工智能']],
    demoLabel: '演示内容',
    title: '面向真实问题的 AI 应用实践',
    desc: '介绍问题背景、数据来源、方案评估与结果验证。实际发布需由作者确认内容和展示权限。',
    tags: ['AI 应用', '模型评估', '工程实践'],
    metas: ['作者：待确认', '公开范围：待确认'],
    detailItem: null,
    footBadge: ['amber', '示例案例'],
    keywords: '人工智能 应用 项目 模型 实践 数据分析',
  },
  {
    id: 'case-c',
    category: 'software',
    badges: [['green', '软件项目']],
    demoLabel: '演示内容',
    title: '从需求到交付：软件项目协作记录',
    desc: '展示需求拆解、迭代管理、测试验收和项目复盘，重点呈现可复用经验而非只展示结果图。',
    tags: ['软件工程', '协作', '交付'],
    metas: ['贡献者：需获同意后展示', '附件：默认隐藏'],
    detailItem: null,
    footBadge: ['amber', '示例案例'],
    keywords: '软件工程 网站 项目 协作 需求分析 实现复盘',
  },
]

/* ---------- 教师工作台 ---------- */
export const teacherManagedGroups = [
  { icon: 'i-users', title: '项目实践交流', desc: '维护活动安排、问题求助和有价值的复盘讨论。', meta: '演示小组 · 真实成员数据待接入' },
  { icon: 'i-book', title: '课程学习答疑', desc: '组织问题讨论并将有效答案关联至学习内容。', meta: '演示小组 · 授权范围待配置' },
]

/*
 * Agent 定义元信息（设计书 §8）。
 * 三个 Agent 的职责与边界原文来自设计书，界面各处共用这一份。
 */
export const agentDefinitions = [
  {
    key: 'search',
    icon: 'i-search',
    title: '全局搜索与发现 Agent',
    desc: '理解自然语言目标，组织来自平台真实条目的搜索结果。不得生成不存在的资源或泄露私密内容。',
  },
  {
    key: 'moderation',
    icon: 'i-shield',
    title: '内容审核 Agent',
    desc: '对首批文字字段进行初筛，提供放行、人工复核或拒绝建议；高影响处罚由有权限的管理员决定。',
  },
  {
    key: 'planner',
    icon: 'i-spark',
    title: '个人学习规划 Agent',
    desc: '按学生目标、基础和时间组织阶段计划，并关联真实且可访问的站内资源。',
  },
]

/* ---------- 个人学习规划 ---------- */
export const plannerLevels = ['零基础', '有基础，缺少实践', '已完成一些项目']

export const plannerHours = [
  { value: 3, label: '约 3 小时' },
  { value: 5, label: '约 5 小时' },
  { value: 8, label: '约 8 小时' },
  { value: 12, label: '约 12 小时' },
]

export const plannerDurations = [
  { value: 4, label: '4 周' },
  { value: 8, label: '8 周' },
  { value: 12, label: '12 周' },
]

export const plannerPrinciples = [
  { icon: 'i-target', title: '目标分阶段', desc: '每个阶段有知识点、任务和可观察产出。' },
  { icon: 'i-book', title: '关联真实资源', desc: '只推荐平台中真实存在且当前用户有权访问的内容。' },
  { icon: 'i-calendar', title: '允许回顾调整', desc: '用户可以修改目标、周期和每周时间安排。' },
]

export const profileRoles = [
  { route: 'teacher', icon: 'i-book', title: '教师工作台', desc: '学习小组、案例推荐、被分配审核任务。' },
  { route: 'admin', icon: 'i-shield', title: '管理员端', desc: '账号、举报、反馈、规则和 Agent 管理。' },
  { route: 'planner', icon: 'i-spark', title: '学习规划 Agent', desc: '按目标和基础生成可修改的阶段计划示例。' },
]

export const profileContentLinks = [
  { route: 'notes', icon: 'i-file', title: '我的笔记', desc: '管理草稿、已发布内容和版本信息。' },
  { route: 'cases', icon: 'i-trophy', title: '我的案例', desc: '管理项目说明、附件和授权范围。' },
  { route: 'forum', icon: 'i-users', title: '我的论坛 / 小组', desc: '查看创建或加入的小组与讨论。' },
]
