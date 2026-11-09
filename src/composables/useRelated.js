import { notes, cases, resources, competitionTimeline, forumGroups } from '../data/pages.js'
import { typeLabels } from '../data/content.js'

/**
 * 内容关联（设计书 §9.3）。
 *
 * 关联只提供导航，**不改变被关联对象的可见性和使用许可** ——
 * 点击关联时仍应执行相同的权限检查。
 *
 * 当前按「标签交集 + 内容类型相邻」计算关联度，
 * 用的是平台里真实存在的数据，不是写死的静态列表。
 */

/** 类型 → 目标路由 */
const routeOf = {
  note: 'notes',
  case: 'cases',
  resource: 'resources',
  competition: 'competitions',
  group: 'forum',
  post: 'forum',
}

/**
 * 建立全站条目索引（只取真实内容）。
 */
function buildPool() {
  const pool = []

  notes.forEach((n) => {
    pool.push({
      id: `note-${n.title}`,
      title: n.title,
      desc: n.desc,
      type: 'note',
      tags: n.tags || [],
      keywords: n.keywords || '',
      visibility: n.visibility || 'campus',
    })
  })

  cases.forEach((c) => {
    pool.push({
      id: `case-${c.title}`,
      title: c.title,
      desc: c.desc,
      type: 'case',
      tags: c.tags || [],
      keywords: c.keywords || '',
      visibility: c.visibility || 'public',
    })
  })

  resources.forEach((r) => {
    pool.push({
      id: `resource-${r.title}`,
      title: r.title,
      desc: r.desc,
      type: 'resource',
      tags: r.tags || [],
      keywords: r.keywords || '',
      visibility: 'public',
    })
  })

  competitionTimeline.forEach((c) => {
    pool.push({
      id: `competition-${c.title}`,
      title: c.title,
      desc: c.desc,
      type: 'competition',
      tags: [c.category || '竞赛'],
      keywords: c.keywords || '',
      visibility: 'campus',
    })
  })

  forumGroups.forEach((g) => {
    pool.push({
      id: `group-${g.title}`,
      title: g.title,
      desc: g.desc,
      type: 'group',
      tags: g.tags || [],
      keywords: g.keywords || '',
      visibility: 'public',
    })
  })

  return pool
}

let poolCache = null
function getPool() {
  if (!poolCache) poolCache = buildPool()
  return poolCache
}

/**
 * 计算某条内容的关联条目。
 *
 * @param {object} item 当前条目（需含 title / desc / type / tags / keywords）
 * @param {number} limit 返回条数
 */
export function getRelated(item, limit = 4) {
  if (!item) return []
  const pool = getPool()

  const myTags = new Set((item.tags || []).map((t) => String(t).toLowerCase()))
  const myWords = new Set(
    `${item.title} ${item.desc} ${item.keywords || ''}`
      .toLowerCase()
      .split(/[\s,，、。·/]+/)
      .filter((w) => w.length >= 2)
  )

  const scored = pool
    .filter((p) => p.title !== item.title)
    .map((p) => {
      let score = 0
      const reasons = []

      /* 标签交集：最强的关联信号 */
      const shared = (p.tags || []).filter((t) => myTags.has(String(t).toLowerCase()))
      if (shared.length) {
        score += shared.length * 3
        reasons.push(`共同标签：${shared.join('、')}`)
      }

      /* 关键词重叠 */
      const pWords = new Set(
        `${p.title} ${p.desc} ${p.keywords || ''}`
          .toLowerCase()
          .split(/[\s,，、。·/]+/)
          .filter((w) => w.length >= 2)
      )
      let overlap = 0
      myWords.forEach((w) => {
        if (pWords.has(w)) overlap++
      })
      if (overlap > 0) {
        score += overlap
        if (!reasons.length) reasons.push('内容主题相近')
      }

      /* 类型相邻：笔记↔案例、竞赛↔资源这类组合更容易互相参考 */
      const adjacency = {
        note: ['case', 'group'],
        case: ['note', 'competition'],
        competition: ['case', 'resource'],
        resource: ['competition', 'note'],
        group: ['note'],
        post: ['note', 'case'],
      }
      if ((adjacency[item.type] || []).includes(p.type)) {
        score += 1
      }

      return { ...p, score, reason: reasons[0] || '主题相近' }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map((p) => ({
    id: p.id,
    title: p.title,
    desc: p.desc,
    type: p.type,
    typeLabel: typeLabels[p.type] || '学习内容',
    route: routeOf[p.type] || 'home',
    tags: (p.tags || []).slice(0, 3),
    reason: p.reason,
    visibility: p.visibility,
  }))
}

/**
 * 按标题或关键词找一条内容，再取它的关联。
 * 供页面直接调用而不必自己先定位对象。
 */
export function getRelatedByTitle(title, limit = 4) {
  const pool = getPool()
  const found = pool.find((p) => p.title === title)
  if (found) return getRelated(found, limit)

  /* 找不到完全匹配时，用关键词匹配最接近的一条 */
  const key = String(title || '').toLowerCase()
  const approx = pool.find((p) => p.title.toLowerCase().includes(key) || key.includes(p.title.toLowerCase()))
  return approx ? getRelated(approx, limit) : []
}
