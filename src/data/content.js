/**
 * 静态演示内容。
 * 首页的竞赛 / 学习发现 / 小组区块，以及各子页的卡片与列表，
 * 都由这些数据驱动，配合 v-for 渲染。
 */

export const typeLabels = {
  note: '学习笔记',
  case: '优秀案例',
  resource: '资源导航',
  competition: '竞赛信息',
  group: '学习小组',
  post: '学习讨论',
}

/* 首页：近期竞赛与活动 */
export const homeCompetitions = [
  {
    id: 'competition-1',
    icon: 'i-spark',
    category: '人工智能方向',
    status: '信息待核实',
    title: '人工智能应用方向赛事',
    desc: '面向希望将算法、模型或应用想法转化为实践项目的学生。具体赛事与报名安排需以主办方发布为准。',
    metas: [
      ['i-calendar', '日期待官方核实'],
      ['i-users', '参赛条件待确认'],
    ],
    sourceNote: '示例条目 · 官方来源待录入',
    keywords: '人工智能 应用 竞赛 项目 算法',
  },
  {
    id: 'competition-2',
    icon: 'i-circuit',
    category: '智能硬件与嵌入式',
    status: '往届参考',
    title: '智能硬件与嵌入式实践赛',
    desc: '适合关注硬件、嵌入式开发与原型验证的学生。当前卡片为方向示例，不代表实际赛事安排。',
    metas: [
      ['i-calendar', '往届时间待整理'],
      ['i-file', '规则待核验'],
    ],
    sourceNote: '示例条目 · 非官方日程',
    keywords: '智能硬件 嵌入式 ESP32 电子设计 竞赛 实践',
  },
  {
    id: 'competition-3',
    icon: 'i-book',
    category: '程序设计方向',
    status: '信息待核实',
    title: '程序设计能力挑战',
    desc: '围绕编程基础、算法思维与问题求解能力的赛事方向示例。参赛资格和具体时间需补充可靠来源。',
    metas: [
      ['i-calendar', '报名时间待核实'],
      ['i-users', '个人/团队待确认'],
    ],
    sourceNote: '示例条目 · 需补官方链接',
    keywords: '程序设计 Python 算法 编程 团队赛 竞赛',
  },
]

/* 首页：学习发现 */
export const homeDiscover = [
  {
    id: 'note-1',
    coverClass: 'cover-note',
    coverIcon: 'i-file',
    coverLabel: '学习笔记',
    type: 'note',
    filterType: 'note',
    typeLabel: '学习笔记',
    demoLabel: '演示内容',
    title: 'Python 入门：从基础语法到小项目',
    desc: '用阶段化的方式整理基础语法、常见练习和动手实践的学习顺序。',
    tags: ['编程基础', '入门', 'Python'],
    authorAvatar: '学',
    authorName: '学生示例作者',
    ctaLabel: '查看笔记',
    keywords: 'Python 入门 语法 编程 基础 学习路线',
  },
  {
    id: 'case-1',
    coverClass: 'cover-case',
    coverIcon: 'i-circuit',
    coverLabel: '实践案例',
    type: 'case',
    filterType: 'case',
    typeLabel: '优秀案例',
    demoLabel: '演示内容',
    title: '从想法到原型：智能硬件项目实践复盘',
    desc: '展示项目目标、实现思路、遇到的困难与复盘经验；公开内容范围应由作者确认。',
    tags: ['智能硬件', '项目实战', '复盘'],
    authorAvatar: '项',
    authorName: '项目团队示例',
    ctaLabel: '查看案例',
    keywords: '智能硬件 项目实践 复盘 ESP32 原型 电路 实践成果',
  },
  {
    id: 'resource-1',
    coverClass: 'cover-resource',
    coverIcon: 'i-lightbulb',
    coverLabel: '资源导航',
    type: 'resource',
    filterType: 'resource',
    typeLabel: '外部学习资源',
    demoLabel: '链接待接入',
    title: '从零学硬件：基础知识与实践方向',
    desc: '按电路基础、开发工具、嵌入式入门和小项目实践整理学习方向，不复制第三方完整内容。',
    tags: ['嵌入式', '学习路径', '实践'],
    authorAvatar: '资',
    authorName: '平台整理示例',
    ctaLabel: '查看资源',
    keywords: '从零学硬件 嵌入式 电路 单片机 资源导航 教程 外部资源',
  },
]

export const discoverFilters = [
  { value: 'all', label: '全部内容' },
  { value: 'note', label: '学习笔记' },
  { value: 'case', label: '优秀案例' },
  { value: 'resource', label: '资源导航' },
]

/* 首页：学习小组动态 */
export const homeActivities = [
  {
    icon: 'i-message',
    style: '',
    title: '从点亮 LED 开始：项目第一步怎么做？',
    meta: '嵌入式实践学习小组 · 问题求助',
    tag: '讨论状态：示例内容',
    keywords: '点亮 LED 开发板 嵌入式 初学者 问题求助',
  },
  {
    icon: 'i-book',
    style: 'color:var(--amber);background:var(--amber-soft)',
    title: '如何把 Python 基础练习变成一个小项目？',
    meta: '编程基础共学小组 · 经验交流',
    tag: '讨论状态：示例内容',
    keywords: 'Python 入门 学习计划 经验交流 编程基础',
  },
  {
    icon: 'i-spark',
    style: 'color:var(--green);background:var(--surface-tint)',
    title: '项目结束后，哪些经验值得留下来？',
    meta: '项目实践交流 · 普通讨论',
    tag: '讨论状态：示例内容',
    keywords: '项目复盘 记录 文档 实践经验 分享',
  },
]

/* 顶部导航 */
export const navItems = [
  { nav: 'home', label: '首页', route: 'home' },
  { nav: 'forum', label: '学习论坛', route: 'forum' },
  { nav: 'notes', label: '学习笔记', route: 'notes' },
  { nav: 'competitions', label: '竞赛资源', route: 'competitions' },
  { nav: 'resources', label: '资源导航', route: 'resources' },
  { nav: 'cases', label: '优秀案例', route: 'cases' },
]

export const heroSuggestions = [
  { query: '从零学硬件' },
  { query: 'Python 入门' },
  { query: '人工智能竞赛' },
]

/* 页脚链接 */
export const footerLinks = [
  { modal: 'rules', label: '内容与授权规则' },
  { modal: 'privacy', label: '隐私说明' },
  { modal: 'bug', label: 'Bug 反馈' },
  { modal: 'suggestion', label: '功能建议' },
]

/* 通知浮层 */
export const notifications = [
  {
    title: '欢迎使用首页预览',
    text: '这里只展示产品功能示例，不含真实账号消息。',
  },
  {
    title: '授权与内容提醒',
    text: '公开展示内容前，请确认可见范围及使用许可。',
  },
]
