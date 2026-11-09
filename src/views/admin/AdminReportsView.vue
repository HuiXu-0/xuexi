<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { reportSeeds, reportFlow, reportFlowOrder, reportMeta } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ③ 内容与举报管理（设计书 §7.3）。
 *
 * §7.3 原文的处理流程：
 *   提交举报 → 确认受理 → 必要时临时隐藏 → 通知当事人 →
 *   核实材料 → 处理并说明理由 → 允许申诉。
 *
 * 所以举报不是一次性「处理/不处理」两个按钮，而是一条有先后顺序的状态链：
 *   已提交 → 已受理 → 临时隐藏 → 已处理 / 不成立 → 申诉中 → 已结案
 * 每一步都要写明理由，并记录到审计。
 */

const filter = ref('all')

const reports = computed(() =>
  reportSeeds.map((r) => {
    const rt = adminStore.reportStates[r.id] || {}
    const state = rt.state || r.state
    return {
      ...r,
      state,
      reason: rt.reason || '',
      at: rt.at || '',
      notifyAt: rt.notifyAt || '',
    }
  })
)

const filtered = computed(() =>
  filter.value === 'all' ? reports.value : reports.value.filter((r) => r.state === filter.value)
)

const openCount = computed(
  () => reports.value.filter((r) => !['resolved', 'dismissed', 'closed'].includes(r.state)).length
)

/* ---------- 状态机 ---------- */
/**
 * 每个状态允许的下一步。
 * 「处理并说明理由」「不成立」都需要理由，所以它们走高影响动作。
 */
const nextStates = {
  submitted: ['accepted'],
  accepted: ['hidden', 'resolved', 'dismissed'],
  hidden: ['resolved', 'dismissed'],
  resolved: ['appealed', 'closed'],
  dismissed: ['closed'],
  appealed: ['closed', 'resolved'],
  closed: [],
}

const actionDef = {
  accepted: { type: 'hide', label: '确认受理', reason: '可说明受理依据。', danger: false },
  hidden: { type: 'hide', label: '临时隐藏', reason: '请说明隐藏原因，并确认会通知当事人。', danger: false },
  resolved: { type: 'remove', label: '处理并说明理由', reason: '请说明处理依据与理由，当事人可据此申诉。', danger: true },
  dismissed: { type: 'restore', label: '举报不成立', reason: '请说明核实过程与不成立的依据。', danger: false },
  appealed: { type: 'restore', label: '受理当事人申诉', reason: '请说明申诉受理后的处置安排。', danger: false },
  closed: { type: 'restore', label: '结案', reason: '可说明结案依据。', danger: false },
}

const pending = ref({ id: '', action: '' })

function ask(rep, action) {
  pending.value = { id: rep.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const rep = reports.value.find((r) => r.id === pending.value.id)
  if (!rep) return
  const action = pending.value.action
  const def = actionDef[action]
  if (!def) return

  const res = applyAdminAction({
    type: def.type,
    target: `${rep.contentType}：${rep.title}`,
    reason,
    caseNo: caseNo || rep.id,
    mutate: () => {
      const cur = adminStore.reportStates[rep.id] || {}
      adminStore.reportStates[rep.id] = {
        ...cur,
        state: action,
        reason,
        at: new Date().toISOString().slice(0, 16).replace('T', ' '),
        /* 临时隐藏与处理都需要通知当事人 */
        notifyAt: ['hidden', 'resolved', 'dismissed'].includes(action)
          ? new Date().toISOString().slice(0, 16).replace('T', ' ')
          : cur.notifyAt || '',
      }
      return `举报状态变更为「${reportMeta(action).label}」`
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}

/** 通知当事人（普通操作） */
function notify(rep) {
  const res = applyAdminAction({
    type: 'hide',
    target: `${rep.contentType}：${rep.title}`,
    reason: '向举报人与被举报人发送处理进展通知',
    caseNo: rep.id,
    mutate: () => {
      const cur = adminStore.reportStates[rep.id] || {}
      adminStore.reportStates[rep.id] = {
        ...cur,
        notifyAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      }
      return '已通知举报人与被举报人'
    },
  })
  showToast(res.message)
}
</script>

<template>
  <AdminShell module="reports" title="内容与举报管理" desc="处理笔记、案例、帖子、资源与竞赛信息的举报，核实后给出处理结果与理由。">
    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>
        管理范围包括笔记、优秀案例、论坛帖子与回复、资源导航条目、竞赛信息、头像与简介等用户提交内容。
        处理流程：提交举报 → 确认受理 → 必要时临时隐藏 → 通知当事人 → 核实材料 → 处理并说明理由 → 允许申诉。
        当事人能看到与自己有关的处理决定和理由。
      </div>
    </div>

    <div class="page-stats">
      <div class="page-stat">
        <span>举报案件总数</span>
        <strong>{{ reports.length }}</strong>
        <small>含各类用户提交内容</small>
      </div>
      <div class="page-stat">
        <span>待处理</span>
        <strong>{{ openCount }}</strong>
        <small>未结案的案件</small>
      </div>
      <div class="page-stat">
        <span>涉及内容类型</span>
        <strong>{{ new Set(reports.map((r) => r.contentType)).size }}</strong>
        <small>笔记 / 案例 / 帖子 / 资源 / 竞赛</small>
      </div>
    </div>

    <div class="page-toolbar mt-18">
      <div class="page-toolbar-left">
        <button class="page-filter-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          全部
        </button>
        <button
          v-for="s in reportFlowOrder"
          :key="s"
          class="page-filter-btn"
          :class="{ active: filter === s }"
          @click="filter = s"
        >
          {{ reportFlow[s].label }}
        </button>
      </div>
    </div>

    <div v-for="r in filtered" :key="r.id" class="review-card">
      <div class="review-head">
        <span class="page-list-icon"><AppIcon name="i-bellring" /></span>
        <div class="page-list-content">
          <strong>{{ r.title }}</strong>
          <p>{{ r.desc }}</p>
        </div>
        <span class="page-badge" :class="reportMeta(r.state).tone">{{ reportMeta(r.state).label }}</span>
      </div>

      <div class="admin-item-meta">
        <span class="admin-item-chip">案件编号：{{ r.id }}</span>
        <span class="admin-item-chip">内容类型：{{ r.contentType }}</span>
        <span class="admin-item-chip">举报人：{{ r.reporter }}</span>
        <span class="admin-item-chip">提交时间：{{ r.submittedAt }}</span>
        <span v-if="r.at" class="admin-item-chip amber">最近处置：{{ r.at }}</span>
        <span v-if="r.notifyAt" class="admin-item-chip green">已通知：{{ r.notifyAt }}</span>
      </div>

      <p v-if="r.reason" class="review-snippet">处理说明：{{ r.reason }}</p>

      <div class="review-actions">
        <button
          v-for="nx in nextStates[r.state] || []"
          :key="nx"
          class="mini-btn"
          :class="{ 'is-danger': actionDef[nx]?.danger }"
          @click="ask(r, nx)"
        >
          {{ actionDef[nx]?.label || reportFlow[nx].label }}
        </button>
        <button v-if="!r.notifyAt" class="mini-btn" @click="notify(r)">通知当事人</button>
      </div>

      <AdminReasonForm
        :open="pending.id === r.id"
        :action="actionDef[pending.action]?.label || ''"
        :hint="actionDef[pending.action]?.hint || ''"
        :case-no="r.id"
        :danger="actionDef[pending.action]?.danger"
        :confirm-text="actionDef[pending.action]?.danger ? '确认处置（高影响）' : '确认'"
        @cancel="cancel"
        @confirm="confirm"
      />
    </div>

    <div v-if="!filtered.length" class="page-empty">当前筛选条件下没有举报案件。</div>
  </AdminShell>
</template>
