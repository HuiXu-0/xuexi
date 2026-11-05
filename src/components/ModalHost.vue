<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import AppIcon from './AppIcon.vue'
import {
  useModal,
  registerModalElements,
  closeModal,
  onBackdropClick,
} from '../composables/useModal.js'
import { feedbackSchemas } from '../data/details.js'
import { handleCreateSubmit } from '../stores/createActions.js'
import { showToast } from '../composables/useToast.js'

const { modal } = useModal()

const modalEl = ref(null)
const backdropEl = ref(null)
const closeBtnEl = ref(null)

/** 当前表单字段（反馈表单 / 创建表单共用渲染） */
const formFields = computed(() => modal.schema?.fields || [])
const feedbackConfig = computed(() => feedbackSchemas[modal.createKind] || null)
const createKind = computed(() => modal.createKind)

function fieldId(index) {
  return modal.isCreate ? `createField${index}` : `mfield${index}`
}

function onKeydown(e) {
  if (e.key === 'Escape') closeModal()
}

onMounted(() => {
  registerModalElements({
    modal: modalEl.value,
    backdrop: backdropEl.value,
    closeBtn: closeBtnEl.value,
  })
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})

function onFormSubmit(event) {
  const form = event.currentTarget
  event.preventDefault()
  if (!modal.isCreate) {
    closeModal()
    showToast('演示表单已验证；当前预览不会实际发送数据。')
    return
  }
  const values = Object.fromEntries(new FormData(form).entries())
  values.title = (values.title || '').trim()
  closeModal()
  handleCreateSubmit(createKind.value, values)
}
</script>

<template>
  <div
    ref="backdropEl"
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modalTitle"
    @click.self="onBackdropClick"
  >
    <div ref="modalEl" class="modal">
      <div class="modal-head">
        <div>
          <h3 id="modalTitle">{{ modal.title }}</h3>
          <p v-if="modal.subtitle">{{ modal.subtitle }}</p>
        </div>
        <button ref="closeBtnEl" class="close-btn" aria-label="关闭" @click="closeModal">
          <AppIcon name="i-menu" />
        </button>
      </div>

      <div class="modal-body">
        <!-- 详情 -->
        <template v-if="modal.kind === 'detail'">
          <p>{{ modal.body }}</p>
          <div class="modal-info">
            <div v-for="f in modal.fields" :key="f[0]" class="info-cell">
              <span>{{ f[0] }}</span><strong>{{ f[1] }}</strong>
            </div>
          </div>
          <div class="form-help">演示说明：此预览不连接真实平台数据，也不会实际提交或发布内容。</div>
          <div class="modal-actions">
            <button class="outline-btn" @click="closeModal">关闭详情</button>
          </div>
        </template>

        <!-- 规则说明 -->
        <template v-else-if="modal.kind === 'policy'">
          <p>{{ modal.body }}</p>
          <div class="form-help">{{ modal.note }}</div>
          <div class="modal-actions">
            <button class="solid-btn" @click="closeModal">知道了</button>
          </div>
        </template>

        <!-- 子页条目详情 -->
        <template v-else-if="modal.kind === 'pageItem'">
          <p>{{ modal.body }}</p>
          <div class="page-callout">
            <AppIcon name="i-info" />
            <div>此预览不连接真实账号、数据库或外部资源链接。</div>
          </div>
          <div class="modal-actions">
            <button class="solid-btn" @click="closeModal">关闭</button>
          </div>
        </template>

        <!-- 表单：反馈 / 创建 -->
        <template v-else-if="modal.kind === 'form'">
          <p v-if="!modal.isCreate">{{ feedbackConfig?.intro }}</p>
          <form @submit.prevent="onFormSubmit">
            <div v-for="(field, i) in formFields" :key="fieldId(i)" class="form-row">
              <label :for="fieldId(i)">
                {{ field.label }}<template v-if="modal.isCreate && field.required">（必填）</template>
                <template v-else-if="!modal.isCreate && i === 0">（建议填写）</template>
              </label>

              <textarea
                v-if="field.type === 'textarea'"
                :id="fieldId(i)"
                :name="field.name"
                :placeholder="field.placeholder"
                :required="field.required"
              ></textarea>

              <select
                v-else-if="field.type === 'select'"
                :id="fieldId(i)"
                :name="field.name"
                class="page-select select-full"
              >
                <option v-for="opt in field.options" :key="opt[0]" :value="opt[0]">{{ opt[1] }}</option>
              </select>

              <input
                v-else
                :id="fieldId(i)"
                :name="field.name"
                :type="field.type === 'url' ? 'url' : 'text'"
                :placeholder="field.placeholder"
                :required="field.required"
              />
            </div>

            <div class="form-help">
              {{
                modal.isCreate
                  ? '本地交互原型：提交内容只保存在当前页面内存中，不会上传服务器或真正发布。正式发布需经过权限、授权和内容规则检查。'
                  : '这是本地交互预览，不会将内容发送到服务器。'
              }}
            </div>

            <div class="modal-actions">
              <button type="button" class="outline-btn" @click="closeModal">取消</button>
              <button type="submit" class="solid-btn">
                {{ modal.isCreate ? modal.schema?.submit : feedbackConfig?.submit }}
                <AppIcon name="i-send" />
              </button>
            </div>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
