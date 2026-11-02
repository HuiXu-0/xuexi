<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import {
  competitionFilters,
  competitionStatusOptions,
  competitionYearOptions,
  competitionTimeline,
  competitionChecklist,
} from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'

const category = ref('all')
const status = ref('all')
const year = ref('2026')
const query = ref('')

const allItems = computed(() => [
  ...demoStore.competitions.map((c) => ({
    id: `local-${c.title}`,
    icon: 'i-calendar',
    category: 'all',
    status: 'verify',
    statusLabel: '待核实',
    statusClass: 'amber',
    title: c.title,
    desc: c.description || '提交者提供的竞赛线索，等待核实。',
    meta: `来源：${c.host || '待补充'} · 官方链接：待核实 · 最后核实时间：待记录`,
    keywords: `${c.title} ${c.host || ''} ${c.description || ''}`,
    isLocal: true,
  })),
  ...competitionTimeline,
])

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allItems.value.filter((c) => {
    const matchCat = category.value === 'all' || c.category === category.value
    const matchStatus = status.value === 'all' || c.status === status.value
    const matchYear = year.value !== '2025' || c.status === 'history'
    const matchQuery = !q || `${c.title} ${c.desc} ${c.keywords}`.toLowerCase().includes(q)
    return matchCat && matchStatus && matchYear && matchQuery
  })
})

function onYearChange() {
  showToast(
    year.value === '2025'
      ? '已切换历史年份视图；当前仅有少量往届参考演示条目。'
      : '已切换到 2026 年视图；日期仍需以官方信息核实。'
  )
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">COMPETITION TIMELINE</div>
        <h1>竞赛资源</h1>
        <p>
          从全年时间轴了解不同竞赛方向，继续查看参赛条件、所需能力、备赛资源和官方入口。未经官方确认的时间不得展示为确定安排。
        </p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-create="competition">提交竞赛线索</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>本页为产品结构演示，不包含已核实的当年赛事日程。真实竞赛条目应记录官方来源、最后核实时间，并区分正式日期、预计日期和往届参考。</div>
    </div>

    <div class="page-toolbar">
      <div class="page-toolbar-left">
        <button
          v-for="f in competitionFilters"
          :key="f.value"
          class="page-filter-btn"
          :class="{ active: category === f.value }"
          @click="category = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="page-toolbar-right">
        <label class="sr-only" for="competitionStatusFilter">竞赛状态筛选</label>
        <select id="competitionStatusFilter" v-model="status" class="page-select">
          <option v-for="o in competitionStatusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <select v-model="year" class="page-select" aria-label="选择年份" @change="onYearChange">
          <option v-for="o in competitionYearOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
    </div>

    <div class="page-section-head">
      <div>
        <h2>全年时间轴</h2>
        <p>按月份浏览竞赛机会；实际日期以主办方公开信息为准。</p>
      </div>
      <span class="page-badge amber">演示日程，不是官方安排</span>
    </div>

    <div class="page-layout-two">
      <div class="page-list">
        <input
          v-model="query"
          class="page-input"
          style="margin-bottom: 12px"
          placeholder="搜索竞赛名称或方向…"
          aria-label="搜索竞赛"
        />
        <div v-for="c in visible" :key="c.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="c.icon" /></span>
          <div class="page-list-content">
            <strong>{{ c.title }}</strong>
            <p>{{ c.desc }}</p>
            <small>{{ c.meta }}</small>
          </div>
          <span class="page-badge" :class="c.statusClass">{{ c.statusLabel }}</span>
        </div>
        <div v-if="!visible.length" class="page-empty">没有找到匹配的竞赛方向。</div>
      </div>

      <aside class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>查看竞赛前先确认</h2>
            <p>减少错过报名和误用过期信息。</p>
          </div>
        </div>
        <div v-for="item in competitionChecklist" :key="item.title" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="item.icon" /></span>
          <div class="page-list-content">
            <strong>{{ item.title }}</strong>
            <p>{{ item.desc }}</p>
          </div>
        </div>
        <button
          class="solid-btn"
          style="width: 100%; justify-content: center; margin-top: 12px"
          data-route="resources"
        >
          查找备赛资源
        </button>
      </aside>
    </div>
  </section>
</template>
