/**
 * 教师端领域数据。
 *
 * 依据《校园学习资源共享与知识协作平台产品设计书》：
 *   §6.1 教师工作台　　 §6.2 学习小组管理
 *   §6.3 优秀案例推荐管理 §6.4 教师审核任务
 *   §6.5 首页内容管理
 *
 * 全部为静态演示数据，状态流转只写内存（demoStore），刷新即清空。
 */

import { channelTypeOrder, joinModes, riskCategories } from './dict.js'

/* ---------- §6.2 学习小组 ---------- */
/**
 * 教师创建的小组。§5.2.2 明确教师可设置：名称、简介、学习目标、
 * 加入方式、学生范围、小组规则和频道结构。
 */
export const teacherGroups = [
  {
    id: 'TG-001',
    icon: 'i-users',
    title: '嵌入式系统实践小组',
    desc: '围绕 ESP32 与传感器联调做学期项目，从零搭建到能稳定运行的小车。',
    goal: '完成一个可演示的物联网小项目，并能讲清楚每个模块的取舍。',
    joinMode: 'approve',
    scope: '面向电子信息工程 2023 级，已选《嵌入式系统设计》课程的学生',
    tags: ['嵌入式', '项目实战', '硬件设计'],
    members: 18,
    pending: 3,
    channels: [
      { key: 'notice', enabled: true, count: 4 },
      { key: 'discussion', enabled: true, count: 27 },
      { key: 'question', enabled: true, count: 9 },
      { key: 'resource', enabled: true, count: 12 },
      { key: 'task', enabled: true, count: 2 },
      { key: 'feedback', enabled: false, count: 0 },
    ],
    rules: [
      '提问时贴出硬件接线图与复现步骤，方便他人复现。',
      '每周至少提交一次进度记录，缺勤需提前请假。',
      '开源代码使用 MIT 协议，引用他人资料注明出处。',
    ],
    status: 'active',
    updatedAt: '2026-11-05',
  },
  {
    id: 'TG-002',
    icon: 'i-book',
    title: 'AI 应用与模型实践',
    desc: '以真实任务驱动，学习如何把模型能力接进实际系统，而不是只做演示。',
    goal: '每人完成一个可部署的小应用，并能说明模型选型与评测依据。',
    joinMode: 'course',
    scope: '限《人工智能导论》课程学生，人数不超过 30',
    tags: ['人工智能', 'Python', '进阶'],
    members: 24,
    pending: 0,
    channels: [
      { key: 'notice', enabled: true, count: 6 },
      { key: 'discussion', enabled: true, count: 41 },
      { key: 'question', enabled: true, count: 15 },
      { key: 'resource', enabled: true, count: 20 },
      { key: 'task', enabled: true, count: 4 },
      { key: 'feedback', enabled: true, count: 2 },
    ],
    rules: [
      '分享项目时必须说明数据来源与是否含个人信息。',
      '引用他人模型成果需注明出处，不夸大效果。',
      '每周一次线下分享，缺席者看回放补交笔记。',
    ],
    status: 'active',
    updatedAt: '2026-11-07',
  },
  {
    id: 'TG-003',
    icon: 'i-trophy',
    title: '程序设计能力训练营',
    desc: '面向准备学科竞赛的同学，按专题组织训练与模拟赛。',
    goal: '完成一轮专题训练，参加一次正式比赛并复盘。',
    joinMode: 'approve',
    scope: '已报名本届竞赛培训的学生',
    tags: ['程序设计', '算法', '团队赛'],
    members: 12,
    pending: 1,
    channels: [
      { key: 'notice', enabled: true, count: 8 },
      { key: 'discussion', enabled: true, count: 33 },
      { key: 'question', enabled: true, count: 11 },
      { key: 'resource', enabled: true, count: 16 },
      { key: 'task', enabled: true, count: 3 },
      { key: 'feedback', enabled: false, count: 0 },
    ],
    rules: [
      '训练记录按周提交，题目来源需注明出处。',
      '讨论区不贴完整答案，只贴思路与卡点。',
    ],
    status: 'active',
    updatedAt: '2026-11-08',
  },
  {
    id: 'TG-004',
    icon: 'i-file',
    title: '2025 秋季嵌入式训练营',
    desc: '上一学期已结束的专项训练营，保留资料供查阅。',
    goal: '已完成。',
    joinMode: 'invite',
    scope: '已结束，仅保留历史资料',
    tags: ['嵌入式', '项目实战'],
    members: 20,
    pending: 0,
    channels: [
      { key: 'notice', enabled: true, count: 5 },
      { key: 'discussion', enabled: true, count: 52 },
      { key: 'question', enabled: true, count: 21 },
      { key: 'resource', enabled: true, count: 31 },
      { key: 'task', enabled: true, count: 6 },
      { key: 'feedback', enabled: true, count: 1 },
    ],
    rules: ['已归档小组不再接受加入申请。'],
    status: 'archived',
    updatedAt: '2025-12-20',
  },
]

/** 小组频道类型按顺序取，页面按此渲染频道结构 */
export const groupChannelTypes = channelTypeOrder

export { joinModes }

/* ---------- §6.2 成员加入申请 ---------- */
export const pendingJoinRequests = [
  {
    id: 'JR-001',
    groupId: 'TG-001',
    groupTitle: '嵌入式系统实践小组',
    applicant: '李同学',
    reason: '已完成上一学期传感器课，希望继续做小车项目。',
    appliedAt: '2026-11-08',
    status: 'pending',
  },
  {
    id: 'JR-002',
    groupId: 'TG-001',
    groupTitle: '嵌入式系统实践小组',
    applicant: '王同学',
    reason: '想学习硬件调试，之前没做过完整项目。',
    appliedAt: '2026-11-07',
    status: 'pending',
  },
  {
    id: 'JR-003',
    groupId: 'TG-001',
    groupTitle: '嵌入式系统实践小组',
    applicant: '张同学',
    reason: '同组同学推荐，已看过项目说明。',
    appliedAt: '2026-11-06',
    status: 'pending',
  },
  {
    id: 'JR-004',
    groupId: 'TG-003',
    groupTitle: '程序设计能力训练营',
    applicant: '赵同学',
    reason: '想参加明年的算法竞赛，先跟着训练。',
    appliedAt: '2026-11-08',
    status: 'pending',
  },
]

/* ---------- §6.4 审核任务队列 ---------- */
/**
 * 每项任务包含设计书 §6.4 要求的 5 项：内容类型、风险提示、审核理由、
 * 内容作者、可采取的操作与处理记录。
 */
export const reviewTasks = [
  {
    id: 'RV-2026-0417',
    type: '优秀案例',
    typeIcon: 'i-spark',
    title: '基于 ESP32 的智能温室监控系统',
    author: '陈同学',
    authorAvatar: '陈',
    scope: '电子信息工程 2023 级 · 公开内容',
    risk: 'privacy',
    riskLabel: '未经授权公开个人敏感信息',
    reason:
      '案例简介中附带了开发者的真实姓名与手机号，用于说明调试联系。该字段未获得单独公开授权。',
    snippet:
      '……项目由陈同学（联系方式 138****6721）独立完成，硬件选型与调试过程如下……',
    status: 'needHuman',
    assignedAt: '2026-11-07',
    dueAt: '2026-11-12',
    priority: 'high',
    agentNote: '审核 Agent 标记：检测到疑似联系方式信息，但无法判断是否已获授权，需人工核实。',
    history: [
      { time: '2026-11-07 10:24', actor: '审核 Agent', action: '初筛', detail: '标记为需人工复核' },
      { time: '2026-11-07 11:02', actor: '系统', action: '分配', detail: '分配给当前教师' },
    ],
  },
  {
    id: 'RV-2026-0421',
    type: '论坛帖子',
    typeIcon: 'i-message',
    title: '【讨论】这道题的第三种解法',
    author: '刘同学',
    authorAvatar: '刘',
    scope: 'AI 应用与模型实践 · 小组内可见',
    risk: 'abuse',
    riskLabel: '辱骂与人身攻击',
    reason:
      '回复中对另一位同学使用了贬损性表述。原文属于正常的技术争论，但措辞越界。',
    snippet: '……这种水平也敢拿出来说，难怪每次都错，真是浪费时间……',
    status: 'pending',
    assignedAt: '2026-11-08',
    dueAt: '2026-11-10',
    priority: 'high',
    agentNote: '审核 Agent 标记：命中辱骂类规则，但上下文为技术讨论，建议人工判断。',
    history: [{ time: '2026-11-08 09:15', actor: '审核 Agent', action: '初筛', detail: '建议人工复核' }],
  },
  {
    id: 'RV-2026-0430',
    type: '外部资源',
    typeIcon: 'i-lightbulb',
    title: '免费 API 聚合平台',
    author: '外部提交者',
    authorAvatar: '外',
    scope: '资源导航 · 公开条目',
    risk: 'spam',
    riskLabel: '垃圾广告与刷屏',
    reason:
      '简介包含大量推广话术与多个跳转链接，实质为导流广告。是否保留取决于平台对资源导航的收录标准。',
    snippet: '……全网最全的 API 聚合，点击注册立享会员优惠，更多资源请访问……',
    status: 'agentReview',
    assignedAt: '2026-11-08',
    dueAt: '2026-11-13',
    priority: 'normal',
    agentNote: '审核 Agent 标记：疑似垃圾推广，建议拒绝。',
    history: [{ time: '2026-11-08 14:40', actor: '审核 Agent', action: '初筛', detail: '建议拒绝' }],
  },
  {
    id: 'RV-2026-0433',
    type: '学习笔记',
    typeIcon: 'i-file',
    title: '从零搭建深度学习环境',
    author: '周同学',
    authorAvatar: '周',
    scope: '公开内容',
    risk: 'judgment',
    riskLabel: '需人工判断',
    reason: '涉及他人教程截图较多，需判断是否属于合理引用还是未经许可的搬运。',
    snippet: '……配置过程参考了某教程的截图（见下图），在此基础上做了版本适配……',
    status: 'pending',
    assignedAt: '2026-11-08',
    dueAt: '2026-11-15',
    priority: 'normal',
    agentNote: '审核 Agent 标记：存在引用，但无法判断授权情况。',
    history: [{ time: '2026-11-08 16:05', actor: '系统', action: '分配', detail: '分配给当前教师' }],
  },
  {
    id: 'RV-2026-0440',
    type: '论坛帖子',
    typeIcon: 'i-message',
    title: '组队参加校园创新创业赛',
    author: '孙同学',
    authorAvatar: '孙',
    scope: '学习论坛 · 公开小组',
    risk: 'judgment',
    riskLabel: '需人工判断',
    reason: '属于正常的组队招募帖，但涉及外部赛事的报名信息，需确认是否需要补充官方链接。',
    snippet: '……我们计划组队参加校级创新创业赛，有兴趣的同学可以联系我组队……',
    status: 'pending',
    assignedAt: '2026-11-09',
    dueAt: '2026-11-16',
    priority: 'low',
    agentNote: '审核 Agent 标记：未发现明显风险，转人工确认信息完整性。',
    history: [{ time: '2026-11-09 08:30', actor: '系统', action: '分配', detail: '分配给当前教师' }],
  },
]

export { riskCategories }

/* ---------- §6.1.2 近期发布的推荐资源或公告 ---------- */
export const teacherPublishedItems = [
  {
    id: 'PUB-001',
    kind: '公告',
    kindIcon: 'i-bellring',
    title: '嵌入式小组第三次阶段检查安排',
    desc: '本周五下午提交阶段报告，需包含实物演示视频与硬件清单。',
    publishedAt: '2026-11-08',
    scope: '嵌入式系统实践小组',
    state: 'published',
  },
  {
    id: 'PUB-002',
    kind: '资源',
    kindIcon: 'i-lightbulb',
    title: 'EDA 常用元件库与封装规范',
    desc: '课程组整理的元件库与命名规范，供小组统一画图时使用。',
    publishedAt: '2026-11-06',
    scope: '课程范围可见',
    state: 'published',
  },
  {
    id: 'PUB-003',
    kind: '资源',
    kindIcon: 'i-lightbulb',
    title: '模型评测指标速查表',
    desc: '常见评测指标的适用场景与常见误用。',
    publishedAt: '2026-11-04',
    scope: '课程范围可见',
    state: 'published',
  },
  {
    id: 'PUB-004',
    kind: '公告',
    kindIcon: 'i-bellring',
    title: 'AI 实践小组模型部署工作坊',
    desc: '面向小组成员的工作坊，讲解模型压缩与边缘部署。',
    publishedAt: '2026-11-02',
    scope: 'AI 应用与模型实践',
    state: 'archived',
  },
]

/* ---------- §6.1.2 需要回复的学生问题 / 反馈 ---------- */
export const studentQuestions = [
  {
    id: 'Q-101',
    kind: '小组提问',
    kindIcon: 'i-help',
    title: '串口通信偶发丢帧，如何定位？',
    from: '李同学',
    group: '嵌入式系统实践小组',
    excerpt: '波特率设为 115200 时偶发丢包，降低到 9600 就稳定了……',
    askedAt: '2026-11-09',
    dueAt: '2026-11-10',
    priority: 'high',
    status: 'pending',
  },
  {
    id: 'Q-102',
    kind: '小组提问',
    kindIcon: 'i-help',
    title: '项目文档里的图片可以引用他人论文吗？',
    from: '王同学',
    group: '嵌入式系统实践小组',
    excerpt: '想引用一篇论文里的架构图，需要怎么标注来源？',
    askedAt: '2026-11-08',
    dueAt: '2026-11-12',
    priority: 'normal',
    status: 'pending',
  },
  {
    id: 'Q-103',
    kind: '反馈建议',
    kindIcon: 'i-send',
    title: '希望小组帖子能支持按标签筛选',
    from: '孙同学',
    group: 'AI 应用与模型实践',
    excerpt: '讨论多了以后很难找到自己关心的方向……',
    askedAt: '2026-11-07',
    dueAt: null,
    priority: 'low',
    status: 'pending',
  },
]

/* ---------- §6.3.2 推荐申请填写项 ---------- */
/**
 * 推荐申请需要包含的 5 项（设计书 §6.3.2 原文）。
 * 用于表单与说明，附件一项在原型阶段只做登记不真实上传。
 */
export const recommendFormFields = [
  { key: 'project', label: '项目名称与作者/团队', required: true, hint: '填写项目名称及作者或团队成员。' },
  { key: 'reason', label: '推荐理由及教育价值', required: true, hint: '说明这个项目对后续学习者的参考价值。' },
  { key: 'fields', label: '拟展示的字段和附件', required: true, hint: '列出准备展示的内容，附件在正式平台需单独确认授权。' },
  { key: 'scope', label: '拟发布的可见范围', required: true, hint: '最终公开范围以学生授权为准，不能超出。' },
  { key: 'note', label: '教师推荐说明', required: false, hint: '可选。推荐标签表明推荐主体，不应暗示学校对技术细节或竞赛成果作出保证。' },
]

/* ---------- §6.3.4 推荐发布要求 ---------- */
export const recommendPublishRules = [
  '学生授权范围是最终公开范围的上限，不得超出。',
  '推荐标签应表明推荐主体，但不能暗示学校对所有技术细节、竞赛成果或商业价值作出保证。',
  '推荐文案应尽量基于事实，必要时要求补充依据。',
  '涉及共同作品、他人照片、第三方材料或竞赛保密要求时，应提示作者确认相关授权。',
]

/* ---------- §6.5 首页内容管理 ---------- */
/**
 * 校级通知。§6.5 要求支持新建、编辑未发布、设定有效期、设置重要级别与置顶、
  预览桌面端与移动端、发布撤回归档更正、查看变更记录。
 */
export const officialNotices = [
  {
    id: 'NT-2026-118',
    title: '关于开展本学期嵌入式系统实践项目申报的通知',
    publisher: '教务处 · 实践教学科',
    publisherUnit: '教务处',
    publishedAt: '2026-11-08',
    expireAt: '2026-11-30',
    importance: 'high',
    importanceLabel: '重要',
    pinned: true,
    state: 'published',
    scope: '全校可见',
    body: '本学期嵌入式系统实践项目即日起开始申报，各小组负责人请在截止日期前提交项目简介与预期成果。',
    changes: [
      { time: '2026-11-08 09:20', actor: '内容管理员', action: '发布', detail: '首次发布' },
    ],
  },
  {
    id: 'NT-2026-121',
    title: '学习平台竞赛资源入口维护说明',
    publisher: '实践教学科',
    publisherUnit: '实践教学科',
    publishedAt: null,
    expireAt: null,
    importance: 'normal',
    importanceLabel: '普通',
    pinned: false,
    state: 'draft',
    scope: '校内可见',
    body: '竞赛官网链接变动频繁，维护者需要在两周内核实一次来源与报名状态。',
    changes: [{ time: '2026-11-09 15:40', actor: '内容管理员', action: '创建', detail: '保存为草稿' }],
  },
  {
    id: 'NT-2026-115',
    title: '关于期末学习资料整理的提醒',
    publisher: '教务处',
    publisherUnit: '教务处',
    publishedAt: '2026-10-20',
    expireAt: '2026-11-05',
    importance: 'normal',
    importanceLabel: '普通',
    pinned: false,
    state: 'expired',
    scope: '全校可见',
    body: '期末学习资料请在截止日期前整理并提交。',
    changes: [
      { time: '2026-10-20 14:00', actor: '内容管理员', action: '发布', detail: '首次发布' },
      { time: '2026-11-05 00:00', actor: '系统', action: '失效', detail: '超过有效期' },
    ],
  },
]
