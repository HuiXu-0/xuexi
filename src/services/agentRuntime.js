import { reactive } from 'vue'
import {
  AGENT_KEYS,
  AGENT_STATUS,
  agentMeta,
  emptyEnvelope,
} from './agentContract.js'
import { agentRequest, ApiError } from './api.js'

/**
 * Agent 运行时。
 *
 * 现在是**真实调用**（设计书 §16.2）：请求打到后端，
 * 返回设计书 §8.2 的 envelope。上层组件只认 envelope 的形状，
 * 所以接真后端不需要改界面。
 *
 * 后端不可达时返回 safe_fallback 的空 envelope ——
 * **不假装成功**（设计书 §9.4 的失败安全）。
 */

/** 每个 Agent 的调用状态 */
export const agentRuntime = reactive({
  search: { status: 'idle', lastRequest: null, lastResponse: null, error: '' },
  moderation: { status: 'idle', lastRequest: null, lastResponse: null, error: '' },
  planner: { status: 'idle', lastRequest: null, lastResponse: null, error: '' },
})

/**
 * 调用 Agent。
 *
 * @param {string} agentKey AGENT_KEYS 之一
 * @param {object} payload 业务参数
 * @returns {Promise<object>} 设计书 §8.2 的 envelope
 */
export async function runAgent(agentKey, payload = {}) {
  const state = agentRuntime[agentKey]
  if (!state) {
    return emptyEnvelope(agentKey)
  }

  state.status = 'loading'
  state.error = ''
  state.lastRequest = { agentKey, payload, issuedAt: new Date().toISOString() }

  try {
    const envelope = await agentRequest(agentKey, payload)
    state.status = 'ready'
    state.lastResponse = envelope
    return envelope
  } catch (err) {
    state.status = 'error'
    state.error = err?.message || '调用失败'
    const fallback = emptyEnvelope(
      agentKey,
      err instanceof ApiError
        ? `后端接口不可用（${err.message}），已退回本地静态数据。`
        : 'Agent 调用失败，已退回本地静态数据。',
    )
    state.lastResponse = fallback
    return fallback
  }
}

/** 读取某个 Agent 的元信息 */
export function getAgentMeta(agentKey) {
  return agentMeta[agentKey] || null
}

/** 全部 Agent 的元信息列表 */
export function listAgents() {
  return Object.values(agentMeta)
}

export { AGENT_KEYS, AGENT_STATUS }
