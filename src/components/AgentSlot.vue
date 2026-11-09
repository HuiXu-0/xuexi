<script setup>
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import { agentMeta, agentSlotDescription } from '../services/agentContract.js'
import { agentRuntime } from '../services/agentRuntime.js'

/**
 * Agent 承载区。
 *
 * 界面上预留的「将来放 Agent 的那块地方」——
 * 标明这块区域由哪个 Agent 负责、它的职责与边界。
 *
 * 后续接入真实 Agent 时，把 <slot> 里的占位内容换成实际组件即可，
 * 外框、说明与状态展示都可以沿用。
 */
const props = defineProps({
  /** 对应 agentContract.AGENT_KEYS 的键 */
  agentKey: { type: String, required: true },
  /** 标题覆盖 */
  title: { type: String, default: '' },
  /** 紧凑模式：只显示一行说明 */
  compact: { type: Boolean, default: false },
})

const meta = computed(() => agentMeta[props.agentKey] || null)
const slotDesc = computed(() => agentSlotDescription[props.agentKey] || '')
const state = computed(() => agentRuntime[props.agentKey] || { status: 'idle' })

/** 状态文案：明确区分"未接入"和"已接入"，不夸大能力 */
const statusText = computed(() => {
  switch (state.value.status) {
    case 'loading':
      return '处理中…'
    case 'ready':
      return '已接入'
    case 'error':
      return '调用异常'
    default:
      return '待接入'
  }
})
</script>

<template>
  <section v-if="meta" class="agent-slot" :class="{ compact }">
    <div class="agent-slot-head">
      <span class="agent-slot-icon"><AppIcon :name="meta.icon" /></span>
      <div class="agent-slot-title">
        <strong>{{ title || meta.title }}</strong>
        <span class="agent-slot-status" :class="state.status">{{ statusText }}</span>
      </div>
    </div>

    <p class="agent-slot-purpose">{{ meta.purpose }}</p>

    <!-- 预留插槽：将来在这里挂载真实 Agent 的界面 -->
    <slot>
      <div v-if="!compact" class="agent-slot-placeholder">
        <AppIcon name="i-info" />
        <span>此处预留 {{ meta.short }} 的接入位置。构建方式确定后在此挂载实际功能，当前仅展示职责与边界说明。</span>
      </div>
    </slot>

    <div class="agent-slot-boundary">
      <span class="agent-slot-boundary-label">职责边界</span>
      <p>{{ meta.boundary }}</p>
      <p v-if="slotDesc" class="agent-slot-desc">{{ slotDesc }}</p>
    </div>
  </section>
</template>
