/**
 * 平台通用字典。
 *
 * 依据《校园学习资源共享与知识协作平台产品设计书》：
 *   §9.1 内容对象类型　§9.2 标签体系　§11.1 发布状态　§11.2 可见范围
 *   §3.1 用户角色　　　§4 导航结构
 *
 * 这些是跨模块共用的语义，各页面与表单都从这里取，避免各写各的。
 */

/* ---------- §11.1 内容发布状态 ---------- */
/**
 * 统一的状态语义。设计书要求「状态名称应在用户端清晰解释，
 * 不能只显示内部代码或含糊的『异常』」，所以每项都带说明文案。
 * tone 用于配色，label 是给用户看的文字（颜色之外还有文字，不只靠颜色表达）。
 */
export const contentStates = {
  draft: { label: '草稿', tone: 'gray', desc: '仅自己可见，尚未提交。' },
  pending: { label: '待审核', tone: 'amber', desc: '已提交，等待内容审核 Agent 与人工复核。' },
  review: { label: '待人工复核', tone: 'amber', desc: '审核 Agent 置信不足或存在争议，需人工判断。' },
  published: { label: '已发布', tone: 'green', desc: '已公开发布，可被有权用户检索到。' },
  returned: { label: '退回修改', tone: 'red', desc: '需要按说明修改后重新提交。' },
  hidden: { label: '暂时隐藏', tone: 'blue', desc: '因争议暂时下线，处理后可能恢复。' },
  removed: { label: '已下架', tone: 'gray', desc: '已从主要展示区域退出。' },
  archived: { label: '已归档', tone: 'gray', desc: '历史内容，保留可查但不参与推荐。' },
  deleted: { label: '已删除', tone: 'gray', desc: '已删除的内容。' },
}

/** 状态在界面上的展示顺序（用于管理列表） */
export const contentStateOrder = [
  'draft',
  'pending',
  'review',
  'published',
  'returned',
  'hidden',
  'removed',
  'archived',
]

export function stateMeta(key) {
  return contentStates[key] || contentStates.draft
}

/* ---------- §11.2 内容可见范围 ---------- */
/**
 * 查看权与使用权分离（§11.3）：可见范围决定"谁能看"，
 * 使用许可是另一件事，由案例/笔记作者单独确认。
 */
export const visibilityScopes = {
  private: { label: '仅自己可见', short: '私有', desc: '只有你自己能看到，适合草稿和未完成的记录。' },
  campus: { label: '校内可见', short: '校内', desc: '已验证校内身份的用户可见。原型阶段以角色选择近似演示。' },
  members: { label: '成员可见', short: '成员', desc: '仅指定小组或成员的成员可见。' },
  public: { label: '公开可见', short: '公开', desc: '任何访客都可以查看。' },
}

export const visibilityOrder = ['private', 'campus', 'members', 'public']

export function visibilityMeta(key) {
  return visibilityScopes[key] || visibilityScopes.private
}

/* ---------- §9.2 标签体系 ---------- */
/**
 * 标签按用途分组，而不是混在一个无序列表里。
 * 数据层用 { group, value } 结构，界面按组渲染与筛选。
 */
export const tagGroups = [
  { key: 'tech', label: '技术方向', desc: '具体技术领域' },
  { key: 'stage', label: '学习阶段', desc: '适合的学习阶段' },
  { key: 'kind', label: '内容类型', desc: '这条内容是什么形态' },
  { key: 'domain', label: '专业领域', desc: '专业或课程方向' },
  { key: 'contest', label: '竞赛类型', desc: '竞赛的组织与参与方式' },
]

export const tagOptions = {
  tech: ['Python', '嵌入式', 'EDA', '人工智能', '前端开发', '硬件设计'],
  stage: ['入门', '基础', '进阶', '项目实战'],
  kind: ['教程', '学习笔记', '实验记录', '项目复盘', '竞赛经验', '问题解答'],
  domain: ['电子信息工程', '计算机科学与技术', '软件工程', '人工智能'],
  contest: ['个人赛', '团队赛', '学科竞赛', '创新创业'],
}

export function tagLabel(group, value) {
  return value
}

/* ---------- §3.1 用户角色 ---------- */
/**
 * 角色在登录界面选择，登录后即固定。
 * 角色决定：可见导航、可访问页面、以及各页面的操作权限。
 */
export const userRoles = [
  {
    key: 'student',
    label: '学生',
    /** 头像用的单字缩写，避免与文字标签连读成「学生学生」 */
    initial: '学',
    icon: 'i-users',
    desc: '查找与发布学习内容，参与小组讨论，使用学习规划。',
    badge: '学习者',
  },
  {
    key: 'teacher',
    label: '教师',
    initial: '教',
    icon: 'i-book',
    desc: '管理学习小组，推荐优秀案例，处理被分配的审核任务。',
    badge: '内容协作者',
  },
  {
    key: 'admin',
    label: '平台管理员',
    initial: '管',
    icon: 'i-shield',
    desc: '处理举报与反馈，维护审核规则，管理账号权限与 Agent 开关。',
    badge: '平台管理者',
  },
]

export function roleMeta(key) {
  return userRoles.find((r) => r.key === key) || userRoles[0]
}

/* ---------- §4 导航结构 ---------- */
/**
 * 三端主导航。设计书 §4.1–4.3：
 *   学生端：首页 / 学习平台(5 项) / 个人中心
 *   教师端：教师工作台 / 首页内容管理(仅授权) / 学习平台管理 / 个人中心
 *   管理员端：9 个模块
 *
 * groups 支持二级下拉：items 为一级入口，children 为其子项。
 */
export const navByRole = {
  student: [
    { key: 'home', label: '首页', route: 'home', icon: 'i-grid' },
    {
      key: 'platform',
      label: '学习平台',
      icon: 'i-book',
      children: [
        { route: 'forum', label: '学习论坛' },
        { route: 'notes', label: '学习笔记' },
        { route: 'competitions', label: '竞赛资源' },
        { route: 'resources', label: '资源导航' },
        { route: 'cases', label: '优秀案例' },
      ],
    },
    { key: 'planner', label: '学习规划', route: 'planner', icon: 'i-target' },
    { key: 'profile', label: '个人中心', route: 'profile', icon: 'i-file' },
  ],
  teacher: [
    { key: 'teacher', label: '教师工作台', route: 'teacher', icon: 'i-book' },
    {
      key: 'manage',
      label: '学习平台管理',
      icon: 'i-users',
      children: [
        { route: 'teacher', label: '我管理的小组' },
        { route: 'teacher', label: '学生案例推荐' },
        { route: 'teacher', label: '被分配的审核事项' },
      ],
    },
    { key: 'notes', label: '学习笔记', route: 'notes', icon: 'i-file' },
    { key: 'profile', label: '个人中心', route: 'profile', icon: 'i-file' },
  ],
  admin: [
    { key: 'admin', label: '管理工作台', route: 'admin', icon: 'i-grid' },
    { key: 'notes', label: '学习笔记', route: 'notes', icon: 'i-file' },
    { key: 'profile', label: '个人中心', route: 'profile', icon: 'i-file' },
  ],
}

/* ---------- §9.1 内容对象类型 ---------- */
export const contentTypes = {
  notice: { label: '官方通知', icon: 'i-bellring', creator: '授权内容管理员' },
  group: { label: '学习小组', icon: 'i-users', creator: '学生或教师' },
  post: { label: '论坛帖子', icon: 'i-message', creator: '学生或教师' },
  note: { label: '学习笔记', icon: 'i-file', creator: '学生或教师' },
  resource: { label: '外部学习资源', icon: 'i-lightbulb', creator: '学生、教师或管理员' },
  competition: { label: '竞赛条目', icon: 'i-trophy', creator: '指定维护者、教师或管理员' },
  case: { label: '优秀案例', icon: 'i-spark', creator: '项目作者/团队' },
  bug: { label: 'Bug 反馈', icon: 'i-shield', creator: '所有符合规则的用户' },
  suggestion: { label: '功能建议', icon: 'i-spark', creator: '所有符合规则的用户' },
  report: { label: '举报案件', icon: 'i-bellring', creator: '用户' },
  plan: { label: '学习计划', icon: 'i-target', creator: '学生与学习规划 Agent 协作' },
}

/* ---------- §12.1 通知类型 ---------- */
export const notificationTypes = {
  official: { label: '官方重要通知', icon: 'i-bellring' },
  recommendation: { label: '案例推荐申请', icon: 'i-spark' },
  authorization: { label: '案例授权状态变化', icon: 'i-shield' },
  moderation: { label: '内容审核结果', icon: 'i-file' },
  reply: { label: '帖子回复或被提及', icon: 'i-message' },
  group: { label: '小组加入申请与结果', icon: 'i-users' },
  report: { label: '举报/申诉处理结果', icon: 'i-bellring' },
  feedback: { label: 'Bug 与建议状态变化', icon: 'i-send' },
  planner: { label: '学习规划阶段提醒', icon: 'i-target' },
}
