<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AgentSlot from '../../components/AgentSlot.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { agentConfigSeeds } from '../../data/admin.js'
import { agentDefinitions } from '../../data/pages.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ⑦ Agent 管理（设计书 §7.7、§8）。
 *
 * §7.7 原文：Agent 管理仅涉及产品层面的开关与治理 ——
 *   启用状态、适用范围、阈值配置、运行状态与结果抽查。
 * §8 的硬约束：不允许 Agent 自行修改权限、绕过审核规则或取得管理员角色。
 *
 * 所以这里**没有**「给 Agent 授权」的入口，只有开关、适用范围和阈值。
 * 阈值下调意味着更多内容转人工复核，上调意味着更多内容由 Agent 直接放行 ——
 * 所以阈值调整属于高影响操作，必须填理由。
 */

const configs = computed(() =>
  agentConfigSeeds.map((a) => {
    const rt = adminStore.agentConfigs[a.key] || {}
    /* 职责与边界文案取自设计书 §8 原文（data/pages.js 的 agentDefinitions） */
    const def = agentDefinitions.find((d) => d.key === a.key)
    return {
      ...a,
      icon: def?.icon || 'i-spark',
      desc: def?.desc || a.desc,
      title: def?.title || a.title,
      enabled: rt.enabled ?? a.enabled,
      scope: rt.scope || a.scope,
      threshold: rt.threshold ?? a.threshold,
      note: rt.note || a.note,
    }
  })
)

const pending = ref({ key: '', action: '' })

const actionDef = {
  toggle: {
    type: 'agentToggle',
    label: '切换 Agent 启用状态',
    hint: '请说明调整原因与影响范围。停用自动拦截时需说明误判情况。',
    danger: true,
    confirm: '确认调整（高影响）',
  },
  threshold: {
    type: 'agentToggle',
    label: '调整置信度阈值',
    hint: '请说明调整依据。阈值下调会增加人工复核量，上调会增加自动放行量。',
    danger: true,
    confirm: '确认调整（高影响）',
  },
  scope: {
    type: 'agentToggle',
    label: '调整适用范围',
    hint: '请说明调整原因与受影响的范围。',
    danger: true,
    confirm: '确认调整（高影响）',
  },
}

function ask(cfg, action) {
  pending.value = { key: cfg.key, action }
}

function cancel() {
  pending.value = { key: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const cfg = configs.value.find((c) => c.key === pending.value.key)
  if (!cfg) return
  const action = pending.value.action
  const def = actionDef[action]
  if (!def) return

  const res = applyAdminAction({
    type: def.type,
    target: cfg.title,
    reason,
    caseNo: caseNo || cfg.key,
    mutate: () => {
      const cur = adminStore.agentConfigs[cfg.key] || {}
      adminStore.agentConfigs[cfg.key] = {
        ...cur,
        enabled: action === 'toggle' ? !cfg.enabled : cfg.enabled,
        threshold: cfg.threshold,
        scope: cfg.scope,
        note: cfg.note,
      }
      return action === 'toggle'
        ? `已${cfg.enabled ? '停用' : '启用'}，阈值 ${cfg.threshold}`
        : '配置已更新'
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}
</script>

<template>
  <AdminShell module="agents" title="Agent 管理" desc="仅涉及产品层面的开关与治理：启用状态、适用范围、阈值配置、运行状态与结果抽查。">
    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        不允许 Agent 自行修改权限、绕过审核规则或取得管理员角色。
        置信度阈值决定「有多少内容由 Agent 直接放行」——
        下调会增加人工复核量，上调会增加自动放行量，所以调整必须留痕。
        上述开关仅在当前预览中切换状态，不会启停真实模型或改变真实审核行为。
      </div>
    </div>

    <div v-for="cfg in configs" :key="cfg.key" class="agent-card">
      <div class="agent-icon"><AppIcon :name="cfg.icon" /></div>
      <div>
        <h3>{{ cfg.title }}</h3>
        <p>{{ cfg.desc }}</p>
        <div class="admin-item-meta">
          <span class="admin-item-chip">适用范围：{{ cfg.scope }}</span>
          <span class="admin-item-chip">置信度阈值：{{ cfg.threshold }}</span>
          <span class="admin-item-chip" :class="cfg.enabled ? 'green' : 'amber'">
            {{ cfg.enabled ? '已启用' : '已停用' }}
          </span>
        </div>
        <p class="auth-case-note">{{ cfg.note }}</p>
        <div class="page-actions mt-12">
          <button class="mini-btn" @click="ask(cfg, 'toggle')">
            {{ cfg.enabled ? '停用' : '启用' }}
          </button>
          <button class="mini-btn" @click="ask(cfg, 'threshold')">调整阈值</button>
          <button class="mini-btn" @click="ask(cfg, 'scope')">调整适用范围</button>
        </div>
      </div>
      <span class="page-badge" :class="cfg.enabled ? 'green' : 'gray'">
        {{ cfg.enabled ? '运行中' : '已暂停' }}
      </span>

      <AdminReasonForm
        :open="pending.key === cfg.key"
        :action="actionDef[pending.action]?.label || ''"
        :hint="actionDef[pending.action]?.hint || ''"
        :case-no="cfg.key"
        :danger="actionDef[pending.action]?.danger"
        :confirm-text="actionDef[pending.action]?.confirm || '确认'"
        @cancel="cancel"
        @confirm="confirm"
      />
    </div>

    <!-- 审核 Agent 承载区：设计书 §8.3，构建方式确定后在此接入实际功能 -->
    <AgentSlot agent-key="moderation" class="mt-18" />
  </AdminShell>
</template>
