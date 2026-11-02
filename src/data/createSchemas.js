/**
 * 各类“创建 / 提交”表单的字段定义，由 ModalHost 动态渲染。
 * type: input | textarea | select；options 为 [value, label] 数组。
 */
export const createSchemas = {
  group: {
    title: '创建学习小组',
    subtitle: '设置目标、标签、加入规则和内容范围',
    submit: '创建演示小组',
    fields: [
      { name: 'title', label: '小组名称', placeholder: '例如：算法与编程共学小组', required: true },
      { name: 'description', label: '小组目标与简介', type: 'textarea', placeholder: '说明学习目标、活动形式或适合人群', required: true },
      { name: 'category', label: '技术方向', placeholder: '例如：算法 / Python / 嵌入式' },
      { name: 'joinMode', label: '加入方式', type: 'select', options: [['open', '开放加入'], ['apply', '申请加入'], ['invite', '邀请加入']] },
      { name: 'visibility', label: '内容可见范围', type: 'select', options: [['public', '公开'], ['campus', '校内可见'], ['members', '成员可见']] },
    ],
  },
  teacherGroup: {
    title: '创建教师学习小组',
    subtitle: '教师工作台中的小组创建演示',
    submit: '创建演示小组',
    fields: [
      { name: 'title', label: '小组名称', placeholder: '例如：课程项目实践小组', required: true },
      { name: 'description', label: '学习目标与简介', type: 'textarea', placeholder: '填写课程主题、学习目标和活动安排', required: true },
      { name: 'category', label: '课程或技术方向', placeholder: '例如：课程项目 / 人工智能' },
      { name: 'joinMode', label: '加入方式', type: 'select', options: [['open', '开放加入'], ['apply', '申请加入'], ['invite', '邀请加入']] },
      { name: 'visibility', label: '内容可见范围', type: 'select', options: [['campus', '校内可见'], ['members', '成员可见'], ['public', '公开']] },
    ],
  },
  post: {
    title: '发布学习讨论',
    subtitle: '描述问题、背景和已有尝试，帮助讨论沉淀为可复用知识',
    submit: '发布演示讨论',
    fields: [
      { name: 'title', label: '讨论标题', placeholder: '用一句话说明问题或主题', required: true },
      { name: 'content', label: '讨论内容', type: 'textarea', placeholder: '说明背景、环境、目标和已经尝试的方法…', required: true },
      { name: 'group', label: '所属小组', type: 'select', options: [['embedded', '嵌入式实践学习小组'], ['programming', '编程基础共学小组'], ['project', '项目实践交流']] },
      { name: 'kind', label: '内容类型', type: 'select', options: [['question', '问题求助'], ['discussion', '普通讨论'], ['resource', '资源推荐'], ['activity', '活动信息']] },
    ],
  },
  note: {
    title: '发布学习笔记',
    subtitle: '保留作者归属、引用来源和明确的可见范围',
    submit: '提交演示笔记',
    fields: [
      { name: 'title', label: '笔记标题', placeholder: '例如：数据结构复习总结', required: true },
      { name: 'content', label: '笔记正文/简介', type: 'textarea', placeholder: '整理关键知识、实验记录、实践步骤或复盘经验…', required: true },
      { name: 'category', label: '主要分类', type: 'select', options: [['programming', '编程基础'], ['hardware', '硬件与嵌入式'], ['practice', '项目复盘'], ['ai', '人工智能'], ['other', '其他']] },
      { name: 'visibility', label: '可见范围', type: 'select', options: [['personal', '仅自己可见'], ['campus', '校内可见'], ['public', '公开可见']] },
      { name: 'source', label: '引用来源（如有）', placeholder: '填写原始链接、作者或来源说明' },
      { name: 'license', label: '使用许可说明', placeholder: '例如：仅供学习参考，未经许可不得转载' },
    ],
  },
  resource: {
    title: '提交学习资源',
    subtitle: '平台保存资源元信息与原始链接，不默认复制第三方完整内容',
    submit: '提交演示资源',
    fields: [
      { name: 'title', label: '资源标题', placeholder: '例如：嵌入式开发入门指南', required: true },
      { name: 'url', label: '原始链接', type: 'url', placeholder: 'https://…', required: true },
      { name: 'category', label: '资源类别', type: 'select', options: [['programming', '编程基础'], ['ai', '人工智能'], ['hardware', '嵌入式与硬件'], ['math', '数学基础'], ['competition', '竞赛资源'], ['other', '其他']] },
      { name: 'source', label: '来源平台/作者（已知时）', placeholder: '填写来源平台、作者或机构' },
      { name: 'description', label: '资源简介与适合基础', type: 'textarea', placeholder: '说明资源内容、适合阶段和推荐理由' },
    ],
  },
  competition: {
    title: '提交竞赛线索',
    subtitle: '未核实的日期应标记为预计或往届参考，不得写成已确认安排',
    submit: '提交演示线索',
    fields: [
      { name: 'title', label: '竞赛名称或方向', placeholder: '填写官方赛事名称；不确定时注明方向', required: true },
      { name: 'host', label: '主办方', placeholder: '主办单位（待核实也可说明）' },
      { name: 'url', label: '官方来源链接', type: 'url', placeholder: 'https://…' },
      { name: 'status', label: '信息状态', type: 'select', options: [['verify', '信息待核实'], ['history', '往届参考'], ['confirmed', '已有官方来源，仍需复核']] },
      { name: 'description', label: '补充说明', type: 'textarea', placeholder: '说明适用方向、日期来源或需要核实的内容' },
    ],
  },
  case: {
    title: '发布优秀案例',
    subtitle: '分清作者、贡献者、可见范围和使用许可；附件不默认公开',
    submit: '创建演示案例',
    fields: [
      { name: 'title', label: '项目/案例标题', placeholder: '例如：从需求到原型的项目复盘', required: true },
      { name: 'summary', label: '项目简介', type: 'textarea', placeholder: '说明背景、目标、实现思路和实践结果', required: true },
      { name: 'category', label: '项目方向', type: 'select', options: [['hardware', '智能硬件'], ['ai', '人工智能'], ['software', '软件项目'], ['other', '其他']] },
      { name: 'visibility', label: '基础展示范围', type: 'select', options: [['personal', '仅自己可见'], ['campus', '校内展示'], ['public', '公开展示']] },
      { name: 'details', label: '内容公开说明（可选）', type: 'textarea', placeholder: '哪些内容可展示？源代码、设计文件和完整文档默认不自动公开。' },
      { name: 'contributors', label: '共同作者确认情况', type: 'select', options: [['pending', '尚待确认'], ['confirmed', '已确认相关贡献者授权']] },
    ],
  },
  recommendation: {
    title: '发起优秀案例推荐邀请',
    subtitle: '教师推荐不等于作者授权；具体展示范围需由作者确认',
    submit: '创建演示推荐申请',
    fields: [
      { name: 'title', label: '项目名称', placeholder: '填写项目或案例名称', required: true },
      { name: 'author', label: '作者/主要联系人', placeholder: '填写作者显示名称', required: true },
      { name: 'reason', label: '推荐理由', type: 'textarea', placeholder: '说明项目的学习价值或实践经验', required: true },
      { name: 'scope', label: '拟展示范围', type: 'select', options: [['campus', '校内展示'], ['public', '公开展示']] },
      { name: 'fields', label: '拟展示内容', type: 'textarea', placeholder: '明确是否展示摘要、图片、视频、原理文档、附件或代码链接', required: true },
    ],
  },
}
