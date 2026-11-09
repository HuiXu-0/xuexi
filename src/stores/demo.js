import { reactive } from 'vue'

/**
 * 本地演示状态：Agent 开关、加入/收藏、新建内容、工单状态等。
 * 全部只存在于内存，刷新即清空 —— 与原 HTML 原型行为一致。
 */
export const demoStore = reactive({
  agentState: { search: true, moderation: true, planner: true },

  /** 已加入的小组：{ [title]: true } */
  joinedGroups: {},
  /** 收藏的条目：{ [title]: true } */
  savedItems: {},

  /** 本地新建内容 */
  groups: [],
  posts: [],
  notes: [],
  resources: [],
  competitions: [],
  cases: [],
  recommendations: [],

  /** 管理工单状态：{ [id]: { label, class } } */
  adminTaskStatus: {},
  /** 案例授权流程：{ [caseId]: { state, sections, note, updatedAt } } */
  caseAuthorizations: {},
  /** 教师推荐申请记录 */
  recommendRequests: [],
  /** 教师工作台待确认推荐数 */
  teacherPendingCount: 1,
  /** 管理员工单计数 */
  adminReportsCount: 3,
})

export function toggleJoin(name, mode) {
  const joined = !!demoStore.joinedGroups[name]
  if (joined) delete demoStore.joinedGroups[name]
  else demoStore.joinedGroups[name] = true
  return { joined: !joined, joinedLabel: mode === '申请' ? '已提交申请' : '已加入' }
}

export function toggleSave(name) {
  const saved = !!demoStore.savedItems[name]
  if (saved) delete demoStore.savedItems[name]
  else demoStore.savedItems[name] = true
  return !saved
}
