import router from '../router/index.js'
import { demoStore } from './demo.js'
import { showToast } from '../composables/useToast.js'

/**
 * 本地“新建”动作：只写入内存中的 demoStore，随后跳转到对应模块并提示。
 * 与原 HTML 原型一致 —— 不上传、不持久化。
 */

export function addDemoGroup(values, origin) {
  demoStore.groups.unshift({ ...values, origin })
  router.push({ name: 'forum' })
  showToast('已创建本地演示小组；真实平台还需校验创建权限与可见范围。')
}

export function addDemoPost(values) {
  demoStore.posts.unshift(values)
  router.push({ name: 'forum' })
  showToast('已添加本地演示讨论；不会发送到服务器。')
}

export function addDemoNote(values) {
  demoStore.notes.unshift(values)
  router.push({ name: 'notes' })
  showToast('已创建本地演示笔记。正式版还需执行授权检查和内容审核流程。')
}

export function addDemoResource(values) {
  demoStore.resources.unshift(values)
  router.push({ name: 'resources' })
  showToast('已添加本地资源条目；尚未验证来源链接或授权情况。')
}

export function addDemoCompetition(values) {
  demoStore.competitions.unshift(values)
  router.push({ name: 'competitions' })
  showToast('已提交本地竞赛线索；未核实前不会视为正式日程。')
}

export function addDemoCase(values) {
  demoStore.cases.unshift(values)
  router.push({ name: 'cases' })
  showToast('已创建本地演示案例；共同作者授权与各部分展示范围仍需确认。')
}

export function addDemoRecommendation(values) {
  demoStore.recommendations.unshift(values)
  demoStore.teacherPendingCount += 1
  router.push({ name: 'teacher' })
  showToast('已建立本地推荐邀请；不会自动公开案例，仍需作者确认。')
}

/** ModalHost 表单提交时按 kind 分派 */
export function handleCreateSubmit(kind, values) {
  if (kind === 'group') addDemoGroup(values, 'student')
  else if (kind === 'teacherGroup') addDemoGroup(values, 'teacher')
  else if (kind === 'post') addDemoPost(values)
  else if (kind === 'note') addDemoNote(values)
  else if (kind === 'resource') addDemoResource(values)
  else if (kind === 'competition') addDemoCompetition(values)
  else if (kind === 'case') addDemoCase(values)
  else if (kind === 'recommendation') addDemoRecommendation(values)
}
