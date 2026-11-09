<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { ruleSeeds, ruleStates, ruleMeta } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ⑥ 审核规则管理（设计书 §7.6）。
 *
 * §7.6 原文要点：
 *   - 规则应区分确定性与需上下文判断两类；
 *   - 敏感词不能只依赖庞大词库，需考虑引用、技术讨论与教学用途，
 *     避免把所有包含某个词的文本都认定为违规；
 *   - 规则变更后可回滚不合理版本；
 *   - 需要查看命中与误判情况。
 */

const rules = computed(() =>
  ruleSeeds.map((r) => {
    const rt = adminStore.ruleStates[r.id] || {}
    return {
      ...r,
      state: rt.state || r.state,
      version: rt.version || r.version,
      hits: rt.hits ?? r.hits,
      falsePositives: rt.falsePositives ?? r.falsePositives,
      history: rt.history || [],
    }
  })
)

/** 误判率超过 15% 的规则需要重点关注 */
function fpRate(r) {
  if (!r.hits) return 0
  return Math.round((r.falsePositives / r.hits) * 100)
}

const stats = computed(() => [
  { label: '规则总数', value: rules.value.length, note: '含草稿与已停用' },
  { label: '启用中', value: rules.value.filter((r) => r.state === 'active').length, note: '参与自动审核' },
  {
    label: '高误判规则',
    value: rules.value.filter((r) => fpRate(r) >= 15).length,
    note: '误判率 ≥ 15%，建议复查',
  },
])

/* ---------- 操作 ---------- */
const pending = ref({ id: '', action: '' })

const actionDef = {
  update: {
    type: 'ruleUpdate',
    label: '修改规则',
    hint: '请说明规则调整内容，以及如何避免误判增加。',
    danger: true,
    confirm: '确认修改（高影响）',
  },
  disable: {
    type: 'ruleDisable',
    label: '停用规则',
    hint: '请说明停用原因与停用后的替代处置方式。',
    danger: true,
    confirm: '确认停用（高影响）',
  },
  rollback: {
    type: 'ruleRollback',
    label: '回滚规则',
    hint: '请说明回滚原因与目标版本。',
    danger: true,
    confirm: '确认回滚（高影响）',
  },
  enable: {
    type: 'ruleUpdate',
    label: '启用规则',
    hint: '可说明启用依据。',
    danger: false,
    confirm: '确认启用',
  },
  sample: {
    type: 'ruleUpdate',
    label: '抽查命中样本',
    hint: '可说明抽查范围与结论。',
    danger: false,
    confirm: '确认抽查',
  },
}

function ask(rule, action) {
  pending.value = { id: rule.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const rule = rules.value.find((r) => r.id === pending.value.id)
  if (!rule) return
  const action = pending.value.action
  const def = actionDef[action]
  if (!def) return

  const res = applyAdminAction({
    type: def.type,
    target: `${rule.name} ${rule.version}`,
    reason,
    caseNo: caseNo || rule.id,
    mutate: () => {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const cur = adminStore.ruleStates[rule.id] || {}
      const history = [...(cur.history || [])]

      if (action === 'update') {
        history.push({ time: now, version: rule.version, action: '修改', reason })
      } else if (action === 'rollback') {
        history.push({ time: now, version: rule.version, action: '回滚', reason })
      } else if (action === 'disable') {
        history.push({ time: now, version: rule.version, action: '停用', reason })
      } else if (action === 'enable') {
        history.push({ time: now, version: rule.version, action: '启用', reason })
      } else if (action === 'sample') {
        history.push({ time: now, version: rule.version, action: '抽查', reason })
      }

      adminStore.ruleStates[rule.id] = {
        ...cur,
        state:
          action === 'disable' ? 'disabled' : action === 'enable' ? 'active' : cur.state || rule.state,
        version: cur.version || rule.version,
        history,
      }
      return action === 'sample' ? '抽查完成' : `规则状态变更为「${ruleMeta(action === 'disable' ? 'disabled' : 'active').label}」`
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}
</script>

<template>
  <AdminShell module="rules" title="审核规则管理" desc="维护违禁词、辱骂骚扰、垃圾广告、恶意链接、隐私泄露与侵权风险规则，可回滚不合理变更。">
    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        规则应区分确定性与需上下文判断两类。敏感词不能只依赖庞大词库 ——
        需考虑引用、技术讨论与教学用途，避免把所有包含某个词的文本都认定为违规。
        规则变更后可回滚不合理版本。
      </div>
    </div>

    <div class="page-stats">
      <div v-for="s in stats" :key="s.label" class="page-stat">
        <span>{{ s.label }}</span>
        <strong>{{ s.value }}</strong>
        <small>{{ s.note }}</small>
      </div>
    </div>

    <div v-for="r in rules" :key="r.id" class="review-card">
      <div class="review-head">
        <span class="page-list-icon"><AppIcon name="i-shield" /></span>
        <div class="page-list-content">
          <strong>{{ r.name }}</strong>
          <p>适用范围：{{ r.scope }}</p>
        </div>
        <span class="page-badge" :class="ruleMeta(r.state).tone">{{ ruleMeta(r.state).label }}</span>
      </div>

      <div class="admin-item-meta">
        <span class="admin-item-chip">编号：{{ r.id }}</span>
        <span class="admin-item-chip">类型：{{ r.type }}</span>
        <span class="admin-item-chip">版本：{{ r.version }}</span>
        <span class="admin-item-chip">近期命中：{{ r.hits }}</span>
        <span
          class="admin-item-chip"
          :class="fpRate(r) >= 15 ? 'amber' : fpRate(r) >= 5 ? 'medium' : 'green'"
        >
          误判反馈：{{ r.falsePositives }}（{{ fpRate(r) }}%）
        </span>
      </div>

      <p v-if="fpRate(r) >= 15" class="review-snippet">
        误判率偏高，可能存在把技术讨论或教学引用误判为违规的情况。
        建议先抽查命中样本，再决定是调整规则还是暂时停用。
      </p>

      <div class="review-actions">
        <button class="mini-btn" @click="ask(r, 'update')">修改规则</button>
        <button v-if="r.state === 'active'" class="mini-btn" @click="ask(r, 'disable')">停用</button>
        <button v-else class="mini-btn" @click="ask(r, 'enable')">启用</button>
        <button class="mini-btn" @click="ask(r, 'rollback')">回滚</button>
        <button class="mini-btn" @click="ask(r, 'sample')">抽查样本</button>
      </div>

      <div v-if="r.history.length" class="review-history">
        <div v-for="(h, i) in r.history" :key="i" class="review-history-row">
          <strong>{{ h.time }}</strong>
          <span>{{ h.action }} {{ h.version }} — {{ h.reason }}</span>
        </div>
      </div>

      <AdminReasonForm
        :open="pending.id === r.id"
        :action="actionDef[pending.action]?.label || ''"
        :hint="actionDef[pending.action]?.hint || ''"
        :case-no="r.id"
        :danger="actionDef[pending.action]?.danger"
        :confirm-text="actionDef[pending.action]?.confirm || '确认'"
        @cancel="cancel"
        @confirm="confirm"
      />
    </div>
  </AdminShell>
</template>
