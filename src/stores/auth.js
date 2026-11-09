import { reactive, computed } from 'vue'
import { roleMeta, navByRole } from '../data/dict.js'

/**
 * 登录态与当前角色。
 *
 * 角色在**登录界面**选择，登录后即固定 —— 它决定可见导航、可访问页面
 * 和各页面的操作权限。之前把角色切换放在平台页顶栏，任何人都能直接跳到
 * 教师端/管理员端，这不符合设计书 §4 的三端分权结构。
 */
export const authStore = reactive({
  /** 是否已登录 */
  loggedIn: false,
  /** 当前角色：student | teacher | admin */
  role: 'student',
  /** 演示账号显示名 */
  displayName: '学生演示账号',
  /** 是否为内容管理员（教师端「首页内容管理」仅对获授权角色开放，见 §4.2） */
  contentAdmin: false,
  /**
   * 是否被授予内容审核职责（§6.4）。
   * 设计书权限矩阵里「教师」这一档内部还要再分：
   * 有没有审核职责、有没有校级内容管理权 —— 两项权限互不包含。
   * 审核任务队列只在有该职责时出现（§6.1.2「仅在有审核权限时显示」）。
   */
  canReview: false,
})

/** 登录 */
export function signIn({ role, displayName, contentAdmin, canReview }) {
  authStore.loggedIn = true
  authStore.role = role || 'student'
  authStore.displayName = displayName?.trim() || `${roleMeta(authStore.role).label}演示账号`
  /*
   * 演示约定：教师角色可在登录时勾选两项独立授权。
   * 设计书 §4.2 要求不具备权限的普通教师不应看到可操作的校级公告管理入口；
   * §6.4 要求审核任务只在授权范围内出现。
   */
  authStore.contentAdmin = !!contentAdmin
  authStore.canReview = !!canReview
  try {
    localStorage.setItem('campus-auth', JSON.stringify({
      role: authStore.role,
      displayName: authStore.displayName,
      contentAdmin: authStore.contentAdmin,
      canReview: authStore.canReview,
    }))
  } catch (_) {}
  return authStore
}

/** 退出登录，回到登录界面 */
export function signOut() {
  authStore.loggedIn = false
  authStore.role = 'student'
  authStore.displayName = '学生演示账号'
  authStore.contentAdmin = false
  authStore.canReview = false
  try {
    localStorage.removeItem('campus-auth')
  } catch (_) {}
}

/** 恢复上次的登录态（刷新页面不丢失角色） */
export function restoreAuth() {
  try {
    const raw = localStorage.getItem('campus-auth')
    if (!raw) return
    const saved = JSON.parse(raw)
    if (saved?.role) {
      authStore.loggedIn = true
      authStore.role = saved.role
      authStore.displayName = saved.displayName || '演示账号'
      authStore.contentAdmin = !!saved.contentAdmin
      authStore.canReview = !!saved.canReview
    }
  } catch (_) {}
}

/** 当前角色的导航配置 */
export const currentNav = computed(() => navByRole[authStore.role] || navByRole.student)

/**
 * 角色是否有权访问某个路由。
 * 学生端页面全部可访问；教师端与管理员端只对对应角色开放。
 * 管理员拥有全部模块权限（含教师端的审核任务），符合最小权限前提下的职责范围。
 */
export function canAccess(routeName) {
  if (!routeName) return true
  const studentRoutes = ['home', 'forum', 'notes', 'competitions', 'resources', 'cases', 'planner', 'profile']
  const teacherRoutes = ['teacher', 'teacherGroups', 'teacherReviews', 'teacherTasks', 'teacherContent']
  const adminRoutes = ['admin']

  if (teacherRoutes.includes(routeName)) return authStore.role === 'teacher' || authStore.role === 'admin'
  if (adminRoutes.includes(routeName)) return authStore.role === 'admin'
  return studentRoutes.includes(routeName)
}

/** 权限不足时的说明，用于路由守卫与页面内提示 */
export function denyReason(routeName) {
  if (routeName === 'admin') return '这是平台管理员端，需要账号具备相应授权才能访问。'
  if (routeName === 'teacherTasks') return '审核任务队列需要被授予内容审核职责后才能查看。'
  if (routeName === 'teacherContent') return '校级首页内容管理仅对获授权的学校内容管理员开放。'
  if (routeName?.startsWith('teacher')) return '这是教师端页面，需要教师角色才能访问。'
  return '当前角色没有访问该页面的权限。'
}
