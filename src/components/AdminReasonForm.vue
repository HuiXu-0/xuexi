<script setup>
import { computed, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'

/**
 * 高影响操作的「填写理由」确认层。
 *
 * 设计书 §7.2.2：涉及角色变化、内容删除恢复、封禁解封、规则更新的操作
 * 需要记录原因，并且高影响操作应先确认再执行。
 *
 * 为什么自己写而不是用全局 ModalHost：
 *   全局 ModalHost 是全局常驻单例，多个模块共用一个状态槽，
 *   两个页面同时触发会互相抢状态。这里是管理员端专用的内联确认层，
 *   每个卡片自己持有展开状态，互不干扰。
 */

const props = defineProps({
  /** 是否展开 */
  open: { type: Boolean, default: false },
  /** 操作名称，显示在标题里 */
  action: { type: String, default: '执行此操作' },
  /** 理由输入框的提示文案 */
  hint: { type: String, default: '请说明处理理由。' },
  /** 理由是否为必填（高影响操作为 true） */
  required: { type: Boolean, default: true },
  /** 关联案件编号 */
  caseNo: { type: String, default: '' },
  /** 提交按钮文案 */
  confirmText: { type: String, default: '确认执行' },
  /** 危险操作时提交按钮用红色 */
  danger: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

const reason = ref('')
const caseInput = ref(props.caseNo)

/* 每次重新展开时清空上一次的输入，避免误提交旧理由 */
watch(
  () => props.open,
  (v) => {
    if (v) {
      reason.value = ''
      caseInput.value = props.caseNo
    }
  }
)

const canSubmit = computed(() => (props.required ? reason.value.trim().length > 0 : true))

function submit() {
  if (!canSubmit.value) return
  emit('confirm', { reason: reason.value.trim(), caseNo: caseInput.value.trim() })
}
</script>

<template>
  <div v-if="open" class="admin-reason">
    <div class="admin-reason-head">
      <span class="admin-reason-icon"><AppIcon name="i-info" /></span>
      <div>
        <strong>{{ action }}</strong>
        <p>{{ hint }}</p>
      </div>
    </div>

    <div class="auth-field">
      <label for="adminReason">处理理由{{ required ? ' *' : '' }}</label>
      <div class="auth-input-wrap">
        <AppIcon name="i-file" />
        <textarea
          id="adminReason"
          v-model="reason"
          class="textarea-md"
          rows="3"
          placeholder="这条记录会进入操作审计，写清依据以便后续复核"
        ></textarea>
      </div>
    </div>

    <div class="auth-field mt-12">
      <label for="adminCase">关联案件编号</label>
      <div class="auth-input-wrap">
        <AppIcon name="i-file" />
        <input id="adminCase" v-model="caseInput" type="text" placeholder="例：W-105、RP-203" />
      </div>
    </div>

    <div class="page-actions mt-12">
      <button class="mini-btn" @click="emit('cancel')">取消</button>
      <button
        class="mini-btn"
        :class="danger ? 'is-danger' : 'primary'"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ confirmText }}
      </button>
    </div>
    <p v-if="required && !canSubmit" class="auth-case-note">
      这是高影响操作，必须填写处理理由后才能执行。
    </p>
  </div>
</template>
