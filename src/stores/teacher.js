import { reactive } from 'vue'
import { teacherGroups } from '../data/teacher.js'

/**
 * 教师端本地演示状态。
 *
 * 设计书 §6.2 / §6.3 / §6.4 / §6.5 涉及的状态流转全部只写内存，
 * 刷新即清空 —— 与原型的其他演示数据保持一致。
 *
 * 权限边界（设计书 §6.3.3、§6.4）：
 * 教师只能操作自己发起或明确授权给自己的事项，因此这里以
 * 「当前教师」为归属判断依据，不做跨教师的越权入口。
 */

export const teacherStore = reactive({
  /** 小组状态：{ [groupId]: { status, channels, rules, pending } } */
  groups: {},

  /** 成员加入申请：{ [requestId]: { status } } */
  joinRequests: {},

  /** 小组置顶通知：{ [groupId]: [ { id, title, pinnedAt } ] } */
  pinnedNotices: {},

  /** 小组讨论处理记录：{ [postId]: { state, reason, at } } */
  groupPostStates: {},

  /** 推荐申请状态：{ [reqId]: { state, note, updatedAt, history } } */
  recommendStates: {},

  /** 审核任务状态：{ [taskId]: { status, action, reason, at, history } } */
  reviewTaskStates: {},

  /** 校级通知：{ [noticeId]: { ...fields } } */
  notices: {},

  /** 待回复的学生问题：{ [questionId]: { status, reply } } */
  questions: {},
})

/** 读取某小组的运行时状态，没有则回落到静态数据 */
export function groupState(group) {
  const s = teacherStore.groups[group.id]
  return {
    ...group,
    status: s?.status ?? group.status,
    channels: s?.channels ?? group.channels,
    rules: s?.rules ?? group.rules,
    members: s?.members ?? group.members,
    pending: s?.pending ?? group.pending,
  }
}

/** 更新小组（编辑信息 / 归档 / 开关频道 / 改规则） */
export function updateGroup(groupId, patch) {
  const cur = teacherStore.groups[groupId] || {}
  teacherStore.groups[groupId] = { ...cur, ...patch }
  return teacherStore.groups[groupId]
}

/**
 * 切换某个频道的启用状态。
 *
 * 注意：teacherStore.groups 初始是空的，直接用 cur.channels 会得到空数组，
 * 把原始小组的频道结构覆盖掉。所以要先从静态数据兜底。
 */
export function toggleChannel(groupId, channelKey) {
  const cur = teacherStore.groups[groupId] || {}
  const source = cur.channels?.length
    ? cur.channels
    : (teacherGroups.find((g) => g.id === groupId)?.channels || [])
  const channels = source.map((c) =>
    c.key === channelKey ? { ...c, enabled: !c.enabled } : { ...c }
  )
  teacherStore.groups[groupId] = { ...cur, channels }
  return channels
}

/** 处理成员加入申请 */
export function handleJoinRequest(requestId, approved) {
  teacherStore.joinRequests[requestId] = {
    status: approved ? 'approved' : 'rejected',
    at: new Date().toISOString().slice(0, 10),
  }
  return teacherStore.joinRequests[requestId]
}

/** 发布小组置顶通知 */
export function addPinnedNotice(groupId, notice) {
  const list = teacherStore.pinnedNotices[groupId] || []
  teacherStore.pinnedNotices[groupId] = [{ id: `PN-${Date.now()}`, ...notice }, ...list]
  return teacherStore.pinnedNotices[groupId]
}

/** 小组内内容处置：普通删除 / 隐藏待核实 / 永久清理 */
export function setGroupPostState(postId, state, reason) {
  teacherStore.groupPostStates[postId] = {
    state,
    reason: reason || '',
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
  return teacherStore.groupPostStates[postId]
}

/** 推荐申请状态流转 */
export function setRecommendState(reqId, state, note) {
  const cur = teacherStore.recommendStates[reqId] || { history: [] }
  const history = [
    ...(cur.history || []),
    { time: new Date().toISOString().slice(0, 16).replace('T', ' '), state, note: note || '' },
  ]
  teacherStore.recommendStates[reqId] = {
    ...cur,
    state,
    note: note ?? cur.note,
    updatedAt: new Date().toISOString().slice(0, 10),
    history,
  }
  return teacherStore.recommendStates[reqId]
}

/** 审核任务处置 */
export function setReviewTaskState(taskId, action, reason, actor) {
  const cur = teacherStore.reviewTaskStates[taskId] || { history: [] }
  const history = [
    ...(cur.history || []),
    {
      time: new Date().toISOString().slice(0, 16).replace('T', ' '),
      actor: actor || '当前教师',
      action,
      detail: reason || '',
    },
  ]
  teacherStore.reviewTaskStates[taskId] = {
    ...cur,
    status: action === 'defer' ? 'deferred' : 'done',
    action,
    reason: reason || '',
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
    history,
  }
  return teacherStore.reviewTaskStates[taskId]
}

/** 校级通知操作 */
export function setNoticeState(noticeId, patch) {
  const cur = teacherStore.notices[noticeId] || {}
  teacherStore.notices[noticeId] = { ...cur, ...patch }
  return teacherStore.notices[noticeId]
}

/** 回复学生问题 */
export function replyQuestion(questionId, reply) {
  teacherStore.questions[questionId] = {
    status: 'replied',
    reply,
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
  return teacherStore.questions[questionId]
}
