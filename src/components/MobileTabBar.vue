<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useDevice } from '../composables/useDevice.js'

/**
 * 移动端底部标签栏。
 *
 * 桌面端用顶部导航，手机上顶部空间宝贵、滚动时又常被隐藏，
 * 所以在手机上改用底部固定 tab：拇指可达、始终可见。
 * 仅在 data-device="mobile" 时显示（平板按桌面处理）。
 */
const route = useRoute()
const router = useRouter()
const { isMobile } = useDevice()

const tabs = [
  { route: 'home', label: '首页', icon: 'i-grid' },
  { route: 'forum', label: '论坛', icon: 'i-users' },
  { route: 'notes', label: '笔记', icon: 'i-book' },
  { route: 'planner', label: '规划', icon: 'i-target' },
  { route: 'profile', label: '我的', icon: 'i-file' },
]

/* 详情类页面（教师工作台、管理员端等）不属于 tab 目标，此时不高亮任何一项 */
const tabRoutes = computed(() => tabs.map((t) => t.route))
const activeRoute = computed(() =>
  tabRoutes.value.includes(route.name) ? route.name : ''
)
</script>

<template>
  <nav v-if="isMobile" class="tab-bar" aria-label="底部导航">
    <button
      v-for="t in tabs"
      :key="t.route"
      class="tab-item"
      :class="{ active: activeRoute === t.route }"
      :aria-current="activeRoute === t.route ? 'page' : undefined"
      @click="router.push({ name: t.route })"
    >
      <span class="tab-icon"><AppIcon :name="t.icon" /></span>
      <span class="tab-label">{{ t.label }}</span>
    </button>
  </nav>
</template>
