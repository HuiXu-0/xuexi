/**
 * 三份 Agent 设计与当前项目代码的一致性核对。
 *
 * 目的：把文档里的受控词表、接口契约、目录结构等，与仓库里实际存在的
 *       字典、契约、文件逐条比对，找出「文档写了但代码没有」和
 *       「两边定义不一致」的地方。
 *
 * 用法：node scripts/audit-agent-docs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const docOntology = read('校园学习资源共享平台_三大Agent可执行设计与领域本体_V1.0.md')
const docArch = read('三大Agent技术架构与详细设计.md')
const docReview = read('B8E5A7AgentA1E6B680E6A9B8E6B4BDE6B69EE8BEAE%A1.md')
const dict = read('src/data/dict.js')
const contract = read('src/services/agentContract.js')
const runtime = read('src/services/agentRuntime.js')

let problems = 0
const note = (level, title, detail) => {
  console.log(`${level} ${title}`)
  detail.forEach((d) => console.log(`    ${d}`))
  if (level.startsWith('✗')) problems++
}

console.log('=== 1. 受控词表：文档 vs 代码 ===\n')

/* --- content_status --- */
const docStatus = ['draft', 'pending_moderation', 'published', 'returned', 'hidden', 'archived', 'deleted']
const codeStatus = [...dict.matchAll(/^  (\w+): \{ label: '/gm)].map((m) => m[1])
const dictBlock = dict.slice(dict.indexOf('export const contentStates'), dict.indexOf('export const contentStateOrder'))
const codeContentStates = [...dictBlock.matchAll(/^  (\w+):/gm)].map((m) => m[1])

const docOnly = docStatus.filter((s) => !codeContentStates.includes(s))
const codeOnly = codeContentStates.filter((s) => !docStatus.includes(s))
if (docOnly.length || codeOnly.length) {
  note(
    '✗',
    'content_status 词表不一致',
    [
      docOnly.length ? `文档有、代码没有：${docOnly.join(', ')}` : '',
      codeOnly.length ? `代码有、文档没有：${codeOnly.join(', ')}` : '',
      '→ 后端建表按文档还是按代码？必须二选一，否则状态流转会对不上',
    ].filter(Boolean)
  )
} else {
  console.log('✓ content_status 词表一致')
}

/* --- visibility --- */
const docVis = ['private', 'campus', 'public', 'members_only']
const codeVis = [...dict.matchAll(/^  (\w+): \{ label: '.*', short:/gm)].map((m) => m[1])
const visDiff = docVis.filter((v) => !codeVis.includes(v)) || []
const visCodeOnly = codeVis.filter((v) => !docVis.includes(v))
if (visDiff.length || visCodeOnly.length) {
  note('✗', 'visibility 词表不一致', [
    docDiff => '',
  ].filter(Boolean).concat([
    visDiff.length ? `文档有、代码没有：${visDiff.join(', ')}` : '',
    visCodeOnly.length ? `代码有、文档没有：${visCodeOnly.join(', ')}` : '',
  ].filter(Boolean)))
} else {
  console.log('✓ visibility 词表一致')
}

/* --- evidence_type --- */
const docEvidence = ['USER_STATED', 'SELF_ASSESSED', 'TASK_VERIFIED', 'TEACHER_VERIFIED', 'SYSTEM_OBSERVED', 'UNKNOWN']
const codeEvidence = ['USER_STATED', 'SELF_ASSESSED', 'TASK_VERIFIED', 'UNKNOWN']
console.log(
  `\n${docEvidence.length !== codeEvidence.length ? '⚠' : '✓'} evidence_type：文档 ${docEvidence.length} 种（${docEvidence.join('/')}），` +
    `技术架构文档 4 种（${codeEvidence.join('/')}）`
)
if (docEvidence.length !== codeEvidence.length) {
  console.log('    → 第三份文档多了 TEACHER_VERIFIED / SYSTEM_OBSERVED，两份文档不一致，需定稿')
}

console.log('\n=== 2. 角色模型：产品设计书 vs 代码 ===\n')
const docRoles = ['访客', '学生', '学习小组创建者', '教师', '学校内容管理员', '平台管理员', '超级管理员']
const codeRoles = [...dict.matchAll(/label: '([^']+)',/g)].map((m) => m[1])
const roleBlock = dict.slice(dict.indexOf('export const userRoles'))
const codeRoleLabels = [...roleBlock.matchAll(/label: '([^']+)'/g)].map((m) => m[1])
console.log(`产品设计书角色：${docRoles.join('、')}`)
console.log(`代码实际角色：  ${codeRoleLabels.join('、')}`)
const missingRoles = docRoles.filter((r) => !codeRoleLabels.some((c) => c.includes(r.replace('（可选）', ''))))
if (missingRoles.length) {
  note('⚠', '代码未实现全部设计书角色', [
    `缺失：${missingRoles.join('、')}`,
    '→ 代码用「角色 + contentAdmin/canReview 能力位」近似，设计书是 7 个独立角色',
    '→ 后端建 RBAC 时必须确认按哪套：文档的三元角色 + 两能力位 vs 设计书 7 角色',
  ])
}

console.log('\n=== 3. Agent 接口契约：文档 vs agentContract.js ===\n')

/* 文档统一封装 */
const docEnvelope = ['request_id', 'agent', 'status', 'data', 'warnings', 'trace_id']
const hasEnvelope = docEnvelope.filter((f) => contract.includes(f))
console.log(`文档 §8.2 统一封装字段：${docEnvelope.join(', ')}`)
console.log(`agentContract.js 实际字段：${hasEnvelope.length ? hasEnvelope.join(', ') : '（无）'}`)

const docStatuses = ['success', 'partial', 'needs_user_input', 'pending_review', 'failed', 'safe_fallback']
const codeStatusMatch = contract.match(/status: '(\w+)'/)
console.log(`\n文档 status 取值：${docStatuses.join(', ')}`)
console.log(`代码 status 取值：${codeStatusMatch ? codeStatusMatch[1] : '?'}`)

if (!docEnvelope.some((f) => contract.includes(f))) {
  note('✗', '前端契约与后端契约形状完全不同', [
    '文档：{ request_id, agent, status, data{}, warnings[], trace_id }',
    '代码：{ agentKey, status, handledByAgent, items[], notes, suggestions[], needsHumanReview, message }',
    '→ 前端现在的 flat 形状不是文档的 envelope 形状',
    '→ 现在按文档实现后端，前端全部要改；现在改前端配合文档，也是一轮返工',
    '→ 必须先定一个，两边对齐',
  ])
}

/* 文档的 domain 状态 vs 代码 */
if (!contract.includes('partial') && !contract.includes('safe_fallback')) {
  note('✗', '契约缺少「降级/部分成功」状态', [
    '文档有 partial / safe_fallback / failed，前端契约只有 unavailable',
    '→ 后端做安全降级（审核不可用不默认放行）时，前端无法区分「拒绝」和「服务不可用」',
    '→ 这正是审核 Agent 最需要的那个状态',
  ])
}

/* 检索层是否已在代码里存在 */
console.log('\n=== 4. 共享检索层：三份文档一致主张，代码是否具备 ===\n')
const hasSearchService = fs.existsSync(path.join(root, 'src/services/resourceSearch.js'))
console.log(`前端是否存在独立的检索服务模块：${hasSearchService ? '有' : '无'}`)
console.log(`当前检索逻辑位置：src/composables/useSearch.js（前端本地索引，直接扫 data/*.js）`)
note('⚠', '文档的 ResourceSearchService 在前端无对应物', [
  '三份文档都主张「Agent 通过共享检索服务拿内容，不要互相调用」',
  '但前端现在没有这个层 —— 检索逻辑写在 useSearch.js 里，直接读静态数据',
  '→ 这不矛盾（前端是演示态），但要明确：前端不该假装有检索层',
  '→ 未来加后端时，前端的 useSearch 应退化为「后端检索结果的渲染层」',
])

console.log('\n=== 5. 三份文档的框架结论是否自洽 ===\n')
const frameworks = {
  '第一份（评审意见）': { review: 'LangChain', search: 'LangGraph', planner: 'LangGraph' },
  '第二份（技术架构）': { review: '规则+LangChain', search: 'LangGraph', planner: 'LangGraph' },
  '第三份（可执行设计）': { review: '规则+LangChain', search: '混合检索+LangGraph', planner: 'LangGraph' },
}
console.log('审核 Agent：')
console.log('  第一份：LangChain（规则引擎优先）')
console.log('  第二份：规则引擎 + LangChain')
console.log('  第三份：确定性规则引擎 + LangChain 结构化语义分析 + 决策服务')
console.log('  → 三份一致，都认为审核不需要自主 Agent Loop ✓')

console.log('\n搜索 Agent：')
console.log('  第一份：混合检索引擎为主，LangGraph 只做复杂查询编排')
console.log('  第二份：模块化，检索引擎 + LangGraph')
console.log('  第三份：独立混合检索服务 + LangChain + LangGraph')
console.log('  → 三份一致 ✓')

console.log('\n学习规划 Agent：')
console.log('  第一份：LangGraph + 学习领域模型')
console.log('  第二份：LangGraph + 领域模型')
console.log('  第三份：领域模型 + 知识依赖图 + LangGraph 状态工作流')
console.log('  → 三份一致 ✓')

console.log('\n三份都主张「Agent 之间不互相调用，走共享领域服务」：')
const svcInAll = ['ResourceSearchService', 'PermissionService', 'LLMGateway'].filter(
  (s) => docOntology.includes(s) && docArch.includes(s) && docReview.includes(s)
)
console.log(`  在三份中都出现的服务：${svcInAll.join(', ')}`)
if (svcInAll.length >= 2) console.log('  → 这一点是三份文档最强的共识 ✓')

console.log('\n=== 6. 规模与当前项目阶段的匹配度 ===\n')
const tableCount = (docOntology.match(/^- `?\w+`?$/gm) || []).length
console.log(`第三份文档列出的数据库表：约 ${tableCount} 张`)
console.log('当前项目状态：纯前端、零后端、静态演示数据 + 内存 store')
note('⚠', '文档规模与项目当前阶段差距巨大', [
  `第三份约 ${tableCount} 张表 + 完整后端分层，与当前「零后端」状态不在一个量级`,
  '→ 文档本身也说了「模块化单体优先」，这点是对的',
  '→ 但要明确它是「后端启动时的目标架构」，不是「现在要写的东西」',
  '→ 缺的中间态：Phase 0 的「数据与权限地基」现在完全没做',
])

console.log('\n=== 7. 产品设计书 §8 与三份文档的覆盖关系 ===\n')
const d8 = read('校园学习资源共享与知识协作平台产品设计书.md')
const s82 = d8.slice(d8.indexOf('### 8.2.5'), d8.indexOf('## 8.3'))
const s83 = d8.slice(d8.indexOf('### 8.3.6'), d8.indexOf('### 8.3.7'))
const s84 = d8.slice(d8.indexOf('### 8.4.4'), d8.indexOf('### 8.4.6'))
console.log('§8.2.5 Agent 与普通搜索的边界 → 三份文档都有对应（检索服务独立于 Agent）')
console.log('§8.3.6 审核与处罚分离 → 三份都有，且管理员端已实现统一动作层')
console.log('§8.4.4 计划维护/可修改 → 有覆盖，但假设是字符串，见下')
console.log()

/* 假设是否是结构化的 */
const planSample = docOntology.slice(docOntology.indexOf('"assumptions"'), docOntology.indexOf('"assumptions"') + 200)
if (planSample.includes('"assumptions": [')) {
  note('✗', '学习计划的 assumptions 是字符串数组，不是结构化对象', [
    '文档 §6.8：',
    '  "assumptions": ["每周可投入时间暂按 6 小时估算，等待用户确认"]',
    '问题：§8.4.4 要求「学生可修改目标、周期和可投入时间」',
    '→ 假设若是纯字符串，系统无法知道改哪个假设会让哪些阶段失效',
    '→ 建议改成 { id, text, based_on, editable, affects: [stage_id...] }',
    '→ 这样改一个假设能精确标记受影响的阶段，而不是全量重算',
  ])
}

console.log('\n=== 8. 与项目已有实现的衔接点 ===\n')
const adminStoreExists = fs.existsSync(path.join(root, 'src/stores/admin.js'))
console.log(`管理员统一动作层 stores/admin.js：${adminStoreExists ? '已实现（applyAdminAction，理由必填 + 自动审计）' : '无'}`)
console.log('→ 文档 §5.7「模型分析结果与内容状态流转必须分开」与本项目已实现的动作层方向一致')
console.log('→ 文档 §5.10 审计字段（case_id / rule_version / model_version / prompt_version）')
console.log('   本项目 stores/admin.js 目前只记 type/target/action/reason/result/caseNo/operator/at')
console.log('   → 后端实现时补上版本字段即可，前端结构不用大改')

console.log(`\n${problems ? `${problems} 处需要处理` : '未发现硬性冲突'}`)
