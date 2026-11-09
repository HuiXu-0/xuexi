<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { feedbackSeeds, feedbackStates, feedbackStateOrder, feedbackMeta } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ⑤ 反馈与创新建议管理（设计书 §7.5、§12.3）。
 *
 * §12.3 原文：「提交者应能看到处理进度。」
 * 所以反馈不是一个「已处理」勾选，而是 9 个状态的完整链条：
 *   已提交 → 已分配 → 复现中 → 已排期 → 开发中 → 测试中 → 已解决
 *                                                  ↘ 不采纳 → 已关闭
 * 提交者在个人中心可以看到自己在哪一档。
 */

const filter = ref('all')

const feedbacks = computed(() =>
  feedbackSeeds.map((f) => {
    const rt = adminStore.feedbackStates[f.id] || {}
    const state = rt.state || f.state
    return {
      ...f,
      state,
      owner: rt.owner ?? f.owner,
      reply: rt.reply || '',
      at: rt.at || '',
      meta: feedbackMeta(state),
    }
  })
)

const filtered = computed(() =>
  filter.value === 'all' ? feedbacks.value : feedbacks.value.filter((f) => f.state === filter.value)
)

const stats = computed(() => [
  { label: '反馈总数', value: feedbacks.value.length, note: '含 Bug 与功能建议' },
  {
    label: '处理中',
    value: feedbacks.value.filter((f) => !['resolved', 'rejected', 'closed'].includes(f.state)).length,
    note: '尚未结案',
  },
  {
    label: '待分配负责人',
    value: feedbacks.value.filter((f) => !f.owner).length,
    note: '需指定处理人',
  },
])

/* ---------- 状态机 ---------- */
const nextStates = {
  submitted: ['assigned', 'rejected'],
  assigned: ['reproducing', 'rejected'],
  reproducing: ['planned', 'rejected'],
  planned: ['inProgress', 'rejected'],
  inProgress: ['testing', 'rejected'],
  testing: ['resolved', 'rejected'],
  resolved: ['closed'],
  rejected: ['closed'],
  closed: [],
}

const actionDef = {
  assigned: { type: 'feedbackAssign', label: '分配负责人', hint: '可说明分配依据。', danger: false },
  reproducing: { type: 'feedbackAssign', label: '进入复现中', hint: '可说明复现进展。', danger: false },
  planned: { type: 'feedbackAssign', label: '确认有效并排期', hint: '请说明排期依据与预计版本。', danger: false },
  inProgress: { type: 'feedbackAssign', label: '进入开发中', hint: '可说明当前进展。', danger: false },
  testing: { type: 'feedbackAssign', label: '进入测试中', hint: '可说明测试范围。', danger: false },
  resolved: { type: 'feedbackResolve', label: '标记已验证并回复', hint: '请说明验证结果与给提交者的回复内容。', danger: false },
  rejected: { type: 'feedbackResolve', label: '标记不采纳', hint: '请说明不采纳的原因，提交者会看到这段说明。', danger: true },
  closed: { type: 'feedbackResolve', label: '关闭反馈', hint: '可说明结案说明。', danger: false },
}

const owners = ['管理员演示账号', '资源维护组', '内容管理员']

const pending = ref({ id: '', action: '' })

function ask(fb, action) {
  pending.value = { id: fb.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const fb = feedbacks.value.find((f) => f.id === pending.value.id)
  if (!fb) return
  const action = pending.value.action
  const def = actionDef[action]
  if (!def) return

  const res = applyAdminAction({
    type: def.type,
    target: fb.title,
    reason,
    caseNo: caseNo || fb.id,
    mutate: () => {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const cur = adminStore.feedbackStates[fb.id] || {}
      adminStore.feedbackStates[fb.id] = {
        ...cur,
        state: action,
        owner: cur.owner || fb.owner || '管理员演示账号',
        reply: ['resolved', 'rejected'].includes(action) ? reason : cur.reply || '',
        at: now,
      }
      return `反馈状态变更为「${feedbackMeta(action).label}」`
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}

/** 分配负责人（普通操作） */
function assign(fb, owner) {
  const res = applyAdminAction({
    type: 'feedbackAssign',
    target: fb.title,
    reason: `分配给 ${owner}`,
    caseNo: fb.id,
    mutate: () => {
      const cur = adminStore.feedbackStates[fb.id] || {}
      adminStore.feedbackStates[fb.id] = { ...cur, owner }
      return `负责人已变更为 ${owner}`
    },
  })
  showToast(res.message)
}
</script>

<template>
  <AdminShell module="feedback" title="反馈与创新建议管理" desc="分配 Bug 与功能建议的负责人，追踪状态，记录验证结果并回复提交者。">
    <div class="page-callout">
      <AppIcon name="i-send" />
      <div>
        提交者应能看到处理进度。Bug 与功能建议走同一条状态链，
        但不采纳的必须说明原因 —— 不解释就关闭是最伤用户信任的做法。
      </div>
    </div>

    <div class="page-stats">
      <div v-for="s in stats" :key="s.label" class="page-stat">
        <span>{{ s.label }}</span>
        <strong>{{ s.value }}</strong>
        <small>{{ s.note }}</small>
      </div>
    </div>

    <div class="page-toolbar mt-18">
      <div class="page-toolbar-left">
        <button class="page-filter-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          全部
        </button>
        <button
          v-for="s in feedbackStateOrder"
          :key="s"
          class="page-filter-btn"
          :class="{ active: filter === s }"
          @click="filter = s"
        >
          {{ feedbackStates[s].label }}
        </button>
      </div>
    </div>

    <div v-for="f in filtered" :key="f.id" class="review-card">
      <div class="review-head">
        <span class="page-list-icon"><AppIcon :name="f.kind === 'bug' ? 'i-shield' : 'i-spark'" /></span>
        <div class="page-list-content">
          <strong>{{ f.title }}</strong>
          <p>{{ f.desc }}</p>
        </div>
        <span class="page-badge" :class="f.meta.tone">{{ f.meta.label }}</span>
      </div>

      <div class="admin-item-meta">
        <span class="admin-item-chip">编号：{{ f.id }}</span>
        <span class="admin-item-chip">{{ f.kind === 'bug' ? 'Bug 反馈' : '功能建议' }}</span>
        <span class="admin-item-chip">提交者：{{ f.submitter }}</span>
        <span class="admin-item-chip">提交时间：{{ f.submittedAt }}</span>
        <span class="admin-item-chip" :class="f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : ''">
          严重程度：{{ f.severity === 'high' ? '高' : f.severity === 'medium' ? '中' : '低' }}
        </span>
        <span class="admin-item-chip">负责人：{{ f.owner || '待分配' }}</span>
      </div>

      <p v-if="f.reply" class="review-snippet">给提交者的回复：{{ f.reply }}</p>

      <div class="page-actions mt-12">
        <select
          v-if="!f.owner"
          class="page-select"
          :value="''"
          @change="assign(f, $event.target.value)"
        >
          <option value="" disabled>分配负责人…</option>
          <option v-for="o in owners" :key="o" :value="o">{{ o }}</option>
        </select>
        <button
          v-for="nx in nextStates[f.state] || []"
          :key="nx"
          class="mini-btn"
          :class="{ 'is-danger': actionDef[nx]?.danger }"
          @click="ask(f, nx)"
        >
          {{ actionDef[nx]?.label || feedbackStates[nx].label }}
        </button>
      </div>

      <!-- 状态链可视化：让提交者视角的处理进度一眼可见 -->
      <div class="flow-track">
        <template v-for="(s, i) in feedbackStateOrder" :key="s">
          <span
            class="flow-node"
            :class="{
              done: feedbackStateOrder.indexOf(f.state) > i,
              current: f.state === s,
            }"
          >
            {{ feedbackStates[s].label }}
          </span>
          <span v-if="i < feedbackStateOrder.length - 1" class="flow-arrow">›</span>
        </template>
      </div>

      <AdminReasonForm
        :open="pending.id === f.id"
        :action="actionDef[pending.action]?.label || ''"
        :hint="actionDef[pending.action]?.hint || ''"
        :case-no="f.id"
        :danger="actionDef[pending.action]?.danger"
        :confirm-text="actionDef[pending.action]?.danger ? '确认（高影响）' : '确认'"
        @cancel="cancel"
        @confirm="confirm"
      />
    </div>

    <div v-if="!filtered.length" class="page-empty">当前筛选条件下没有反馈。</div>
  </AdminShell>
</template>
