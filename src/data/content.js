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
  /* 学习规划是高频功能，此前只能从个人中心二级进入，这里提到主导航 */
  { nav: 'planner', label: '学习规划', route: 'planner' },
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

/**
 * 首页顶部公告条。
 * 此前只有一条公告、一行字，占满整行却承载不了实际信息；
 * 现在支持多条轮播，桌面端可手动切换，移动端自动轮播。
 *
 * 设计书 §5.1.2 A 官方通知区要求每条通知至少展示：
 *   标题、发布单位/发布人、发布时间、有效期（如适用）、重要程度、正文入口
 * 规则：置顶与重要标记仅由有权限的人员设置；过期通知退出主要展示区；
 *       已撤回或被更正的显示合理状态。
 */
export const siteNotices = [
  {
    id: 'notice-1',
    tag: '演示公告',
    title: '校园学习平台试运行说明（示例公告）',
    note: '平台示例数据',
    detail: '本页内容用于演示交互与信息结构，正式上线前会替换为学校已核实的公告。',
    issuer: '平台运营组（示例）',
    publishedAt: '2026-11-01',
    validUntil: '长期有效',
    importance: '普通',
    state: 'active',
    pinned: false,
    category: 'platform',
  },
  {
    id: 'notice-2',
    tag: '资源更新',
    title: '本周新增 3 组嵌入式实践笔记与 2 份竞赛复盘（示例）',
    note: '内容示例',
    detail: '示例条目来自演示数据，用于展示通知条在多公告情况下的呈现方式。',
    issuer: '学习资源维护组（示例）',
    publishedAt: '2026-11-04',
    validUntil: '2026-11-30',
    importance: '普通',
    state: 'active',
    pinned: false,
    category: 'resource',
  },
  {
    id: 'notice-3',
    tag: '重要通知',
    title: '关于 2026 年秋季学期竞赛信息核实的说明（示例）',
    note: '示例公告',
    detail:
      '部分竞赛条目的报名时间仍以主办方发布为准。请在使用前点击来源链接核对；已过有效期的条目会退出主要展示区域。',
    issuer: '教务处（示例）',
    publishedAt: '2026-10-20',
    validUntil: '2026-12-31',
    importance: '重要',
    state: 'active',
    pinned: true,
    category: 'official',
  },
  {
    id: 'notice-4',
    tag: '已更正',
    title: '上条通知的报名截止日期已更正（示例）',
    note: '示例公告',
    detail: '原通知中的截止日期有误，现已更正并标注更正时间，请以最新版本为准。',
    issuer: '教务处（示例）',
    publishedAt: '2026-10-18',
    validUntil: '已过期',
    importance: '普通',
    state: 'corrected',
    pinned: false,
    category: 'official',
  },
  {
    id: 'notice-5',
    tag: '已过期',
    title: '2026 年暑期实践活动说明（示例）',
    note: '示例公告',
    detail: '该活动已结束，按规则退出主要展示区域，但仍可在历史公告中查看。',
    issuer: '团委（示例）',
    publishedAt: '2026-07-02',
    validUntil: '2026-09-01',
    importance: '普通',
    state: 'expired',
    pinned: false,
    category: 'official',
  },
]

/**
 * 通知状态语义（设计书 §11.1 的状态体系在通知场景的映射）。
 * 已撤回 / 已更正的公告要显示合理状态，避免用户继续依据错误信息行动。
 */
export const noticeStates = {
  active: { label: '有效', tone: 'green', desc: '通知当前有效，展示在主要区域。' },
  corrected: { label: '已更正', tone: 'amber', desc: '内容已被更正，请以最新版本为准。' },
  withdrawn: { label: '已撤回', tone: 'amber', desc: '通知已被撤回，不应再据此行动。' },
  expired: { label: '已过期', tone: 'gray', desc: '已过有效期，退出主要展示区域。' },
}
