<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import { forumGroupFilters, forumGroups, forumPostsSeed, forumRules } from '../data/pages.js'
import { demoStore, toggleJoin } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'
import { openCreateForm } from '../composables/useModal.js'
import { createSchemas } from '../data/createSchemas.js'

const groupFilter = ref('all')
const groupQuery = ref('')
const postQuery = ref('')

/** 静态小组 + 本地新建的小组 */
const allGroups = computed(() => [
  ...demoStore.groups.map((g) => ({
    id: `local-${g.title}`,
    origin: g.origin || 'student',
    originLabel: g.origin === 'teacher' ? '教师创建' : '学生创建',
    originClass: g.origin === 'teacher' ? 'blue' : 'green',
    visibility: ({ public: '公开组', campus: '校内可见', members: '成员可见' })[g.visibility] || '范围待设置',
    demoLabel: '本地新建',
    title: g.title,
    desc: g.description,
    tags: [g.category || '学习交流'],
    metas: ['本地演示小组', '实际成员数据待接入'],
    detailItem: null,
    detailLabel: '查看详情',
    joinLabel: ({ open: '加入小组', apply: '申请加入', invite: '邀请加入' })[g.joinMode] || '查看小组',
    joinMode: g.joinMode === 'apply' ? '申请' : '',
    keywords: `${g.title} ${g.description} ${g.category || ''}`,
    isLocal: true,
  })),
  ...forumGroups.map((g) => ({ ...g, isLocal: false })),
])

const visibleGroups = computed(() => {
  const q = groupQuery.value.trim().toLowerCase()
  return allGroups.value.filter((g) => {
    const matchFilter = groupFilter.value === 'all' || g.origin === groupFilter.value
    const matchQuery = !q || `${g.title} ${g.desc} ${g.keywords}`.toLowerCase().includes(q)
    return matchFilter && matchQuery
  })
})

const allPosts = computed(() => [
  ...demoStore.posts.map((p) => ({
    id: `local-${p.title}`,
    icon: 'i-message',
    title: p.title,
    desc: p.content,
    group: ({ embedded: '嵌入式实践学习小组', programming: '编程基础共学小组', project: '项目实践交流' })[p.group] || '学习小组',
    kind: ({ question: '问题求助', discussion: '普通讨论', resource: '资源推荐', activity: '活动信息' })[p.kind] || '普通讨论',
    status: '新建',
    statusClass: 'amber',
    keywords: `${p.title} ${p.content}`,
    isLocal: true,
  })),
  ...forumPostsSeed,
])

const visiblePosts = computed(() => {
  const q = postQuery.value.trim().toLowerCase()
  return allPosts.value.filter(
    (p) => !q || `${p.title} ${p.desc} ${p.group} ${p.kind} ${p.keywords}`.toLowerCase().includes(q)
  )
})

function onJoin(group) {
  const mode = group.joinMode
  const { joined, joinedLabel } = toggleJoin(group.title, mode)
  showToast(
    joined
      ? mode === '申请'
        ? `已记录本地演示申请：${group.title}`
        : `已记录本地演示加入：${group.title}`
      : `已撤销本地演示加入状态：${group.title}`
  )
  void joinedLabel
}

/** 空状态的操作：清掉筛选与关键词，回到完整列表 */
function resetGroupFilter() {
  groupFilter.value = 'all'
  groupQuery.value = ''
  showToast('已清除筛选条件，显示全部学习小组。')
}

/** 空状态的操作：直接打开发布讨论表单 */
function openCreatePost(event) {
  openCreateForm('post', createSchemas, event)
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">LEARN TOGETHER</div>
        <h1>学习论坛</h1>
        <p>
          围绕技术方向、课程、竞赛和项目实践开展持续交流。小组权限只作用于对应小组，有价值的问题与答案可以逐步沉淀为可检索知识。
        </p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-create="post">发布讨论</button>
        <button class="solid-btn" data-create="group">创建学习小组</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>原型演示数据。真实平台中的公开、校内可见和成员可见内容必须经过权限校验；小组创建者不能因此获得全站管理权限。</div>
    </div>

    <div class="page-toolbar">
      <div class="page-toolbar-left">
        <button
          v-for="f in forumGroupFilters"
          :key="f.value"
          class="page-filter-btn"
          :class="{ active: groupFilter === f.value }"
          @click="groupFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>
      <div class="page-toolbar-right">
        <input
          v-model="groupQuery"
          class="page-input"
          placeholder="搜索小组或学习方向…"
          aria-label="搜索学习小组"
        />
      </div>
    </div>

    <div class="page-section-head">
      <div>
        <h2>发现学习小组</h2>
        <p>按兴趣、技术方向或学习目标寻找同行者。</p>
      </div>
      <span class="page-badge">加入方式与可见范围由小组设置</span>
    </div>

    <div class="page-card-grid">
      <article v-for="g in visibleGroups" :key="g.id" class="page-content-card">
        <div class="page-card-meta">
          <span class="page-badge" :class="g.originClass">{{ g.originLabel }}</span>
          <span class="page-badge">{{ g.visibility }}</span>
          <span class="demo-label">{{ g.demoLabel }}</span>
        </div>
        <h3>{{ g.title }}</h3>
        <p>{{ g.desc }}</p>
        <div class="tag-row">
          <span v-for="t in g.tags" :key="t" class="tag">{{ t }}</span>
        </div>
        <div class="page-card-meta">
          <span v-for="m in g.metas" :key="m">{{ m }}</span>
        </div>
        <div class="page-card-footer">
          <button
            v-if="g.detailItem"
            class="open-card"
            :data-item="g.detailItem"
          >
            {{ g.detailLabel }}
          </button>
          <button v-else class="mini-btn" :data-page-item="g.title">{{ g.detailLabel }}</button>
          <button
            class="mini-btn primary"
            @click="onJoin(g)"
          >
            {{ demoStore.joinedGroups[g.title] ? (g.joinMode === '申请' ? '已提交申请' : '已加入') : g.joinLabel }}
          </button>
        </div>
      </article>

      <EmptyState
        v-if="!visibleGroups.length"
        icon="i-users"
        message="没有找到匹配的学习小组"
        hint="可尝试更短的关键词、切换到「全部」筛选，或在正式平台提交资源建议。"
        action-text="清除筛选条件"
        @action="resetGroupFilter"
      />
    </div>

    <div class="page-section">
      <div class="page-section-head">
        <div>
          <h2>近期讨论</h2>
          <p>问题求助可标记待回答、讨论中或已解决；真实平台需要保存作者、更新时间和解决状态。</p>
        </div>
        <button class="text-link" data-create="post">
          发起新讨论 <AppIcon name="i-arrow" />
        </button>
      </div>

      <div class="page-layout-two">
        <div class="page-list">
          <input
            v-model="postQuery"
            class="page-input mb-12"
            placeholder="搜索讨论标题或小组…"
            aria-label="搜索近期讨论"
          />
          <div v-for="p in visiblePosts" :key="p.id" class="page-list-row">
            <span class="page-list-icon"><AppIcon :name="p.icon" /></span>
            <div class="page-list-content">
              <strong>{{ p.title }}</strong>
              <p>{{ p.desc }}</p>
              <small>{{ p.group }} · {{ p.kind }} · 状态示例：{{ p.status }}</small>
            </div>
            <span class="page-badge" :class="p.statusClass">{{ p.status }}</span>
          </div>
          <EmptyState
            v-if="!visiblePosts.length"
            icon="i-message"
            message="没有找到匹配的讨论"
            hint="换个关键词，或发起一条新讨论。"
            action-text="发起新讨论"
            @action="openCreatePost"
          />
        </div>

        <aside class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>小组规则</h2>
              <p>帮助交流保持清晰和可复用。</p>
            </div>
          </div>
          <ul class="rules-list">
            <li v-for="r in forumRules" :key="r">{{ r }}</li>
          </ul>
          <div class="page-callout">
            <AppIcon name="i-shield" />
            <div>自动审核只能辅助识别风险，争议或高影响处理需由有权限的人员决定。</div>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>
