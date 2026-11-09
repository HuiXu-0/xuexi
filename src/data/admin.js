/**
 * 管理员端的模块结构。
 *
 * 设计书 §4.3 定义了 9 个模块：
 *   1 管理工作台　2 账号与权限管理　3 内容与举报管理
 *   4 官方首页内容管理　5 反馈与创新建议管理　6 审核规则管理
 *   7 Agent 管理　8 操作审计记录　9 平台基础配置
 *
 * §7.1：事项应显示类型、严重程度、提交时间、当前负责人和处理状态。
 * §7.2.2：涉及角色变化、内容删除恢复、封禁解封、规则更新的操作都要留痕。
 */

export const adminModules = [
  {
    key: 'dashboard',
    icon: 'i-grid',
    title: '管理工作台',
    desc: '聚合待处理事项：审核异常、举报、授权争议、反馈建议、申诉、失效链接与公告维护提醒。',
    actions: ['筛选', '分配负责人', '批量处理低风险重复事项'],
  },
  {
    key: 'accounts',
    icon: 'i-users',
    title: '账号与权限管理',
    desc: '查看账号基础信息与授权范围，分配或撤销角色权限，限制功能、封禁与解封，并处理申诉。',
    actions: ['搜索账号', '分配角色', '限制功能', '查看违规记录'],
  },
  {
    key: 'reports',
    icon: 'i-bellring',
    title: '内容与举报管理',
    desc: '处理笔记、案例、帖子、资源与竞赛信息的举报，核实后给出处理结果与理由。',
    actions: ['查看上下文', '临时隐藏', '通知当事人', '允许申诉'],
  },
  {
    key: 'notices',
    icon: 'i-bell',
    title: '官方首页内容管理',
    desc: '由获授权的内容管理员维护官方通知：创建、编辑、设定有效期、发布、撤回与归档。',
    actions: ['创建通知', '设置有效期', '撤回归档'],
  },
  {
    key: 'feedback',
    icon: 'i-send',
    title: '反馈与创新建议管理',
    desc: '分配 Bug 与功能建议的负责人，追踪状态，记录验证结果并回复提交者。',
    actions: ['分配负责人', '更新状态', '回复提交者'],
  },
  {
    key: 'rules',
    icon: 'i-shield',
    title: '审核规则管理',
    desc: '维护违禁词、辱骂骚扰、垃圾广告、恶意链接、隐私泄露与侵权风险规则，可回滚不合理变更。',
    actions: ['新增规则', '停用规则', '查看命中与误判', '回滚变更'],
  },
  {
    key: 'agents',
    icon: 'i-spark',
    title: 'Agent 管理',
    desc: '仅涉及产品层面的开关与治理：启用状态、适用范围、阈值配置、运行状态与结果抽查。',
    actions: ['启用/停用', '设置适用范围', '抽查结果', '记录配置变化'],
  },
  {
    key: 'audit',
    icon: 'i-file',
    title: '操作审计记录',
    desc: '记录角色变化、内容删除恢复、封禁解封、规则更新等操作的操作者、时间、对象、原因与结果。',
    actions: ['按类型筛选', '按操作者筛选', '关联案件编号'],
  },
  {
    key: 'config',
    icon: 'i-grid',
    title: '平台基础配置',
    desc: '维护资源类别、技术方向标签、竞赛类型、问题状态与用户可见的社区规则说明。',
    actions: ['维护分类', '合并同义标签', '停用分类并迁移'],
  },
]

/** §7.1 工作台事项的严重程度 */
export const severityLevels = {
  low: { label: '低', tone: 'gray', desc: '可批量处理的重复事项。' },
  medium: { label: '中', tone: 'amber', desc: '需要人工判断，但影响有限。' },
  high: { label: '高', tone: 'red', desc: '影响他人权益或平台公信力，需优先处理。' },
}

/** §7.2.1 处罚层级建议 */
export const punishmentLevels = [
  { key: 'remind', label: '提醒', desc: '提示内容存在问题，不影响后续使用。' },
  { key: 'revise', label: '要求修改内容', desc: '需按说明修改后重新提交。' },
  { key: 'restrict', label: '限制发布', desc: '在指定模块内暂时不能发布内容。' },
  { key: 'mute', label: '暂时禁言', desc: '暂时不能发帖与回复。' },
  { key: 'ban', label: '暂时封禁', desc: '暂时不能登录与使用平台。' },
  { key: 'permanent', label: '长期封禁', desc: '严重情形下长期封禁，需记录理由并支持申诉。' },
]

/** 操作审计的类型（§7.2.2） */
export const auditTypes = {
  role: '角色变更',
  content: '内容删除 / 恢复',
  account: '封禁 / 解封',
  rule: '规则更新',
  agent: 'Agent 配置变化',
  publish: '内容发布',
}

/** 审计记录示例 */
export const auditRecords = [
  {
    id: 'AUD-018',
    type: 'content',
    operator: '管理员演示账号',
    target: '学习笔记「Python 入门：从基础语法到小项目」',
    action: '删除并归档',
    reason: '内容与已有笔记重复，且来源标注不完整。',
    result: '已下架，保留归档记录',
    at: '2026-11-04 14:22',
    caseNo: 'DEMO-003',
  },
  {
    id: 'AUD-017',
    type: 'role',
    operator: '管理员演示账号',
    target: '教师演示账号',
    action: '授予「校级内容管理」授权',
    reason: '经教务处确认的临时授权，负责本学期公告维护。',
    result: '授权生效，已通知本人',
    at: '2026-11-03 09:40',
    caseNo: '',
  },
  {
    id: 'AUD-016',
    type: 'rule',
    operator: '管理员演示账号',
    target: '垃圾广告识别规则 v3',
    action: '停用',
    reason: '近期误判反馈集中，技术讨论被误识别为推广。',
    result: '已回滚到 v2，规则更新需观察误判变化',
    at: '2026-11-02 16:05',
    caseNo: '',
  },
  {
    id: 'AUD-015',
    type: 'agent',
    operator: '管理员演示账号',
    target: '内容审核 Agent',
    action: '临时改为全部人工复核',
    reason: '误判反馈显著增加，按规则暂停自动拦截。',
    result: '自动拦截已暂停',
    at: '2026-11-01 11:18',
    caseNo: '',
  },
]

/** 工作台待办事项（§7.1 的字段：类型 / 严重程度 / 提交时间 / 负责人 / 状态） */
export const adminWorkItems = [
  {
    id: 'W-101',
    type: '内容审核异常',
    severity: 'high',
    title: '优秀案例：共同作者授权争议',
    desc: '案例申请公开团队作品，但一名成员未确认授权。',
    submittedAt: '2026-11-04 10:12',
    owner: '待分配',
    state: 'pending',
  },
  {
    id: 'W-102',
    type: '用户举报',
    severity: 'medium',
    title: '论坛帖子：内容举报',
    desc: '举报人认为帖子含不实信息，需要结合上下文核实。',
    submittedAt: '2026-11-04 09:30',
    owner: '管理员演示账号',
    state: 'reviewing',
  },
  {
    id: 'W-103',
    type: 'Bug 反馈',
    severity: 'low',
    title: '移动端底部导航在部分机型被安全区遮挡',
    desc: '提交者提供了机型与系统版本，尚未复现。',
    submittedAt: '2026-11-03 21:45',
    owner: '待分配',
    state: 'pending',
  },
  {
    id: 'W-104',
    type: '失效链接',
    severity: 'medium',
    title: '外部学习资源：来源链接失效',
    desc: '资源条目指向的教程页已无法访问，需核实并替换。',
    submittedAt: '2026-11-03 15:20',
    owner: '资源维护组',
    state: 'reviewing',
  },
  {
    id: 'W-105',
    type: '封禁申诉',
    severity: 'high',
    title: '账号限制申诉：用户认为处罚过重',
    desc: '用户提交申诉，说明其内容属于教学分析引用。',
    submittedAt: '2026-11-02 19:08',
    owner: '待分配',
    state: 'pending',
  },
  {
    id: 'W-106',
    type: '公告维护提醒',
    severity: 'low',
    title: '官方通知有效期临近',
    desc: '一条校级通知即将到期，需确认是否延期或归档。',
    submittedAt: '2026-11-02 08:00',
    owner: '内容管理员',
    state: 'pending',
  },
]

/** 事项处理状态 */
export const workItemStates = {
  pending: { label: '待处理', tone: 'amber' },
  reviewing: { label: '处理中', tone: 'blue' },
  done: { label: '已处理', tone: 'green' },
}
