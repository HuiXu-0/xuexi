import { reactive } from 'vue'
import { demoStore } from './demo.js'

/**
 * 优秀案例的分项公开控制与推荐授权流程。
 *
 * 设计书 §5.6.5：作者可以分别设置 8 类内容的公开状态，
 * 其中原理文档、源代码、联系方式、成员名单「默认不自动公开」。
 * §5.6.6：教师推荐不等于学生自动授权 ——
 * 未经完整展示许可时，不得默认上传详细文档，图片也不能未经授权自动公开。
 *
 * 数据统一放在 demoStore（stores/demo.js）里，
 * 避免出现两个同名 demoStore 导致读写到不同对象。
 */

/** §5.6.5 的 8 类可独立控制的内容 */
export const caseSections = [
  { key: 'summary', label: '标题与摘要', def: 'ask', hint: '案例的基本信息，默认由作者确认后公开。' },
  { key: 'cover', label: '项目封面 / 成果图片', def: 'ask', hint: '图片不能未经授权自动公开。' },
  { key: 'video', label: '演示视频', def: 'ask', hint: '视频体积较大，建议确认后再上传。' },
  { key: 'detail', label: '原理与实现详解', def: 'hidden', hint: '默认不自动公开，避免未发表的细节外泄。' },
  { key: 'doc', label: '文档或附件', def: 'hidden', hint: '默认不自动公开。' },
  { key: 'code', label: '源代码 / 设计文件链接', def: 'hidden', hint: '默认不自动公开。' },
  { key: 'contact', label: '联系方式', def: 'hidden', hint: '默认不公开个人联系方式，优先使用站内联系。' },
  { key: 'members', label: '成员名单与分工', def: 'hidden', hint: '仅在相关成员授权后显示。' },
]

/** 分项公开状态的含义 */
export const sectionStates = {
  ask: { label: '待作者确认', tone: 'amber', desc: '尚未确认，默认不展示。' },
  show: { label: '公开', tone: 'green', desc: '已确认公开。' },
  hidden: { label: '不公开', tone: 'gray', desc: '作者选择不展示这一项。' },
}

/**
 * 案例授权状态机（§5.6.6 第 2~6 步）。
 * 只有到达 authorized 状态，推荐内容才能按批准范围发布。
 */
export const recommendStates = {
  none: { label: '未发起推荐', tone: 'gray', desc: '该案例尚无教师推荐申请。' },
  pending: { label: '等待学生确认', tone: 'amber', desc: '推荐申请已发送，等待作者确认展示范围。' },
  accepted: { label: '已接受推荐', tone: 'green', desc: '作者已接受推荐，按批准范围展示。' },
  modified: { label: '已接受并调整范围', tone: 'green', desc: '作者接受推荐但修改了部分公开项。' },
  rejected: { label: '已拒绝', tone: 'red', desc: '作者拒绝本次推荐申请。' },
  revoked: { label: '已撤回授权', tone: 'amber', desc: '作者撤回了尚未授权继续展示的内容。' },
}

/**
 * 案例授权流程：{ [caseId]: { state, sections, note, updatedAt } }
 * 教师推荐申请记录。
 * 两者都放在 demoStore 里，与其它演示状态同源。
 */
demoStore.caseAuthorizations = demoStore.caseAuthorizations || {}
demoStore.recommendRequests = demoStore.recommendRequests || []

/** 读取某个案例的授权状态，没有则返回默认 */
export function getAuthorization(caseId) {
  return (
    demoStore.caseAuthorizations[caseId] || {
      state: 'none',
      sections: Object.fromEntries(caseSections.map((s) => [s.key, s.def])),
      note: '',
      updatedAt: '',
    }
  )
}

/**
 * 教师发起推荐申请。
 * 只发起申请，不代表内容已获授权 —— 严格遵循 §5.6.6。
 */
export function createRecommendRequest({ caseId, caseTitle, teacher, reason, sections }) {
  const req = {
    id: `REC-${String(demoStore.recommendRequests.length + 1).padStart(3, '0')}`,
    caseId,
    caseTitle,
    teacher,
    reason,
    /* 拟展示的内容项，供学生逐项确认 */
    sections: sections || {},
    state: 'pending',
    createdAt: new Date().toISOString().slice(0, 10),
  }
  demoStore.recommendRequests.unshift(req)
  demoStore.caseAuthorizations[caseId] = {
    state: 'pending',
    sections: { ...getAuthorization(caseId).sections, ...req.sections },
    note: '',
    updatedAt: req.createdAt,
  }
  return req
}

/**
 * 学生确认授权。
 * @param {string} caseId
 * @param {object} sections 逐项公开状态
 * @param {'accepted'|'rejected'} decision
 */
export function confirmAuthorization(caseId, sections, decision = 'accepted') {
  const prev = getAuthorization(caseId)
  const changed = Object.keys(sections).some((k) => prev.sections[k] !== sections[k])
  const state = decision === 'rejected' ? 'rejected' : changed ? 'modified' : 'accepted'

  demoStore.caseAuthorizations[caseId] = {
    state,
    sections: { ...prev.sections, ...sections },
    note: '',
    updatedAt: new Date().toISOString().slice(0, 10),
  }

  const req = demoStore.recommendRequests.find((r) => r.caseId === caseId)
  if (req) req.state = state

  return demoStore.caseAuthorizations[caseId]
}

/** 作者撤回尚未授权继续展示的内容（§5.6.6 第 7 步） */
export function revokeAuthorization(caseId, sectionKeys) {
  const prev = getAuthorization(caseId)
  const sections = { ...prev.sections }
  sectionKeys.forEach((k) => {
    sections[k] = 'hidden'
  })
  demoStore.caseAuthorizations[caseId] = {
    ...prev,
    state: 'revoked',
    sections,
    updatedAt: new Date().toISOString().slice(0, 10),
  }
  return demoStore.caseAuthorizations[caseId]
}

/**
 * 判断某一项内容是否可以对外展示。
 * 未获授权（state 非 accepted/modified）时，除标题摘要外一律不展示 ——
 * 这正是设计书强调的「未经完整展示许可时不得默认上传详细文档」。
 */
export function isSectionVisible(caseId, sectionKey) {
  const auth = getAuthorization(caseId)
  const authorized = auth.state === 'accepted' || auth.state === 'modified'
  if (!authorized) {
    /* 未获推荐授权时，只有作者自己勾选公开的项才展示 */
    return auth.sections[sectionKey] === 'show'
  }
  return auth.sections[sectionKey] === 'show'
}
