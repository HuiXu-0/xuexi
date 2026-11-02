<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { resourceFilters, resources } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'

const category = ref('all')
const query = ref('')

const categoryLabels = {
  programming: '编程基础',
  ai: '人工智能',
  hardware: '嵌入式与硬件',
  math: '数学基础',
  competition: '竞赛资源',
  other: '其他',
}

const allResources = computed(() => [
  ...demoStore.resources.map((r) => ({
    id: `local-${r.title}`,
    category: r.category || 'other',
    badges: [[null, categoryLabels[r.category] || '其他'], ['green', '外部资源入口']],
    demoLabel: '本地新建',
    title: r.title,
    desc: r.description || '尚未填写简介。',
    metas: [`来源：${r.source || '待补充'}`, '最近核实：待核实'],
    footBadge: ['amber', '用户提交 · 待核实'],
    detailItem: null,
    keywords: `${r.title} ${r.description || ''} ${r.source || ''} ${r.url || ''}`,
    isLocal: true,
  })),
  ...resources,
])

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allResources.value.filter((r) => {
    const matchCat = category.value === 'all' || r.category === category.value
    const matchQuery = !q || `${r.title} ${r.desc} ${r.keywords}`.toLowerCase().includes(q)
    return matchCat && matchQuery
  })
})
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">RESOURCE DIRECTORY</div>
        <h1>学习资源导航</h1>
        <p>
          将互联网上已有的教程、文档、课程、工具和仓库整理为可检索的入口。平台保存资源元信息与原始链接，不默认复制第三方完整内容。
        </p>
      </div>
      <div class="page-heading-actions">
        <button class="solid-btn" data-create="resource">提交资源链接</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>资源条目应尽量标注原始链接、来源平台、作者或机构、适合基础和最近核实时间。用户查看资源不代表获得转载、复制或下载第三方内容的许可。</div>
    </div>

    <div class="page-toolbar">
      <div class="page-toolbar-left">
        <button
          v-for="f in resourceFilters"
          :key="f.value"
          class="page-filter-btn"
          :class="{ active: category === f.value }"
          @click="category = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="page-toolbar-right">
        <input
          v-model="query"
          class="page-input"
          placeholder="搜索资源名称、方向或形式…"
          aria-label="搜索资源导航"
        />
      </div>
    </div>

    <div class="page-card-grid">
      <article v-for="r in visible" :key="r.id" class="page-content-card">
        <div class="page-card-meta">
          <span
            v-for="(b, i) in r.badges"
            :key="i"
            class="page-badge"
            :class="b[0] || ''"
          >{{ b[1] }}</span>
        </div>
        <h3>{{ r.title }}</h3>
        <p>{{ r.desc }}</p>
        <div class="page-card-meta">
          <span v-for="m in r.metas" :key="m">{{ m }}</span>
        </div>
        <div class="page-card-footer">
          <span class="page-badge" :class="r.footBadge[0]">{{ r.footBadge[1] }}</span>
          <button v-if="r.detailItem" class="open-card" :data-item="r.detailItem">查看条目</button>
          <button v-else class="mini-btn" :data-page-item="r.title">查看条目</button>
        </div>
      </article>

      <div v-if="!visible.length" class="page-empty">
        没有找到匹配的演示内容。可尝试更短关键词，或在正式平台提交资源建议。
      </div>
    </div>
  </section>
</template>
