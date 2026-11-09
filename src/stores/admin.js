import { reactive } from 'vue'
import { authStore } from './auth.js'

/**
 * 管理员端统一动作层。
 *
 * 设计书 §7.2.2 原文：
 *   「涉及角色变化、内容删除恢复、封禁解封、规则更新的操作需要记录：
 *     操作者、时间、对象、操作类型、原因、结果，以及必要的关联案件编号。」
 *   「高影响操作应确认、说明理由，必要时支持申诉。」
 *
 * 之前管理员端各模块各自 showToast('演示：...')，点了按钮什么都不发生，
 * 也没有任何留痕 —— 这等于没有实现。
 *
 * 这里把所有管理动作收敛到一个入口：
 *   applyAdminAction({ type, target, reason, caseNo, mutate })
 *   - type   动作类型（决定审计分类与是否强制填理由）
 *   - target 操作对象（人 / 内容 / 规则）
 *   - reason 处理理由 —— 高影响动作为空直接拒绝执行
 *   - caseNo 关联案件编号
 *   - mutate 真正改变状态的回调
 *
 * 动作执行后自动写入审计记录，审计页直接读这里，不需要各模块自己记。
 */

/* ---------- 动作类型定义 ---------- */
/**
 * impact:
 *   normal   普通操作，理由可填
 *   high     高影响操作，**必须**填写理由，否则拒绝执行
 */
export const adminActionTypes = {
  assign: {
    label: '分配角色权限',
    auditType: 'role',
    impact: 'high',
    reasonHint: '请说明授予该权限的依据（课程、职责或授权文件）。',
  },
  revoke: {
    label: '撤销角色权限',
    auditType: 'role',
    impact: 'high',
    reasonHint: '请说明撤销权限的原因与生效范围。',
  },
  restrict: {
    label: '限制功能',
    auditType: 'account',
    impact: 'high',
    reasonHint: '请说明限制发布的具体原因与期限。',
  },
  release: {
    label: '解除限制',
    auditType: 'account',
    impact: 'normal',
    reasonHint: '可说明解除依据。',
  },
  ban: {
    label: '暂时封禁',
    auditType: 'account',
    impact: 'high',
    reasonHint: '请说明封禁依据。单次低风险问题不应永久封禁。',
  },
  unban: {
    label: '解封',
    auditType: 'account',
    impact: 'high',
    reasonHint: '请说明解封依据与是否恢复原有权限。',
  },
  appeal: {
    label: '申诉受理',
    auditType: 'account',
    impact: 'normal',
    reasonHint: '可说明受理结论。',
  },
  hide: {
    label: '暂时隐藏',
    auditType: 'content',
    impact: 'normal',
    reasonHint: '可说明隐藏原因。',
  },
  restore: {
    label: '恢复内容',
    auditType: 'content',
    impact: 'normal',
    reasonHint: '可说明恢复原因。',
  },
  remove: {
    label: '下架内容',
    auditType: 'content',
    impact: 'high',
    reasonHint: '请说明命中哪条规则，以及是否允许申诉。',
  },
  ruleUpdate: {
    label: '更新审核规则',
    auditType: 'rule',
    impact: 'high',
    reasonHint: '请说明规则调整原因，以及如何避免误判增加。',
  },
  ruleDisable: {
    label: '停用规则',
    auditType: 'rule',
    impact: 'high',
    reasonHint: '请说明停用原因与替代处置方式。',
  },
  ruleRollback: {
    label: '回滚规则',
    auditType: 'rule',
    impact: 'high',
    reasonHint: '请说明回滚原因与目标版本。',
  },
  agentToggle: {
    label: '调整 Agent 配置',
    auditType: 'agent',
    impact: 'high',
    reasonHint: '请说明调整原因与影响范围。',
  },
  noticePublish: {
    label: '发布官方通知',
    auditType: 'publish',
    impact: 'normal',
    reasonHint: '可说明发布依据。',
  },
  noticeWithdraw: {
    label: '撤回官方通知',
    auditType: 'publish',
    impact: 'high',
    reasonHint: '请说明撤回原因，避免用户依据错误信息行动。',
  },
  noticeArchive: {
    label: '归档官方通知',
    auditType: 'publish',
    impact: 'normal',
    reasonHint: '可说明归档原因。',
  },
  configChange: {
    label: '修改平台配置',
    auditType: 'config',
    impact: 'high',
    reasonHint: '请说明调整内容与既有内容的迁移方式。',
  },
  feedbackAssign: {
    label: '分配负责人',
    auditType: 'feedback',
    impact: 'normal',
    reasonHint: '可说明分配依据。',
  },
  feedbackResolve: {
    label: '反馈处理完成',
    auditType: 'feedback',
    impact: 'normal',
    reasonHint: '请说明验证结果与回复内容。',
  },
  workAssign: {
    label: '分配事项负责人',
    auditType: 'work',
    impact: 'normal',
    reasonHint: '可说明分配依据。',
  },
  workReview: {
    label: '标记正在核实',
    auditType: 'work',
    impact: 'normal',
    reasonHint: '可说明核实方向。',
  },
  workResolve: {
    label: '处理完成',
    auditType: 'work',
    impact: 'normal',
    reasonHint: '请说明处理结论与依据。',
  },
}

/* ---------- 状态 ---------- */
export const adminStore = reactive({
  /** 审计记录（含演示数据与本次会话产生的） */
  auditRecords: [],
  /** 账号运行时状态：{ [id]: { status, scope, violations, restrictions } } */
  accounts: {},
  /** 事项运行时状态：{ [id]: { status, owner, resolved } } */
  workItems: {},
  /** 举报处置状态：{ [id]: { state, reason, at } } */
  reportStates: {},
  /** 反馈状态：{ [id]: { state, owner, reply, at } } */
  feedbackStates: {},
  /** 规则状态：{ [id]: { state, version, history } } */
  ruleStates: {},
  /** 配置项状态：{ [id]: { state, note, migration } } */
  configStates: {},
  /** 通知状态：{ [id]: { state, changes } } */
  noticeStates: {},
  /** Agent 配置：{ [key]: { enabled, scope, threshold } } */
  agentConfigs: {},
})

let auditSeq = 0

/* ---------- 审计 ---------- */
/**
 * 写一条审计记录。
 * 返回记录本身，方便界面立即回显。
 */
export function writeAudit({ type, target, action, reason, result, caseNo = '' }) {
  const now = new Date()
  const at =
    now.toISOString().slice(0, 10) +
    ' ' +
    now.toTimeString().slice(0, 5)
  const record = {
    id: `AUD-${String(++auditSeq).padStart(3, '0')}`,
    type,
    operator: authStore.displayName || '管理员演示账号',
    target,
    action,
    reason,
    result,
    caseNo,
    at,
    /* 本次会话新增的记录排在最前 */
    isNew: true,
  }
  adminStore.auditRecords.unshift(record)
  return record
}

/* ---------- 统一动作入口 ---------- */
/**
 * 执行一个管理动作。
 *
 * @param {object} opts
 * @param {string} opts.type      动作类型，见 adminActionTypes
 * @param {string} opts.target    操作对象（展示用）
 * @param {string} [opts.reason]  处理理由 —— 高影响动作必填
 * @param {string} [opts.caseNo]  关联案件编号
 * @param {Function} [opts.mutate] 真正改变状态的回调，返回处理结果文案
 * @returns {{ ok: boolean, message?: string, record?: object }}
 */
export function applyAdminAction({ type, target, reason = '', caseNo = '', mutate } = {}) {
  const def = adminActionTypes[type]
  if (!def) {
    return { ok: false, message: '未知的操作类型，正式平台不应出现这种情况。' }
  }

  const trimmed = String(reason).trim()

  /* 高影响操作必须填写理由 —— 这是设计书 §7.2.2 的硬要求 */
  if (def.impact === 'high' && !trimmed) {
    return { ok: false, message: `${def.label}属于高影响操作，必须填写处理理由。${def.reasonHint}` }
  }

  const result = mutate ? mutate() : ''

  const record = writeAudit({
    type: def.auditType,
    target,
    action: def.label,
    reason: trimmed || '未填写理由',
    result: result || '已执行',
    caseNo,
  })

  return { ok: true, message: `${def.label}已完成，操作已记入审计日志（${record.id}）。`, record }
}

/* ---------- 便捷读取 ---------- */
/** 全部审计记录：演示数据在前，本次会话新增的在前 */
export function allAuditRecords(extra = []) {
  return [...adminStore.auditRecords, ...extra]
}
