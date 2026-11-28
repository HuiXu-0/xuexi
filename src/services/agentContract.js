/**
 * Agent 调用契约。
 *
 * 设计书 §8 定义了三个职责独立的 Agent：
 *   A 全局搜索与发现 Agent　§8.2
 *   B 内容审核 Agent　　　　§8.3
 *   C 个人学习规划 Agent　　§8.4
 *
 * ## 响应形状以设计书 §8.2 的 envelope 为准
 *
 *     {
 *       request_id: "req_xxx",
 *       agent: "search_agent",
 *       status: "success",
 *       data: {},
 *       warnings: [],
 *       trace_id: "trace_xxx"
 *     }
 *
 * status 六种（设计书 §8.2）：
 *   success           正常完成
 *   partial           部分完成（有降级或部分结果缺失）
 *   needs_user_input  需要用户补充信息
 *   pending_review    需要人工复核
 *   failed            **内容被拒 / 调用失败**
 *   safe_fallback     **服务不可用，已按安全策略降级**
 *
 * **failed 与 safe_fallback 必须分开渲染**（设计书 §8.2.1）：
 * 前者是「内容有问题」，后者是「服务挂了」。混成同一个提示，
 * 就是在跟用户说错话。
 */

/** Agent 标识，与设计书 §8 的三个 Agent 对应 */
export const AGENT_KEYS = {
  search: 'search',
  moderation: 'moderation',
  planner: 'planner',
}

/** 后端返回的 agent 字段取值 */
export const AGENT_NAMES = {
  search: 'search_agent',
  moderation: 'moderation_agent',
  planner: 'learning_planning_agent',
}

/** envelope 的六种 status */
export const AGENT_STATUS = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  NEEDS_USER_INPUT: 'needs_user_input',
  PENDING_REVIEW: 'pending_review',
  FAILED: 'failed',
  SAFE_FALLBACK: 'safe_fallback',
}

/**
 * Agent 元信息。
 * 这些文案直接来自设计书，界面上要如实展示职责与边界，
 * 不能夸大能力（例如不得暗示 Agent 的判定绝对准确）。
 */
export const agentMeta = {
  search: {
    key: 'search',
    icon: 'i-search',
    title: '全局搜索与发现 Agent',
    short: '搜索 Agent',
    purpose: '理解自然语言目标，组织来自平台真实条目的跨类型搜索结果。',
    boundary: '不生成不存在的资源，不泄露用户无权访问的私密内容。',
    principle: '理解意图 → 扩展相关概念 → 组织跨类别结果，全部基于平台真实条目。',
  },
  moderation: {
    key: 'moderation',
    icon: 'i-shield',
    title: '内容审核 Agent',
    short: '审核 Agent',
    purpose: '对首批文字字段做初步风险识别，提出放行、人工复核或拒绝建议。',
    boundary: '审核结果不直接触发封禁等高影响处罚，最终由有权限的管理员决定。',
    principle: '辱骂骚扰、垃圾广告、恶意链接、敏感信息、疑似侵权等风险类别的初筛。',
  },
  planner: {
    key: 'planner',
    icon: 'i-spark',
    title: '个人学习规划 Agent',
    short: '规划 Agent',
    purpose: '帮助厘清目标、判断当前基础、制定分阶段计划并关联真实站内资源。',
    boundary: '提供学习建议，不替代教师说明，不承诺竞赛获奖或职业结果。',
    principle: '信息不足时明确说明假设；平台无对应资源时如实告知，不伪造链接。',
  },
}

/**
 * 构造一个空 envelope。
 *
 * 后端不可达时用它兜底 —— 界面照常能渲染，
 * 只是明确标成 safe_fallback，而不是假装一切正常。
 */
export function emptyEnvelope(agentKey, reason = '后端服务当前不可用，已按本地规则处理。') {
  return {
    request_id: `local-${Date.now()}`,
    agent: AGENT_NAMES[agentKey] || agentKey,
    status: AGENT_STATUS.SAFE_FALLBACK,
    data: {
      fallback: true,
      reason,
      actual_behavior: '已退回本地静态数据，结果可能不完整',
    },
    warnings: [reason],
    trace_id: `local-${Date.now()}`,
  }
}

/**
 * 状态的中文说明。
 *
 * **failed 与 safe_fallback 的文案必须不同**（设计书 §8.2.1）。
 */
export const statusText = {
  success: '已完成',
  partial: '部分完成',
  needs_user_input: '需要你补充信息',
  pending_review: '已转人工复核',
  failed: '未通过',
  safe_fallback: '服务降级',
}

/** 把 envelope 里的结果条目取出来（不同 Agent 的 data 结构不同） */
export function extractItems(envelope) {
  if (!envelope?.data) return []
  const d = envelope.data
  if (Array.isArray(d)) return d
  if (Array.isArray(d.items)) return d.items
  if (Array.isArray(d.groups)) {
    return d.groups.flatMap((g) => g.items || [])
  }
  return []
}

/**
 * Agent 承载区说明 —— 界面上用来说明「这块将来放 Agent」。
 * 不写死任何实现，只描述这块区域承担什么职责。
 */
export const agentSlotDescription = {
  search: '搜索结果由搜索 Agent 负责组织：它理解自然语言意图、扩展相关概念，并把平台真实条目按类别组织起来。',
  moderation: '发布前的风险初筛由审核 Agent 负责，结果分放行、待人工复核、拒绝三类；高影响处罚仍由管理员决定。',
  planner: '阶段计划由规划 Agent 负责生成，推荐的笔记、资源、案例必须是平台中真实存在且当前用户有权查看的内容。',
}
