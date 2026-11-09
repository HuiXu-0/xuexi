/**
 * Agent 调用契约（预留层）。
 *
 * 设计书 §8 定义了三个职责独立的 Agent：
 *   A 全局搜索与发现 Agent　§8.2
 *   B 内容审核 Agent　　　　§8.3
 *   C 个人学习规划 Agent　　§8.4
 *
 * 共同原则（§8.1）：
 *   1. 只使用用户有权访问的内容
 *   2. 不编造不存在的课程、案例、竞赛、链接或官方信息
 *   3. 清晰区分平台真实内容、外部来源信息和模型生成的建议
 *   4. 高风险或不确定结果要提示用户核实或转人工处理
 *   5. 不自行提升权限、不自行改变平台规则、不自行封禁用户
 *   6. 对涉及用户内容的处理遵守平台可见范围和隐私规则
 *   7. 用户可反馈错误结果、误判或不合适的推荐
 *
 * ⚠️ 本文件只定义**接口形状**，不实现任何 Agent 逻辑。
 * 后续接入真实 Agent 时，只需在 agentRuntime.js 中实现 runAgent()，
 * 上层组件无需改动 —— 这就是预留的目的。
 */

/** Agent 标识，与设计书 §8 的三个 Agent 对应 */
export const AGENT_KEYS = {
  search: 'search',
  moderation: 'moderation',
  planner: 'planner',
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
 * 调用 Agent 的统一入参。
 * @param {string} agentKey AGENT_KEYS 之一
 * @param {object} payload  业务参数（搜索词、内容、规划输入等）
 */
export function buildAgentRequest(agentKey, payload = {}) {
  return {
    agentKey,
    payload,
    /* 调用上下文：真实接入时后端需要据此做权限校验 */
    context: {
      role: 'student',
      visibleScope: 'public',
      requestId: `demo-${Date.now()}`,
    },
    /* 时间戳便于后端日志与耗时统计 */
    issuedAt: new Date().toISOString(),
  }
}

/**
 * 调用 Agent 的统一返回值形状。
 * 前端只依赖这个形状，具体实现替换时界面无需改动。
 */
export function emptyAgentResponse(agentKey) {
  return {
    agentKey,
    status: 'unavailable',
    /* 是否由真实 Agent 处理；原型阶段为 false，界面会显示"未接入" */
    handledByAgent: false,
    /* 真实内容条目（必须对应平台中真实存在且用户有权访问的条目） */
    items: [],
    /* 模型的解释性说明，与 items 分离，便于界面标注"这是生成建议" */
    notes: '',
    /* Agent 给出的后续建议，例如"放宽筛选""探索相近标签" */
    suggestions: [],
    /* 需要转人工处理时的提示 */
    needsHumanReview: false,
    message: '当前原型未接入该 Agent，以下为普通功能结果。',
  }
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
