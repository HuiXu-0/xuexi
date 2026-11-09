import { reactive } from 'vue'
import {
  AGENT_KEYS,
  agentMeta,
  buildAgentRequest,
  emptyAgentResponse,
} from './agentContract.js'

/**
 * Agent 运行时（预留层）。
 *
 * ⚠️ 这里**不实现任何 Agent 逻辑** —— 设计书 §8 的三个 Agent 具体怎么构建，
 *    由后续方案确定。本文件只负责：
 *      1. 统一调用入口 runAgent()
 *      2. 记录调用状态，供界面显示「处理中 / 已完成 / 未接入 / 异常」
 *      3. 预留真实接入点：把 runAgent() 里的实现替换成真实请求即可，
 *         上层组件（搜索结果、审核流程、规划页）完全不用改。
 *
 * 当前实现：返回一个明确标注「未接入」的空响应，
 * 保证界面能先把结构搭好，真实 Agent 接上后行为自然切换。
 */

/** 每个 Agent 的调用状态 */
export const agentRuntime = reactive({
  search: { status: 'idle', lastRequest: null, lastResponse: null, error: '' },
  moderation: { status: 'idle', lastRequest: null, lastResponse: null, error: '' },
  planner: { status: 'idle', lastRequest: null, lastResponse: null, error: '' },
})

/**
 * 调用 Agent 的统一入口。
 *
 * 真实接入示例（将来）：
 *   const res = await fetch('/api/agent/search', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(buildAgentRequest(AGENT_KEYS.search, { query })),
 *   })
 *   return res.json()
 *
 * @param {string} agentKey AGENT_KEYS 之一
 * @param {object} payload  业务参数
 * @returns {Promise<object>} 统一形状的响应，见 agentContract.emptyAgentResponse
 */
export async function runAgent(agentKey, payload = {}) {
  const state = agentRuntime[agentKey]
  if (!state) {
    return emptyAgentResponse(agentKey)
  }

  const request = buildAgentRequest(agentKey, payload)
  state.status = 'loading'
  state.error = ''
  state.lastRequest = request

  try {
    /*
     * ===== 真实 Agent 接入点 =====
     * 把下面这行替换成真实请求即可，上层无需改动。
     */
    const response = emptyAgentResponse(agentKey)

    state.status = 'ready'
    state.lastResponse = response
    return response
  } catch (err) {
    state.status = 'error'
    state.error = err?.message || '调用失败'
    const fallback = emptyAgentResponse(agentKey)
    fallback.status = 'error'
    fallback.message = 'Agent 调用失败，已回退到普通功能结果。'
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

export { AGENT_KEYS }
