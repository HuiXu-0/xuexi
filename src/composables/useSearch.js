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
import { demoStore } from '../stores/demo.js'

/**
 * 全站搜索索引。
 * 原型里搜索的是 DOM 中所有 .searchable 元素（含隐藏子页），
 * 这里改为直接聚合各模块数据，行为一致但不再依赖 DOM。
 */

const searchState = reactive({
  query: '',
  results: [],
  count: 0,
  title: '搜索结果',
  active: false,
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

function buildIndex() {
  const items = []
  const push = (heading, desc, type, keywords) => {
    items.push({ heading, desc, type, keywords: keywords || '' })
  }

  homeCompetitions.forEach((c) => push(c.title, c.desc, 'competition', c.keywords))
  homeDiscover.forEach((d) => push(d.title, d.desc, d.type, d.keywords))
  homeActivities.forEach((a) => push(a.title, a.meta, 'group', a.keywords))

  forumGroups.forEach((g) => push(g.title, g.desc, 'group', g.keywords))
  forumPostsSeed.forEach((p) => push(p.title, p.desc, 'post', p.keywords))

  notes.forEach((n) => push(n.title, n.desc, 'note', `${n.keywords} ${n.tags.join(' ')}`))
  competitionTimeline.forEach((c) => push(c.title, c.desc, 'competition', c.keywords))
  resources.forEach((r) => push(r.title, r.desc, 'resource', r.keywords))
  cases.forEach((c) => push(c.title, c.desc, 'case', c.keywords))

  /* 本地新建内容一并纳入 */
  demoStore.groups.forEach((g) => push(g.title, g.description, 'group', g.category || ''))
  demoStore.posts.forEach((p) => push(p.title, p.content, 'post', ''))
  demoStore.notes.forEach((n) => push(n.title, n.content, 'note', `${n.category || ''} ${n.source || ''}`))
  demoStore.resources.forEach((r) => push(r.title, r.description || '', 'resource', `${r.source || ''} ${r.url || ''}`))
  demoStore.competitions.forEach((c) => push(c.title, c.description || '', 'competition', c.host || ''))
  demoStore.cases.forEach((c) => push(c.title, c.summary, 'case', c.details || ''))

  return items
}

export function runSearch(query) {
  const q = query.trim().toLowerCase()
  searchState.query = query
  if (!q) {
    clearSearch()
    return
  }

  const matches = buildIndex().filter((item) =>
    `${item.keywords} ${item.heading} ${item.desc}`.toLowerCase().includes(q)
  )

  searchState.title = `“${query}” 的搜索结果`
  searchState.count = matches.length
  searchState.results = matches.slice(0, 12).map((item) => ({
    ...item,
    typeLabel: typeLabels[item.type] || '学习内容',
    route: routeByType[item.type] || 'home',
  }))
  searchState.active = true
}

export function clearSearch() {
  searchState.active = false
  searchState.query = ''
  searchState.results = []
  searchState.count = 0
  searchState.title = '搜索结果'
}

export function useSearch() {
  return searchState
}
