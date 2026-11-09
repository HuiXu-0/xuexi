<script setup>
import { ref, computed, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import RelatedBlock from '../components/RelatedBlock.vue'
import { caseFilters, cases } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { openCreateForm } from '../composables/useModal.js'
import { createSchemas } from '../data/createSchemas.js'
import { showToast } from '../composables/useToast.js'
import {
  caseSections,
  sectionStates,
  recommendStates,
  getAuthorization,
  confirmAuthorization,
  revokeAuthorization,
} from '../stores/caseAuth.js'

/** 分项公开状态的可选项 */
const sectionOptions = [
  { value: 'show', label: '公开' },
  { value: 'hidden', label: '不公开' },
  { value: 'ask', label: '待确认' },
]

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

/** 空状态操作：清掉筛选与关键词 */
function resetFilter() {
  category.value = 'all'
  query.value = ''
  showToast('已清除筛选条件，显示全部实践案例。')
}

/** 空状态操作：直接打开发布案例表单 */
function openCreateCase(event) {
  openCreateForm('case', createSchemas, event)
}

/* ---------- 分项公开与推荐授权（设计书 §5.6.5 / §5.6.6） ---------- */

const selectedCaseId = ref('')

/** 读取某案例的授权状态 */
function authOf(caseId) {
  return getAuthorization(caseId)
}

/** 当前选中的案例 */
const pendingCase = computed(() => {
  const id = selectedCaseId.value || allCases.value[0]?.id
  return allCases.value.find((c) => c.id === id) || null
})

const pendingAuth = computed(() =>
  pendingCase.value ? getAuthorization(pendingCase.value.id) : null
)

/** 草稿：逐项公开状态 */
const draftSections = ref({})

/* 切换案例时载入该案例的当前授权状态作为草稿 */
watch(
  () => pendingCase.value?.id,
  () => {
    if (pendingAuth.value) {
      draftSections.value = { ...pendingAuth.value.sections }
    }
  },
  { immediate: true }
)

function onAcceptAuth() {
  if (!pendingCase.value) return
  const result = confirmAuthorization(pendingCase.value.id, draftSections.value, 'accepted')
  showToast(
    result.state === 'modified'
      ? '已接受推荐，并按你调整后的范围公开。'
      : '已接受推荐，内容将按批准范围展示。'
  )
}

function onRejectAuth() {
  if (!pendingCase.value) return
  confirmAuthorization(pendingCase.value.id, draftSections.value, 'rejected')
  showToast('已拒绝本次推荐申请，内容不会进入推荐展示。')
}

function onRevokeAuth() {
  if (!pendingCase.value) return
  revokeAuthorization(pendingCase.value.id, ['detail', 'doc', 'code'])
  showToast('已撤回未授权继续展示的内容（详解、文档、源码链接）。')
}
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
          <!-- 推荐授权状态（设计书 §5.6.6） -->
          <span
            v-if="authOf(c.id).state !== 'none'"
            class="page-badge"
            :class="recommendStates[authOf(c.id).state]?.tone"
          >
            {{ recommendStates[authOf(c.id).state]?.label }}
          </span>
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

        <!-- 相关内容（设计书 §9.3）：笔记↔案例、竞赛↔案例 等关联 -->
        <RelatedBlock :title="c.title" :limit="3" heading="相关内容" />
      </article>

      <EmptyState
        v-if="!visible.length"
        icon="i-spark"
        message="没有找到匹配的实践案例"
        hint="可尝试更短的关键词、切换到「全部」分类，或发布你自己的项目案例。"
        action-text="清除筛选条件"
        @action="resetFilter"
      >
        <button class="mini-btn" @click="openCreateCase">发布项目案例</button>
      </EmptyState>
    </div>

    <!-- 分项公开与授权确认（设计书 §5.6.5 / §5.6.6） -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>内容分项公开与推荐授权</h2>
            <p>
              作者可分别设置每类内容是否公开。教师推荐不等于自动授权 ——
              未获得完整展示许可时，文档、源码与联系方式不会默认公开。
            </p>
          </div>
          <span class="page-badge amber">演示流程</span>
        </div>

        <div class="auth-flow">
          <div class="auth-flow-step">
            <span class="auth-flow-no">1</span>
            <div>
              <strong>教师发起推荐</strong>
              <small>在教师工作台发起推荐申请</small>
            </div>
          </div>
          <div class="auth-flow-step">
            <span class="auth-flow-no">2</span>
            <div>
              <strong>作者逐项确认</strong>
              <small>查看拟展示内容并选择接受、拒绝或调整范围</small>
            </div>
          </div>
          <div class="auth-flow-step">
            <span class="auth-flow-no">3</span>
            <div>
              <strong>按批准范围发布</strong>
              <small>仅获授权的内容按范围展示，可随时撤回</small>
            </div>
          </div>
        </div>

        <div v-if="!pendingCase" class="auth-picker">
          <label class="auth-picker-label" for="authCaseSelect">选择一个案例查看授权状态</label>
          <select id="authCaseSelect" v-model="selectedCaseId" class="page-select select-full">
            <option v-for="c in allCases" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
        </div>

        <div v-else class="auth-case">
          <div class="auth-case-head">
            <div>
              <strong>{{ pendingCase.title }}</strong>
              <small>
                当前状态：{{ recommendStates[pendingAuth.state]?.label }} ·
                {{ recommendStates[pendingAuth.state]?.desc }}
              </small>
            </div>
            <span class="page-badge" :class="recommendStates[pendingAuth.state]?.tone">
              {{ recommendStates[pendingAuth.state]?.label }}
            </span>
          </div>

          <div class="auth-section-list">
            <div v-for="s in caseSections" :key="s.key" class="auth-section">
              <div class="auth-section-text">
                <strong>{{ s.label }}</strong>
                <small>{{ s.hint }}</small>
              </div>
              <div class="auth-section-opts" role="radiogroup" :aria-label="`${s.label}公开状态`">
                <button
                  v-for="opt in sectionOptions"
                  :key="opt.value"
                  class="auth-section-btn"
                  :class="{ active: draftSections[s.key] === opt.value }"
                  type="button"
                  role="radio"
                  :aria-checked="String(draftSections[s.key] === opt.value)"
                  @click="draftSections[s.key] = opt.value"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="auth-case-actions">
            <button class="solid-btn" @click="onAcceptAuth">接受推荐并按此范围公开</button>
            <button class="outline-btn" @click="onRejectAuth">拒绝本次推荐</button>
            <button class="outline-btn" @click="onRevokeAuth">撤回未授权内容</button>
          </div>
          <p class="auth-case-note">
            当前为前端演示，授权状态只保存在本页内存中，刷新即清空，不会真实发布任何内容。
          </p>
        </div>
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
        <p class="text-soft-12">
          涉及共同作品时，应按平台规则确认相关贡献者的授权要求。作者可以选择只公开摘要和演示，不公开完整文档、源代码或尚未发表的细节。
        </p>
      </div>
    </div>
  </section>
</template>
