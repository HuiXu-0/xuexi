<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { adminNav } from '../data/adminNav.js'

/**
 * 管理员端页面外壳。
 *
 * 设计书 §4.3：管理员端主导航是 9 个模块。
 * 拆成 9 个独立路由后，每个页面仍需要一致的标题、说明与模块切换，
 * 这部分抽到本组件里，避免 9 份重复。
 *
 * 模块切换用路由跳转而不是本地 activeModule ——
 * 这样地址栏能反映当前位置，刷新也不会回到第一个模块。
 */

const props = defineProps({
  /** 路由 name，与 adminNav 的 key 对应 */
  module: { type: String, required: true },
  /** 页面主标题 */
  title: { type: String, required: true },
  /** 页面说明 */
  desc: { type: String, default: '' },
  /** 标题上方的小标 */
  kicker: { type: String, default: 'PLATFORM OPERATIONS' },
  /** 右上角自定义内容 */
  hasActions: { type: Boolean, default: false },
})

const route = useRoute()
const router = useRouter()

const current = computed(() => adminNav.find((m) => m.key === props.module) || adminNav[0])

function go(key) {
  if (key === props.module) return
  router.push({ name: adminNav.find((m) => m.key === key)?.route || 'admin' })
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">{{ kicker }}</div>
        <h1>{{ title }}</h1>
        <p>{{ desc }}</p>
      </div>
      <div class="page-heading-actions">
        <slot name="actions" />
      </div>
    </div>

    <!-- 9 个模块的路由切换 -->
    <nav class="admin-modules" aria-label="管理模块">
      <button
        v-for="m in adminNav"
        :key="m.key"
        class="admin-module-btn"
        :class="{ active: m.key === module }"
        type="button"
        :aria-current="m.key === module ? 'page' : undefined"
        @click="go(m.key)"
      >
        <AppIcon :name="m.icon" />
        <span>{{ m.title }}</span>
      </button>
    </nav>

    <div class="page-panel mt-18">
      <div class="page-section-head">
        <div>
          <h2>{{ current.title }}</h2>
          <p>{{ current.desc }}</p>
        </div>
        <span class="page-badge">{{ current.actions.length }} 项操作</span>
      </div>

      <slot />
    </div>
  </section>
</template>
