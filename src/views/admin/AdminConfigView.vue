<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { configSeeds, configStates, configMeta } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ⑨ 平台基础配置（设计书 §7.9）。
 *
 * §7.9 原文：维护资源类别、技术方向标签、竞赛类型、问题状态与
 *   用户可见的社区规则说明。
 *   停用分类时应规定既有内容如何处理（迁移到替代分类、归入「其他」
 *   或保留历史分类），不应导致内容无故丢失。
 *
 * 所以「停用并迁移」必须先选迁移方式，才能提交。
 */

const configs = computed(() =>
  configSeeds.map((c) => {
    const rt = adminStore.configStates[c.id] || {}
    return {
      ...c,
      state: rt.state || c.state,
      note: rt.note || c.note,
      migration: rt.migration ?? c.migration,
      meta: configMeta(rt.state || c.state),
    }
  })
)

/** 可选的迁移方式 */
const migrationOptions = [
  { key: 'merge', label: '迁移到替代分类', desc: '既有内容转入指定分类，保留可检索性。' },
  { key: 'other', label: '归入「其他」', desc: '内容统一收进兜底分类，由用户重新整理。' },
  { key: 'keep', label: '保留历史分类', desc: '内容留在原分类但不再对外展示，仅历史可查。' },
]

const stats = computed(() => [
  { label: '配置项总数', value: configs.value.length, note: '含资源类别 / 标签 / 竞赛类型' },
  { label: '启用中', value: configs.value.filter((c) => c.state === 'active').length, note: '对外可见' },
  {
    label: '待合并',
    value: configs.value.filter((c) => c.state === 'pendingMerge').length,
    note: '需确认迁移方式',
  },
])

/* ---------- 操作 ---------- */
const pending = ref({ id: '', action: '' })

const actionDef = {
  disable: {
    type: 'configChange',
    label: '停用并迁移',
    hint: '请选择迁移方式，并说明调整原因。既有内容不应无故丢失。',
    danger: true,
    confirm: '确认停用并迁移（高影响）',
  },
  merge: {
    type: 'configChange',
    label: '合并同义标签',
    hint: '合并前需检查关联内容数量，并说明合并依据。',
    danger: true,
    confirm: '确认合并（高影响）',
  },
  enable: {
    type: 'configChange',
    label: '启用配置项',
    hint: '可说明启用依据。',
    danger: false,
    confirm: '确认启用',
  },
}

function ask(cfg, action) {
  pending.value = { id: cfg.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

/** 停用时先选迁移方式 */
const migrationChoice = ref('')

function confirm({ reason, caseNo }) {
  const cfg = configs.value.find((c) => c.id === pending.value.id)
  if (!cfg) return
  const action = pending.value.action
  const def = actionDef[action]
  if (!def) return

  if (action === 'disable' && !migrationChoice.value) {
    showToast('停用分类必须先选择既有内容的迁移方式。')
    return
  }

  const chosen = migrationOptions.find((m) => m.key === migrationChoice.value)

  const res = applyAdminAction({
    type: def.type,
    target: `${cfg.name}（${cfg.kind}）`,
    reason,
    caseNo: caseNo || cfg.id,
    mutate: () => {
      const cur = adminStore.configStates[cfg.id] || {}
      adminStore.configStates[cfg.id] = {
        ...cur,
        state: action === 'disable' ? 'disabled' : action === 'enable' ? 'active' : cur.state || cfg.state,
        migration:
          action === 'disable'
            ? `${chosen?.label || ''} —— ${chosen?.desc || ''}`.trim()
            : cur.migration ?? cfg.migration,
        note: action === 'merge' ? `已合并至「${cfg.name}」` : cur.note || cfg.note,
      }
      return action === 'disable'
        ? `已停用，迁移方式：${chosen?.label}`
        : '配置已更新'
    },
  })

  cancel()
  migrationChoice.value = ''
  showToast(res.ok ? res.message : res.message)
}
</script>

<template>
  <AdminShell module="config" title="平台基础配置" desc="维护资源类别、技术方向标签、竞赛类型、问题状态与用户可见的社区规则说明。">
    <div class="page-callout">
      <AppIcon name="i-grid" />
      <div>
        停用分类时应规定既有内容如何处理（迁移到替代分类、归入「其他」或保留历史分类），
        不应导致内容无故丢失。合并同义标签前必须先确认关联内容数量。
      </div>
    </div>

    <div class="page-stats">
      <div v-for="s in stats" :key="s.label" class="page-stat">
        <span>{{ s.label }}</span>
        <strong>{{ s.value }}</strong>
        <small>{{ s.note }}</small>
      </div>
    </div>

    <div v-for="c in configs" :key="c.id" class="page-list-row">
      <span class="page-list-icon"><AppIcon name="i-grid" /></span>
      <div class="page-list-content">
        <strong>{{ c.name }}</strong>
        <p>{{ c.kind }} · {{ c.note }}</p>
        <div class="admin-item-meta">
          <span class="admin-item-chip">编号：{{ c.id }}</span>
          <span class="admin-item-chip" :class="c.meta.tone">{{ c.meta.label }}</span>
          <span v-if="c.migration" class="admin-item-chip amber">迁移：{{ c.migration }}</span>
        </div>

        <div class="page-actions mt-12">
          <button
            v-if="c.state !== 'disabled'"
            class="mini-btn"
            @click="ask(c, 'disable')"
          >
            停用并迁移
          </button>
          <button v-else class="mini-btn" @click="ask(c, 'enable')">重新启用</button>
          <button class="mini-btn" @click="ask(c, 'merge')">合并同义标签</button>
        </div>

        <!-- 停用必须先选迁移方式 -->
        <div v-if="pending.id === c.id && pending.action === 'disable'" class="migration-picker">
          <strong class="auth-picker-label">既有内容的处理方式（必选）</strong>
          <div class="punish-grid">
            <button
              v-for="m in migrationOptions"
              :key="m.key"
              class="punish-item punish-pick"
              :class="{ active: migrationChoice === m.key }"
              @click="migrationChoice = m.key"
            >
              <strong>{{ m.label }}</strong>
              <small>{{ m.desc }}</small>
            </button>
          </div>
        </div>

        <AdminReasonForm
          :open="pending.id === c.id"
          :action="actionDef[pending.action]?.label || ''"
          :hint="actionDef[pending.action]?.hint || ''"
          :case-no="c.id"
          :danger="actionDef[pending.action]?.danger"
          :confirm-text="actionDef[pending.action]?.confirm || '确认'"
          @cancel="cancel"
          @confirm="confirm"
        />
      </div>
    </div>
  </AdminShell>
</template>
