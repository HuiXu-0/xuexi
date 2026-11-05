<script setup>
import AppIcon from './AppIcon.vue'

/**
 * 统一的空状态展示。
 *
 * 此前各页面都是一段纯文字（.page-empty / .no-results / .empty-state），
 * 用户搜不到东西时只能干看着，没有图标、也没有下一步动作。
 * 这里统一为「图标 + 说明 + 可选主操作」，让空页面也给出明确出路。
 */
defineProps({
  /** 主说明文字 */
  message: { type: String, required: true },
  /** 补充说明，显示在主说明下方 */
  hint: { type: String, default: '' },
  /** 图标名，对应 IconSprite 中的 symbol */
  icon: { type: String, default: 'i-search' },
  /** 主操作按钮文案，不传则不渲染按钮 */
  actionText: { type: String, default: '' },
  /** 主操作按钮的样式：solid / outline */
  actionVariant: { type: String, default: 'outline' },
})

defineEmits(['action'])
</script>

<template>
  <div class="empty-state-block" role="status">
    <span class="empty-state-icon"><AppIcon :name="icon" /></span>
    <strong class="empty-state-message">{{ message }}</strong>
    <p v-if="hint" class="empty-state-hint">{{ hint }}</p>
    <button
      v-if="actionText"
      class="empty-state-action"
      :class="actionVariant"
      type="button"
      @click="$emit('action', $event)"
    >
      {{ actionText }}
    </button>
    <div v-if="$slots.default" class="empty-state-extra">
      <slot />
    </div>
  </div>
</template>
