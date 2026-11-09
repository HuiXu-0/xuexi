<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import RelatedBlock from '../components/RelatedBlock.vue'
import { noteFilters, notes } from '../data/pages.js'
import { demoStore, toggleSave } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'
import { openCreateForm } from '../composables/useModal.js'
import { createSchemas } from '../data/createSchemas.js'

const category = ref('all')
const query = ref('')

const visibilityLabels = { personal: '仅自己可见', campus: '校内可见', public: '公开可见' }
const categoryLabels = { programming: '编程基础', hardware: '硬件与嵌入式', practice: '项目复盘', ai: '人工智能', other: '其他' }

const allNotes = computed(() => [
  ...demoStore.notes.map((n) => ({
    id: `local-${n.title}`,
    category: n.category || 'other',
    badges: [['blue', '学习笔记'], [null, visibilityLabels[n.visibility] || '范围待设置']],
    demoLabel: '本地新建',
    title: n.title,
    desc: n.content,
    tags: [categoryLabels[n.category] || '其他'],
    metas: ['作者：当前演示用户', `来源：${n.source || '未填写'}`],
    detailItem: null,
    keywords: `${n.title} ${n.content} ${n.category || ''} ${n.source || ''}`,
    isLocal: true,
  })),
  ...notes,
])

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allNotes.value.filter((n) => {
    const matchCat = category.value === 'all' || n.category === category.value
    const matchQuery = !q || `${n.title} ${n.desc} ${n.tags.join(' ')} ${n.keywords}`.toLowerCase().includes(q)
    return matchCat && matchQuery
  })
})

function onSave(title) {
  const saved = toggleSave(title)
  showToast(saved ? '已添加到本地演示收藏。' : '已取消本地演示收藏。')
}

/** 空状态操作：清掉筛选与关键词 */
function resetFilter() {
  category.value = 'all'
  query.value = ''
  showToast('已清除筛选条件，显示全部学习笔记。')
}

/** 空状态操作：直接打开发布笔记表单 */
function openCreateNote(event) {
  openCreateForm('note', createSchemas, event)
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">NOTES &amp; KNOWLEDGE</div>
        <h1>学习笔记</h1>
        <p>
          分享学习总结、实验记录、技术教程和复盘经验。内容可见范围与转载、修改、商业使用或用于竞赛的许可相互独立。
        </p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-route="resources">浏览外部资源</button>
        <button class="solid-btn" data-create="note">发布学习笔记</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>发布内容时请注明引用来源，并选择明确的可见范围。原型中的笔记为演示内容；正式平台应显示作者、更新时间、引用来源和内容使用许可。</div>
    </div>

    <div class="page-toolbar">
      <div class="page-toolbar-left">
        <button
          v-for="f in noteFilters"
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
          placeholder="搜索笔记标题或标签…"
          aria-label="搜索学习笔记"
        />
      </div>
    </div>

    <div class="page-card-grid">
      <article v-for="n in visible" :key="n.id" class="page-content-card">
        <div class="page-card-meta">
          <span
            v-for="(b, i) in n.badges"
            :key="i"
            class="page-badge"
            :class="b[0] || ''"
          >{{ b[1] }}</span>
          <span class="demo-label">{{ n.demoLabel }}</span>
        </div>
        <h3>{{ n.title }}</h3>
        <p>{{ n.desc }}</p>
        <div class="tag-row">
          <span v-for="t in n.tags" :key="t" class="tag">{{ t }}</span>
        </div>
        <div class="page-card-meta">
          <span v-for="m in n.metas" :key="m">{{ m }}</span>
        </div>
        <div class="page-card-footer">
          <button v-if="n.detailItem" class="open-card" :data-item="n.detailItem">阅读详情</button>
          <button v-else class="mini-btn" :data-page-item="n.title">阅读详情</button>
          <button class="mini-btn" @click="onSave(n.title)">
            {{ demoStore.savedItems[n.title] ? '已收藏' : '收藏' }}
          </button>
        </div>

        <!-- 相关内容（设计书 §9.3）：笔记↔笔记、笔记↔案例 等关联 -->
        <RelatedBlock :title="n.title" :limit="3" heading="相关笔记与案例" />
      </article>

      <EmptyState
        v-if="!visible.length"
        icon="i-book"
        message="没有找到匹配的学习笔记"
        hint="可尝试更短的关键词、切换到「全部」分类，或发布一篇你自己的笔记。"
        action-text="清除筛选条件"
        @action="resetFilter"
      >
        <button class="mini-btn" @click="openCreateNote">发布学习笔记</button>
      </EmptyState>
    </div>
  </section>
</template>
