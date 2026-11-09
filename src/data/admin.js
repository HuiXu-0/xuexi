/**
 * 管理员端数据层（设计书 §7）。
 *
 * 与教师端的数据**完全分开**：
 *   教师端的官方通知走 `data/teacher.js` + `stores/teacher.js`，
 *   管理员端的官方通知走本文件 + `stores/admin.js`。
 * 两侧的管理范围、权限与审计口径都不同，混在一起会导致
 * 「教师改了管理员的记录」这类越权问题。
 */

/* ---------- ① 工作台事项的严重程度（§7.1） ---------- */
export const severityLevels = {
  low: { label: '低', tone: 'gray', desc: '可批量处理的重复事项。' },
  medium: { label: '中', tone: 'amber', desc: '需要人工判断，但影响有限。' },
  high: { label: '高', tone: 'red', desc: '影响他人权益或平台公信力，需优先处理。' },
}

/** 事项处理状态 */
export const workItemStates = {
  pending: { label: '待处理', tone: 'amber', desc: '已登记，等待分配与核实。' },
  reviewing: { label: '处理中', tone: 'blue', desc: '正在核实材料。' },
  done: { label: '已处理', tone: 'green', desc: '已完成处置并记录了原因与处理人。' },
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
  feedback: '反馈处理',
  work: '事项处置',
  config: '平台配置',
}

/** 审计记录示例（演示基线；本次会话的新记录由 stores/admin.js 追加） */
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
    state: 'pending',
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
    state: 'pending',
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

/* ---------- ② 账号与权限（§7.2） ---------- */
export const accountSeeds = [
  {
    id: 'ACC-001',
    name: '学生演示账号',
    role: '学生',
    scope: '仅本人内容',
    status: 'normal',
    violations: 0,
    registeredAt: '2026-09-12',
  },
  {
    id: 'ACC-002',
    name: '教师演示账号',
    role: '教师',
    scope: '本人小组 + 被分配审核事项',
    status: 'normal',
    violations: 1,
    registeredAt: '2026-09-08',
  },
  {
    id: 'ACC-003',
    name: '受限账号演示',
    role: '学生',
    scope: '禁止发布（限制发布）',
    status: 'restricted',
    violations: 2,
    registeredAt: '2026-10-02',
  },
  {
    id: 'ACC-004',
    name: '封禁账号演示',
    role: '学生',
    scope: '无法登录',
    status: 'banned',
    violations: 3,
    registeredAt: '2026-09-20',
  },
  {
    id: 'ACC-005',
    name: '申诉中账号演示',
    role: '学生',
    scope: '限制发布（申诉受理中）',
    status: 'appealing',
    violations: 2,
    registeredAt: '2026-09-28',
  },
]

/** 账号状态定义 */
export const accountStates = {
  normal: { label: '正常', tone: 'green', desc: '可正常使用全部已授权功能。' },
  restricted: { label: '限制中', tone: 'amber', desc: '部分功能受限，登录正常。' },
  appealing: { label: '申诉中', tone: 'blue', desc: '已提交申诉，等待管理员受理。' },
  banned: { label: '已封禁', tone: 'red', desc: '暂时无法登录与使用平台。' },
}

/* ---------- ③ 内容与举报（§7.3） ---------- */
/** 举报处置流程状态 */
export const reportFlow = {
  submitted: { label: '已提交', tone: 'gray', desc: '举报已送达，等待管理员确认受理。' },
  accepted: { label: '已受理', tone: 'amber', desc: '已确认受理，正在核实材料。' },
  hidden: { label: '临时隐藏', tone: 'blue', desc: '争议期间内容暂时下线，当事人已收到通知。' },
  resolved: { label: '已处理', tone: 'green', desc: '已给出处理结果与理由，当事人可申诉。' },
  dismissed: { label: '不成立', tone: 'gray', desc: '核实后举报不成立，已说明理由。' },
  appealed: { label: '申诉中', tone: 'blue', desc: '当事人对处理结果提出申诉，等待复核。' },
  closed: { label: '已结案', tone: 'green', desc: '申诉复核完成，处理结果生效。' },
}

export const reportFlowOrder = [
  'submitted',
  'accepted',
  'hidden',
  'resolved',
  'dismissed',
  'appealed',
  'closed',
]

export function reportMeta(key) {
  return reportFlow[key] || reportFlow.submitted
}

/** 举报案件种子 */
export const reportSeeds = [
  {
    id: 'RP-201',
    contentType: '优秀案例',
    title: '优秀案例：共同作者授权争议',
    desc: '案例申请公开团队作品，但一名成员未确认授权。',
    reporter: '项目组匿名成员',
    submittedAt: '2026-11-04 10:12',
    severity: 'high',
    state: 'accepted',
  },
  {
    id: 'RP-202',
    contentType: '论坛帖子',
    title: '论坛帖子：内容举报',
    desc: '举报人认为帖子含不实信息，需要结合上下文核实。',
    reporter: '李同学',
    submittedAt: '2026-11-04 09:30',
    severity: 'medium',
    state: 'submitted',
  },
  {
    id: 'RP-203',
    contentType: '学习笔记',
    title: '学习笔记：疑似搬运他人实验记录',
    desc: '笔记结构与来源站高度相似，缺少来源标注。',
    reporter: '王同学',
    submittedAt: '2026-11-03 17:05',
    severity: 'medium',
    state: 'hidden',
  },
  {
    id: 'RP-204',
    contentType: '资源导航条目',
    title: '资源导航：外部教程链接失效',
    desc: '资源条目指向的教程页已无法访问。',
    reporter: '系统巡检',
    submittedAt: '2026-11-03 15:20',
    severity: 'low',
    state: 'resolved',
  },
  {
    id: 'RP-205',
    contentType: '竞赛信息',
    title: '竞赛信息：报名截止日期有误',
    desc: '公示的截止日期与主办方通知不一致。',
    reporter: '张同学',
    submittedAt: '2026-11-02 19:08',
    severity: 'low',
    state: 'appealed',
  },
]

/* ---------- ④ 官方通知（管理员端独立实现，§7.4） ---------- */
/**
 * 管理员端官方通知种子数据。
 * 与教师端 `data/teacher.js` 的 officialNotices 是两套独立数据，
 * 因为管理员端负责的是全站级别的正式通知，
 * 权限范围、审计要求和撤回规则都更严格。
 */
export const adminNoticeSeeds = [
  {
    id: 'NT-2026-0031',
    title: '关于开展本学期实践项目申报的通知',
    body: '各学院：本学期实践项目申报自即日起开放，截止 11 月 25 日 18:00。请指导教师组织学生提交项目简介与成果说明。',
    publisher: '教务处',
    scope: 'campus',
    importance: 'high',
    pinned: true,
    state: 'published',
    publishedAt: '2026-11-08',
    expireAt: '2026-11-25',
  },
  {
    id: 'NT-2026-0028',
    title: '实验室开放时间调整',
    body: '自 11 月 10 日起，电子实验楼 B 区开放时间调整为 8:00-21:00，需预约使用。',
    publisher: '实验教学中心',
    scope: 'campus',
    importance: 'normal',
    pinned: false,
    state: 'published',
    publishedAt: '2026-11-05',
    expireAt: '2026-12-31',
  },
  {
    id: 'NT-2026-0026',
    title: '竞赛资源条目补充说明',
    body: '此前发布的竞赛条目已补充报名截止时间，请以最新条目为准。',
    publisher: '教务处',
    scope: 'campus',
    importance: 'normal',
    pinned: false,
    state: 'corrected',
    corrected: true,
    publishedAt: '2026-10-28',
    expireAt: '',
  },
  {
    id: 'NT-2026-0020',
    title: '寒假开放借阅安排（已过期）',
    body: '寒假期间图书馆开放借阅时间安排。',
    publisher: '图书馆',
    scope: 'campus',
    importance: 'normal',
    pinned: false,
    state: 'expired',
    publishedAt: '2026-10-10',
    expireAt: '2026-10-31',
  },
  {
    id: 'NT-2026-0033',
    title: '学生创新创业训练计划说明',
    body: '草稿：拟说明训练计划的项目类型、周期与结题要求，待补充附件说明。',
    publisher: '创新创业学院',
    scope: 'campus',
    importance: 'normal',
    pinned: false,
    state: 'draft',
    publishedAt: '',
    expireAt: '',
  },
]

/** 管理员端通知状态 */
export const adminNoticeStates = {
  draft: { label: '草稿', tone: 'gray', desc: '尚未发布，仅管理员可见。' },
  published: { label: '已发布', tone: 'green', desc: '正在首页通知区展示。' },
  corrected: { label: '已更正', tone: 'amber', desc: '已发布且发生过重要更正，界面会显示更正说明。' },
  withdrawn: { label: '已撤回', tone: 'amber', desc: '内容暂时下线，撤回原因会公示。' },
  expired: { label: '已过期', tone: 'gray', desc: '超过有效期，自动退出展示但保留可查。' },
  archived: { label: '已归档', tone: 'gray', desc: '历史内容，保留可查但不参与推荐。' },
}

export function adminNoticeMeta(key) {
  return adminNoticeStates[key] || adminNoticeStates.draft
}

/* ---------- ⑤ 反馈与创新建议（§7.5） ---------- */
/**
 * 反馈 9 状态。
 * 设计书 §12.3 要求「提交者能看到处理进度」，
 * 所以状态不能只有「待处理 / 已处理」两档。
 */
export const feedbackStates = {
  submitted: { label: '已提交', tone: 'gray', desc: '反馈已送达，等待分配负责人。' },
  assigned: { label: '已分配', tone: 'blue', desc: '已确定负责人，进入处理流程。' },
  reproducing: { label: '复现中', tone: 'blue', desc: '正在复现问题或评估需求可行性。' },
  planned: { label: '已排期', tone: 'amber', desc: '已确认有效并进入版本计划。' },
  inProgress: { label: '开发中', tone: 'amber', desc: '正在实现，尚未发布。' },
  testing: { label: '测试中', tone: 'amber', desc: '实现完成，进入验证阶段。' },
  resolved: { label: '已解决', tone: 'green', desc: '问题已修复或需求已实现。' },
  rejected: { label: '不采纳', tone: 'gray', desc: '经评估暂不处理，已说明原因。' },
  closed: { label: '已关闭', tone: 'gray', desc: '流程结束，提交者可重新开启。' },
}

export const feedbackStateOrder = [
  'submitted',
  'assigned',
  'reproducing',
  'planned',
  'inProgress',
  'testing',
  'resolved',
  'rejected',
  'closed',
]

export function feedbackMeta(key) {
  return feedbackStates[key] || feedbackStates.submitted
}

export const feedbackSeeds = [
  {
    id: 'FB-301',
    kind: 'bug',
    title: '移动端底部导航在部分机型被安全区遮挡',
    desc: '在 iPhone 14 上底部标签栏被 Home 指示条压住，点击最右侧标签困难。',
    submitter: '李同学',
    submittedAt: '2026-11-03 21:45',
    severity: 'medium',
    state: 'reproducing',
    owner: '资源维护组',
  },
  {
    id: 'FB-302',
    kind: 'bug',
    title: '小组置顶通知发布后未出现在讨论区顶部',
    desc: '发布成功后刷新页面才可见，怀疑是缓存问题。',
    submitter: '王同学',
    submittedAt: '2026-11-02 14:20',
    severity: 'low',
    state: 'resolved',
    owner: '资源维护组',
  },
  {
    id: 'FB-303',
    kind: 'suggestion',
    title: '建议：竞赛条目增加「报名截止」提醒',
    desc: '希望临近截止时在竞赛资源页顶部提醒，避免错过报名。',
    submitter: '张同学',
    submittedAt: '2026-10-29 11:08',
    severity: 'low',
    state: 'planned',
    owner: '内容管理员',
  },
  {
    id: 'FB-304',
    kind: 'suggestion',
    title: '建议：学习笔记支持按标签导出目录',
    desc: '期末整理笔记时希望按标签生成可打印目录。',
    submitter: '陈同学',
    submittedAt: '2026-10-26 19:33',
    severity: 'low',
    state: 'submitted',
    owner: '',
  },
  {
    id: 'FB-305',
    kind: 'bug',
    title: '案例授权确认页在窄屏下按钮被遮挡',
    desc: '780px 宽度以下，底部「确认授权范围」按钮显示不全。',
    submitter: '赵同学',
    submittedAt: '2026-10-21 08:52',
    severity: 'high',
    state: 'testing',
    owner: '资源维护组',
  },
]

/* ---------- ⑥ 审核规则（§7.6） ---------- */
export const ruleSeeds = [
  {
    id: 'R-01',
    name: '垃圾广告与刷屏',
    type: '确定性规则',
    scope: '笔记 / 帖子 / 资源简介',
    hits: 42,
    falsePositives: 3,
    state: 'active',
    version: 'v3',
  },
  {
    id: 'R-02',
    name: '辱骂与人身攻击',
    type: '需上下文判断',
    scope: '全部文字字段',
    hits: 18,
    falsePositives: 7,
    state: 'active',
    version: 'v2',
  },
  {
    id: 'R-03',
    name: '恶意链接与诈骗诱导',
    type: '确定性规则',
    scope: '帖子 / 资源链接',
    hits: 11,
    falsePositives: 1,
    state: 'active',
    version: 'v2',
  },
  {
    id: 'R-04',
    name: '隐私信息泄露',
    type: '需上下文判断',
    scope: '头像名称 / 个人简介',
    hits: 5,
    falsePositives: 2,
    state: 'active',
    version: 'v1',
  },
  {
    id: 'R-05',
    name: '侵权与未经授权转载',
    type: '需人工核实',
    scope: '优秀案例 / 附件',
    hits: 3,
    falsePositives: 0,
    state: 'draft',
    version: 'v1',
  },
]

export const ruleStates = {
  active: { label: '启用', tone: 'green', desc: '规则参与自动审核。' },
  draft: { label: '草稿', tone: 'gray', desc: '规则已配置但未启用，不参与审核。' },
  disabled: { label: '已停用', tone: 'amber', desc: '规则停用，历史命中记录保留。' },
}

export function ruleMeta(key) {
  return ruleStates[key] || ruleStates.draft
}

/* ---------- ⑨ 平台基础配置（§7.8） ---------- */
export const configSeeds = [
  {
    id: 'C-01',
    name: '编程基础',
    kind: '资源类别',
    state: 'active',
    note: '含 Python / JavaScript 等子方向',
    migration: '',
  },
  {
    id: 'C-02',
    name: '嵌入式与硬件',
    kind: '资源类别',
    state: 'active',
    note: 'ESP32 / 单片机 / EDA 等',
    migration: '',
  },
  {
    id: 'C-03',
    name: '入门',
    kind: '学习阶段标签',
    state: 'active',
    note: '适用于零基础学习者',
    migration: '',
  },
  {
    id: 'C-04',
    name: '零基础',
    kind: '学习阶段标签',
    state: 'pendingMerge',
    note: '与「入门」语义重复',
    migration: '将迁移到「入门」，既有内容数量 34 条',
  },
  {
    id: 'C-05',
    name: '学科竞赛',
    kind: '竞赛类型',
    state: 'active',
    note: '与「个人赛」「团队赛」是不同维度，不可合并',
    migration: '',
  },
]

export const configStates = {
  active: { label: '启用', tone: 'green', desc: '该分类当前对外可见。' },
  pendingMerge: { label: '待合并', tone: 'amber', desc: '确认迁移方式后生效，迁移前不丢内容。' },
  disabled: { label: '已停用', tone: 'gray', desc: '不再对外展示，既有内容已按迁移策略处理。' },
}

export function configMeta(key) {
  return configStates[key] || configStates.active
}

/* ---------- ⑦ Agent 管理（§7.7） ---------- */
/**
 * Agent 治理配置。
 * 设计书 §8 的硬约束：Agent 不能自行修改权限、绕过审核规则或取得管理员角色，
 * 所以这里只有产品层面的开关与阈值，不涉及给 Agent 授权。
 */
export const agentConfigSeeds = [
  {
    key: 'search',
    title: '搜索 Agent',
    scope: '全站检索与推荐',
    threshold: 0.62,
    enabled: true,
    note: '置信度低于阈值时回退到关键词检索，不做二次生成。',
  },
  {
    key: 'moderation',
    title: '内容审核 Agent',
    scope: '笔记 / 帖子 / 案例 / 资源简介',
    threshold: 0.78,
    enabled: true,
    note: '低于阈值一律转人工复核，Agent 不做最终处置。',
  },
  {
    key: 'planner',
    title: '学习规划 Agent',
    scope: '个人学习计划生成',
    threshold: 0.55,
    enabled: true,
    note: '规划结果仅作建议，最终计划由学生确认。',
  },
]
