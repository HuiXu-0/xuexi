/**
 * 后端 API 服务层。
 *
 * 设计书 §16「前端与后端的衔接」：前端从「自带静态数据」改为「调后端接口」，
 * 这一层负责把 HTTP 细节收拢，业务代码只关心数据。
 *
 * ## 后端地址
 * 站点部署在 GitHub Pages（静态），后端跑在本机 8000 端口，
 * 所以地址来自环境变量 `VITE_API_BASE`，默认 `http://127.0.0.1:8000`。
 * 换部署环境时改 `.env` 即可，不用动代码。
 *
 * ## 登录态怎么来
 * 登录页目前只让用户选角色（原型交互），没有账号密码。
 * 这里把**角色映射到后端的演示账号**，需要调接口时自动换一枚 JWT：
 *
 *     学生 → student@campus.test
 *     教师 → teacher@campus.test
 *     管理员 → admin@campus.test
 *
 * 注意：这只是把「界面上的角色」换成「后端认的账号」，
 * **权限判定全在后端**（permission_service）—— 前端传的任何一个身份声明都不可信。
 * token 按角色缓存，后端撤销权限后重新登录即可生效。
 */

import { authStore } from '../stores/auth.js'

export const API_BASE =
  (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '')

/** 角色 → 后端演示账号 */
const DEMO_ACCOUNTS = {
  student: 'student@campus.test',
  teacher: 'teacher@campus.test',
  admin: 'admin@campus.test',
}
const DEMO_PASSWORD = 'campus2026'

/** token 缓存：按角色存，切换角色时自动换 */
const tokenCache = new Map()

/** 后端不可达时的提示（不抛异常，让调用方决定降级） */
export class ApiError extends Error {
  constructor(message, { status = 0, code = '', retryable = false, traceId = '' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryable = retryable
    this.traceId = traceId
  }
}

/** 取当前角色对应的 token，没有就登录一次 */
export async function ensureToken() {
  const role = authStore.role || 'student'
  if (tokenCache.has(role)) return tokenCache.get(role)

  const account = DEMO_ACCOUNTS[role] || DEMO_ACCOUNTS.student
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password: DEMO_PASSWORD }),
  })
  if (!res.ok) {
    throw new ApiError('后端登录失败', { status: res.status })
  }
  const data = await res.json()
  tokenCache.set(role, data.access_token)
  return data.access_token
}

/** 清掉 token 缓存（后端改了密钥或撤销权限时用） */
export function resetToken() {
  tokenCache.clear()
}

/**
 * 调后端接口。
 *
 * @param {string} path 以 / 开头的路径
 * @param {object} options { method, body, auth, timeout }
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body = null, auth = true, timeout = 30000 } = options

  const headers = { Accept: 'application/json' }
  if (body !== null) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = await ensureToken()
    headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') {
      throw new ApiError('请求超时', { retryable: true })
    }
    throw new ApiError('无法连接后端服务', { retryable: true })
  }
  clearTimeout(timer)

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch (_) {
      data = null
    }
  }

  if (!res.ok) {
    const err = data?.error || {}
    throw new ApiError(err.message || `请求失败（${res.status}）`, {
      status: res.status,
      code: err.code || '',
      retryable: !!err.retryable,
      traceId: err.trace_id || '',
    })
  }
  return data
}

/**
 * 调 Agent 接口。
 *
 * 后端统一返回设计书 §8.2 的 envelope：
 *   { request_id, agent, status, data, warnings, trace_id }
 *
 * @param {string} agentKey search | moderation | planner
 * @param {object} payload 业务参数
 */
export async function agentRequest(agentKey, payload = {}) {
  const routes = {
    search: { path: '/api/agents/search', method: 'POST' },
    moderation: { path: '/api/moderation/check', method: 'POST' },
    planner: { path: '/api/agents/learning-plans/generate', method: 'POST' },
  }
  const route = routes[agentKey]
  if (!route) throw new ApiError(`未知的 Agent：${agentKey}`)

  const body = agentKey === 'planner' ? payload : { query: '', ...payload }
  return apiFetch(route.path, { method: route.method, body })
}

/** 后端是否可用（管理端「模型服务」页用它显示连接状态） */
export async function pingBackend() {
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    if (!res.ok) return { ok: false, message: `后端返回 ${res.status}` }
    const data = await res.json()
    return { ok: true, ...data }
  } catch (_) {
    return { ok: false, message: '无法连接后端服务' }
  }
}
