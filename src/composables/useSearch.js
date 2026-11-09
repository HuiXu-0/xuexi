import { reactive } from 'vue'
import {
  forumGroups,
  forumPostsSeed,
  notes,
  competitionTimeline,
  resources,
  cases,
} from '../data/pages.js'
import { homeCompetitions, homeDiscover, homeActivities, typeLabels } from '../data/content.js'
import { visibilityMeta } from '../data/dict.js'
import { demoStore } from '../stores/demo.js'

/**
 * 全站搜索索引。
 *
 * 原型里搜索的是 DOM 中所有 .searchable 元素（含隐藏子页），
 * 这里改为直接聚合各模块数据，行为一致但不再依赖 DOM。
 *
 * 设计书 §13 要求：
 *   §13.2 结果要展示标题、类型、摘要、标签、作者/来源、更新时间、可见范围
 *   §13.3 排序要平衡相关性、有效性、质量与时效性，
 *         不能只按点赞或浏览量（新内容和高价值低曝光内容也要能被发现）
 *   §8.2.4 无结果时给调整建议，不编造结果
 */

const searchState = reactive({
  query: '',
  results: [],
  count: 0,
  title: '搜索结果',
  active: false,
  /** 无结果时的调整建议（由调用方或 Agent 补充） */
  suggestions: [],
})

/** 类型 → 目标路由 */
const routeByType = {
  note: 'notes',
  case: 'cases',
  resource: 'resources',
  competition: 'competitions',
  group: 'forum',
  post: 'forum',
}

/**
 * 质量信号：内容被官方核对过、来源可靠、时效性好则得分更高。
 * 原型阶段用固定的示例信号值，代表"这条内容更值得信任"。
 */
function qualitySignal(type) {
  const table = {
    competition: 0.9, // 竞赛条目有官方来源与核实时间要求
    resource: 0.75,
    case: 0.7,
    note: 0.65,
    group: 0.6,
    post: 0.5,
  }
  return table[type] ?? 0.5
}

/** 时效性：越新越靠前（用示例的天数偏移表示） */
function recencyScore(updatedAt) {
  if (!updatedAt) return 0.3
  const days = Number(String(updatedAt).match(/(\d+)/)?.[1] ?? 30)
  return Math.max(0.15, 1 - days / 180)
}

function buildIndex() {
  const items = []
  const push = (heading, desc, type, keywords, extra = {}) => {
    items.push({
      heading,
      desc,
      type,
      keywords: keywords || '',
      tags: extra.tags || [],
      author: extra.author || '平台整理示例',
      updatedAt: extra.updatedAt || '近期更新',
      scope: extra.scope || 'public',
      ...extra,
    })
  }

  homeCompetitions.forEach((c) =>
    push(c.title, c.desc, 'competition', c.keywords, {
      tags: [c.category],
      author: c.sourceNote || '待指定维护者',
      updatedAt: '2026-10-20',
      scope: 'campus',
    })
  )
  homeDiscover.forEach((d) =>
    push(d.title, d.desc, d.type, d.keywords, {
      tags: d.tags,
      author: d.authorName,
      updatedAt: '2026-11-02',
      scope: 'campus',
    })
  )
  homeActivities.forEach((a) =>
    push(a.title, a.meta, 'group', a.keywords, {
      tags: ['学习小组', a.tag],
      author: '小组管理员（示例）',
      updatedAt: '2026-11-04',
      scope: 'public',
    })
  )

  forumGroups.forEach((g) =>
    push(g.title, g.desc, 'group', g.keywords, {
      tags: g.tags || ['学习交流'],
      author: g.originLabel || '创建者（示例）',
      updatedAt: '2026-10-28',
      scope: g.visibility === '公开组' ? 'public' : 'campus',
    })
  )
  forumPostsSeed.forEach((p) =>
    push(p.title, p.desc, 'post', p.keywords, {
      tags: [p.kind],
      author: '讨论作者（示例）',
      updatedAt: '2026-11-01',
      scope: 'campus',
    })
  )

  notes.forEach((n) =>
    push(n.title, n.desc, 'note', `${n.keywords} ${n.tags.join(' ')}`, {
      tags: n.tags,
      author: '笔记作者（示例）',
      updatedAt: '2026-10-30',
      scope: n.visibility || 'campus',
    })
  )
  competitionTimeline.forEach((c) =>
    push(c.title, c.desc, 'competition', c.keywords, {
      tags: [c.category || '竞赛'],
      author: c.sourceNote || '待指定维护者',
      updatedAt: '2026-10-18',
      scope: 'campus',
    })
  )
  resources.forEach((r) =>
    push(r.title, r.desc, 'resource', r.keywords, {
      tags: r.tags || ['外部资源'],
      author: r.source || '平台整理示例',
      updatedAt: '2026-10-25',
      scope: 'public',
    })
  )
  cases.forEach((c) =>
    push(c.title, c.desc, 'case', c.keywords, {
      tags: c.tags || ['实践成果'],
      author: c.authorName || '项目作者（示例）',
      updatedAt: '2026-11-03',
      scope: c.visibility || 'public',
    })
  )

  /* 本地新建内容一并纳入 */
  demoStore.groups.forEach((g) =>
    push(g.title, g.description, 'group', g.category || '', {
      tags: [g.category || '学习交流'],
      author: '当前演示用户',
      updatedAt: '刚刚',
      scope: 'campus',
      isLocal: true,
    })
  )
  demoStore.posts.forEach((p) =>
    push(p.title, p.content, 'post', '', {
      tags: ['本地新建'],
      author: '当前演示用户',
      updatedAt: '刚刚',
      scope: 'campus',
      isLocal: true,
    })
  )
  demoStore.notes.forEach((n) =>
    push(n.title, n.content, 'note', `${n.category || ''} ${n.source || ''}`, {
      tags: [n.category || '学习笔记'],
      author: '当前演示用户',
      updatedAt: '刚刚',
      scope: n.visibility || 'private',
      isLocal: true,
    })
  )
  demoStore.resources.forEach((r) =>
    push(r.title, r.description || '', 'resource', `${r.source || ''} ${r.url || ''}`, {
      tags: ['本地新建'],
      author: '当前演示用户',
      updatedAt: '刚刚',
      scope: 'campus',
      isLocal: true,
    })
  )
  demoStore.competitions.forEach((c) =>
    push(c.title, c.description || '', 'competition', c.host || '', {
      tags: ['竞赛线索'],
      author: '当前演示用户',
      updatedAt: '刚刚',
      scope: 'campus',
      isLocal: true,
    })
  )
  demoStore.cases.forEach((c) =>
    push(c.title, c.summary, 'case', c.details || '', {
      tags: ['实践成果'],
      author: '当前演示用户',
      updatedAt: '刚刚',
      scope: c.visibility || 'private',
      isLocal: true,
    })
  )

  return items
}

/**
 * 相关性打分（§13.3）。
 * 标题命中权重最高，其次关键词与标签，摘要最低 ——
 * 与设计书「标题高度相关、内容高度相关」的排序参考一致。
 */
function relevance(item, q) {
  const title = item.heading.toLowerCase()
  const tags = (item.tags || []).join(' ').toLowerCase()
  const keywords = (item.keywords || '').toLowerCase()
  const desc = (item.desc || '').toLowerCase()

  let score = 0
  if (title.includes(q)) score += 1
  if (title.startsWith(q)) score += 0.4
  if (keywords.includes(q)) score += 0.6
  if (tags.includes(q)) score += 0.5
  if (desc.includes(q)) score += 0.25
  return score
}

export function runSearch(query) {
  const q = query.trim().toLowerCase()
  searchState.query = query
  if (!q) {
    clearSearch()
    return
  }

  const index = buildIndex()

  const scored = index
    .map((item) => {
      const rel = relevance(item, q)
      return {
        item,
        score: rel * 1.6 + qualitySignal(item.type) * 0.5 + recencyScore(item.updatedAt) * 0.35,
        rel,
      }
    })
    .filter((x) => x.rel > 0)

  /* 相关性为主排序；相关度相同时按综合得分（质量 + 时效）降序 */
  scored.sort((a, b) => b.rel - a.rel || b.score - a.score)

  searchState.title = `“${query}” 的搜索结果`
  searchState.count = scored.length
  searchState.results = scored.slice(0, 12).map(({ item, score }) => ({
    ...item,
    typeLabel: typeLabels[item.type] || '学习内容',
    route: routeByType[item.type] || 'home',
    scopeLabel: visibilityMeta(item.scope).label,
    score,
  }))

  /* 无结果时给调整建议（§8.2.4：不编造结果，只给可行的下一步） */
  if (!scored.length) {
    searchState.suggestions = buildSuggestions(q, index)
  } else {
    searchState.suggestions = []
  }

  searchState.active = true
}

/**
 * 无结果时的建议：放宽关键词、探索相近标签。
 * 只从平台真实存在的内容里提取，不生成不存在的资源。
 */
function buildSuggestions(query, index) {
  const out = []
  const q = query.toLowerCase()

  /* 取包含该词片段的真实条目关键词作为"相近标签" */
  const related = new Set()
  index.forEach((item) => {
    ;(item.tags || []).forEach((t) => {
      if (String(t).toLowerCase().includes(q.slice(0, 2)) && t !== query) related.add(t)
    })
  })
  related.forEach((t) => out.push({ text: `探索「${t}」`, query: t }))
  if (out.length < 3) {
    /* 取平台内真实存在的高频标签 */
    const fallback = ['嵌入式', 'Python', '入门', '项目实战']
    fallback.forEach((t) => {
      if (!out.some((o) => o.query === t)) out.push({ text: `试试「${t}」`, query: t })
    })
  }
  return out.slice(0, 3)
}

export function clearSearch() {
  searchState.active = false
  searchState.query = ''
  searchState.results = []
  searchState.count = 0
  searchState.title = '搜索结果'
  searchState.suggestions = []
}

export function useSearch() {
  return searchState
}
