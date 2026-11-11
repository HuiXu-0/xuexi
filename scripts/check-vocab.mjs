/**
 * 受控词表一致性检查：设计书 §2.5 ↔ 前端 src/data/dict.js。
 *
 * 背景：设计书与前端各自维护状态/可见范围/证据类型等枚举，
 * 两边不一致会导致后端过滤条件与前端永远匹配不上
 * （典型症状：「设为成员可见但所有人都能看到」）。
 *
 * 用法：node scripts/check-vocab.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const doc = read('校园学习资源共享平台_三大Agent可执行设计与领域本体_V1.0.md')
const dict = read('src/data/dict.js')

let bad = 0

/**
 * 取设计书里某个词表小节的键名列表。
 * 小节格式：`### 内容状态 \`content_status\`` 后跟 `- \`key\`` 列表。
 */
function docVocab(title) {
  const start = doc.indexOf(`### ${title}`)
  if (start < 0) return null
  const rest = doc.slice(start)
  /* 到下一个 `### ` 为止 */
  const end = rest.indexOf('\n### ', 10)
  const section = end < 0 ? rest : rest.slice(0, end)
  const keys = [...section.matchAll(/^- `([a-zA-Z_]+)`$/gm)].map((m) => m[1])
  return keys
}

/** 取前端 dict.js 里某个导出对象的键名 */
function codeVocab(exportName) {
  const start = dict.indexOf(`export const ${exportName}`)
  if (start < 0) return null
  const rest = dict.slice(start)
  const end = rest.indexOf('\n}')
  const section = end < 0 ? rest : rest.slice(0, end)
  return [...section.matchAll(/^  (\w+):/gm)].map((m) => m[1])
}

function check(title, docKeys, codeKeys) {
  console.log(`\n--- ${title} ---`)
  if (!docKeys || !codeKeys) {
    console.log(`  ⚠ 未能解析：doc=${docKeys ? '有' : '无'} code=${codeKeys ? '有' : '无'}`)
    return
  }
  const docOnly = docKeys.filter((k) => !codeKeys.includes(k))
  const codeOnly = codeKeys.filter((k) => !docKeys.includes(k))
  if (!docOnly.length && !codeOnly.length) {
    console.log(`  ✓ 一致（${docKeys.length} 项）`)
    return
  }
  bad++
  if (docOnly.length) console.log(`  ✗ 文档有、代码没有：${docOnly.join(', ')}`)
  if (codeOnly.length) console.log(`  ✗ 代码有、文档没有：${codeOnly.join(', ')}`)
}

console.log('=== 受控词表一致性检查（设计书 §2.5 ↔ src/data/dict.js）===')

/* content_status：设计书 §2.5 ↔ 前端 contentStates */
check('内容状态 content_status', docVocab('内容状态 `content_status`'), codeVocab('contentStates'))

/* visibility：设计书 ↔ 前端 visibilityScopes */
check('可见范围 visibility', docVocab('可见范围 `visibility`'), codeVocab('visibilityScopes'))

/* moderation_decision：设计书 ↔ 前端 reviewActions（动作集不同，这里只查是否存在） */
const docDecisions = docVocab('审核结果 `moderation_decision`')
console.log(`\n--- 审核结果 moderation_decision ---`)
if (docDecisions) {
  console.log(`  文档：${docDecisions.join(', ')}`)
  const codeActions = codeVocab('reviewActions')
  console.log(`  前端 reviewActions（教师处置动作，语义不同）：${codeActions?.join(', ')}`)
  console.log('  注：这是两套不同的东西 —— 文档是 Agent 裁决，前端是人工处置动作，不做逐项比对')
  console.log('      但需确认：Agent 裁决 REVIEW → 前端教师处置中的「暂缓并转交」对应关系（见 §5.12）')
}

/* evidence_type：设计书 vs 技术架构文档 */
console.log(`\n--- 证据类型 evidence_type ---`)
const docEvidence = docVocab('证据类型 `evidence_type`')
const arch = read('三大Agent技术架构与详细设计.md')
/* 技术架构文档里证据类型写在表格中（无反引号），用单词边界匹配 */
const archEvidence = [
  ...new Set(
    [...arch.matchAll(/\b(USER_STATED|SELF_ASSESSED|TASK_VERIFIED|TEACHER_VERIFIED|SYSTEM_OBSERVED|UNKNOWN)\b/g)].map(
      (m) => m[1]
    )
  ),
]
if (docEvidence?.join() === archEvidence.join()) {
  console.log(`  ✓ 与《三大 Agent 技术架构与详细设计》一致（${docEvidence.length} 项）`)
} else {
  bad++
  const missing = (docEvidence || []).filter((k) => !archEvidence.includes(k))
  console.log(`  ✗ 与技术架构文档不一致`)
  console.log(`    本设计书：${docEvidence?.join(', ')}`)
  console.log(`    技术架构：${archEvidence.join(', ')}`)
  if (missing.length) console.log(`    技术架构文档缺少：${missing.join(', ')}`)
}

/* 角色模型：设计书 §3.1 的 7 角色 ↔ Phase 0 的角色+能力位定稿 */
console.log(`\n--- 角色模型 ---`)
const hasRoleDecision = doc.includes('角色模型定稿')
const hasGroupOwner = doc.includes('group_owner')
const hasReviewer = doc.includes('`reviewer`')
if (hasRoleDecision && hasGroupOwner && hasReviewer) {
  console.log('  ✓ Phase 0 已定稿「角色 + 能力位」模型，且含 group_owner / reviewer')
} else {
  bad++
  console.log('  ✗ Phase 0 缺少角色模型定稿或能力位清单')
}

console.log(bad ? `\n${bad} 处不一致` : '\n全部一致 ✓')
process.exit(bad ? 1 : 0)
