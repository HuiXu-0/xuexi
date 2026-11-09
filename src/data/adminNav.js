/**
 * 管理员端 9 个模块的导航定义。
 *
 * 设计书 §4.3 定义了管理员端主导航的 9 个模块。
 * 每个模块现在有独立路由，key 用于界面高亮，route 用于跳转。
 *
 * 单独成文件的原因：路由定义（src/router/index.js）、权限白名单
 * （src/stores/auth.js）、导航（src/data/dict.js）三处都要引用同一份清单，
 * 放在这里避免各写一套导致不一致。
 */
export const adminNav = [
  {
    key: 'dashboard',
    route: 'admin',
    icon: 'i-grid',
    title: '管理工作台',
    short: '工作台',
    desc: '聚合待处理事项：审核异常、举报、授权争议、反馈建议、申诉、失效链接与公告维护提醒。',
    actions: ['筛选', '分配负责人', '批量处理低风险重复事项'],
  },
  {
    key: 'accounts',
    route: 'adminAccounts',
    icon: 'i-users',
    title: '账号与权限管理',
    short: '账号权限',
    desc: '查看账号基础信息与授权范围，分配或撤销角色权限，限制功能、封禁与解封，并处理申诉。',
    actions: ['搜索账号', '分配角色', '限制功能', '查看违规记录'],
  },
  {
    key: 'reports',
    route: 'adminReports',
    icon: 'i-bellring',
    title: '内容与举报管理',
    short: '举报处置',
    desc: '处理笔记、案例、帖子、资源与竞赛信息的举报，核实后给出处理结果与理由。',
    actions: ['查看上下文', '临时隐藏', '通知当事人', '允许申诉'],
  },
  {
    key: 'notices',
    route: 'adminNotices',
    icon: 'i-bell',
    title: '官方通知管理',
    short: '官方通知',
    desc: '维护全站官方通知：创建、编辑、设定有效期、发布、撤回、归档与更正，并保留变更记录。',
    actions: ['创建通知', '设置有效期', '撤回归档', '发布更正'],
  },
  {
    key: 'feedback',
    route: 'adminFeedback',
    icon: 'i-send',
    title: '反馈与建议管理',
    short: '反馈建议',
    desc: '分配 Bug 与功能建议的负责人，追踪状态，记录验证结果并回复提交者。',
    actions: ['分配负责人', '更新状态', '回复提交者'],
  },
  {
    key: 'rules',
    route: 'adminRules',
    icon: 'i-shield',
    title: '审核规则管理',
    short: '审核规则',
    desc: '维护违禁词、辱骂骚扰、垃圾广告、恶意链接、隐私泄露与侵权风险规则，可回滚不合理变更。',
    actions: ['新增规则', '停用规则', '查看命中与误判', '回滚变更'],
  },
  {
    key: 'agents',
    route: 'adminAgents',
    icon: 'i-spark',
    title: 'Agent 管理',
    short: 'Agent 管理',
    desc: '仅涉及产品层面的开关与治理：启用状态、适用范围、阈值配置、运行状态与结果抽查。',
    actions: ['启用/停用', '设置适用范围', '抽查结果', '记录配置变化'],
  },
  {
    key: 'audit',
    route: 'adminAudit',
    icon: 'i-file',
    title: '操作审计记录',
    short: '操作审计',
    desc: '记录角色变化、内容删除恢复、封禁解封、规则更新等操作的操作者、时间、对象、原因与结果。',
    actions: ['按类型筛选', '按操作者筛选', '关联案件编号'],
  },
  {
    key: 'config',
    route: 'adminConfig',
    icon: 'i-grid',
    title: '平台基础配置',
    short: '基础配置',
    desc: '维护资源类别、技术方向标签、竞赛类型、问题状态与用户可见的社区规则说明。',
    actions: ['维护分类', '合并同义标签', '停用分类并迁移'],
  },
]
