<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { caseFilters, cases } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'

const category = ref('all')
const query = ref('')

const categoryLabels = { hardware: '智能硬件', ai: '人工智能', software: '软件项目', other: '其他' }
const visibilityLabels = { personal: '仅自己可见', campus: '校内展示', public: '公开展示' }

const allCases = computed(() => [
  ...demoStore.cases.map((c) => ({
    id: `local-${c.title}`,
    category: c.category || 'other',
    badges: [
      ['green', categoryLabels[c.category] || '其他'],
      [null, visibilityLabels[c.visibility] || '范围待确认'],
    ],
    demoLabel: '本地新建',
    title: c.title,
    desc: c.summary,
    tags: ['实践成果', '作者授权需确认'],
    metas: ['贡献者：待核验', '附件默认不公开'],
    detailItem: null,
    footBadge: ['amber', '待确认'],
    keywords: `${c.title} ${c.summary} ${c.details || ''}`,
    isLocal: true,
  })),
  ...cases,
])

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allCases.value.filter((c) => {
    const matchCat = category.value === 'all' || c.category === category.value
    const matchQuery = !q || `${c.title} ${c.desc} ${c.keywords}`.toLowerCase().includes(q)
    return matchCat && matchQuery
  })
})
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">PROJECTS &amp; PRACTICE</div>
        <h1>优秀案例</h1>
        <p>
          展示真实项目、竞赛成果和实践复盘，帮助其他学生理解从想法到实现的过程。教师推荐不自动等同于学生授权。
        </p>
      </div>
      <div class="page-heading-actions">
        <button class="solid-btn" data-create="case">发布项目案例</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>作者可分别控制封面、演示视频、原理说明、附件、源码链接和成员信息的展示范围。演示内容不代表真实获奖或官方背书。</div>
    </div>

    <div class="page-toolbar">
      <div class="page-toolbar-left">
        <button
          v-for="f in caseFilters"
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
          placeholder="搜索项目方向或实践经验…"
          aria-label="搜索优秀案例"
        />
      </div>
    </div>

    <div class="page-card-grid">
      <article v-for="c in visible" :key="c.id" class="page-content-card">
        <div class="page-card-meta">
          <span
            v-for="(b, i) in c.badges"
            :key="i"
            class="page-badge"
            :class="b[0] || ''"
          >{{ b[1] }}</span>
          <span class="demo-label">{{ c.demoLabel }}</span>
        </div>
        <h3>{{ c.title }}</h3>
        <p>{{ c.desc }}</p>
        <div class="tag-row">
          <span v-for="t in c.tags" :key="t" class="tag">{{ t }}</span>
        </div>
        <div class="page-card-meta">
          <span v-for="m in c.metas" :key="m">{{ m }}</span>
        </div>
        <div class="page-card-footer">
          <button v-if="c.detailItem" class="open-card" :data-item="c.detailItem">查看案例</button>
          <button v-else class="mini-btn" :data-page-item="c.title">查看案例</button>
          <span class="page-badge" :class="c.footBadge[0]">{{ c.footBadge[1] }}</span>
        </div>
      </article>

      <div v-if="!visible.length" class="page-empty">
        没有找到匹配的演示内容。可尝试更短关键词，或在正式平台提交资源建议。
      </div>
    </div>

    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>教师推荐与作品授权</h2>
            <p>教师可发起推荐邀请，作者确认具体展示字段和可见范围后再发布。</p>
          </div>
          <span class="page-badge blue">授权优先</span>
        </div>
        <p style="font-size: 12px; color: var(--text-soft); line-height: 1.8; margin: 0">
          涉及共同作品时，应按平台规则确认相关贡献者的授权要求。作者可以选择只公开摘要和演示，不公开完整文档、源代码或尚未发表的细节。
        </p>
      </div>
    </div>
  </section>
</template>
