<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useDevice } from '../composables/useDevice.js'
import { authStore } from '../stores/auth.js'

/**
 * 移动端底部标签栏。
 *
 * 桌面端用顶部导航，手机上顶部空间宝贵、滚动时又常被隐藏，
 * 所以在手机上改用底部固定 tab：拇指可达、始终可见。
 * 仅在 data-device="mobile" 时显示（平板按桌面处理）。
 *
 * tab 项按当前角色变化 —— 设计书 §4.1–4.3 三端的导航结构不同。
 */
const route = useRoute()
const router = useRouter()
const { isMobile } = useDevice()

/** 学生端：首页 / 学习平台 / 规划 / 我的 */
const studentTabs = [
  { route: 'home', label: '首页', icon: 'i-grid' },
  { route: 'forum', label: '论坛', icon: 'i-users' },
  { route: 'notes', label: '笔记', icon: 'i-book' },
  { route: 'planner', label: '规划', icon: 'i-target' },
  { route: 'profile', label: '我的', icon: 'i-file' },
]

/** 教师端：工作台 / 小组 / 笔记 / 我的 */
const teacherTabs = [
  { route: 'teacher', label: '工作台', icon: 'i-book' },
  { route: 'forum', label: '小组', icon: 'i-users' },
  { route: 'notes', label: '笔记', icon: 'i-file' },
  { route: 'profile', label: '我的', icon: 'i-grid' },
]

/**
 * 管理员端：管理台 / 举报 / 通知 / 我的
 *
 * 手机上没法用桌面端的下拉菜单，9 个模块塞进底部 tab 不现实，
 * 所以挑 3 个高频模块上 tab，其余靠页面内的模块切换条。
 */
const adminTabs = [
  { route: 'admin', label: '管理台', icon: 'i-shield' },
  { route: 'adminReports', label: '举报', icon: 'i-bellring' },
  { route: 'adminNotices', label: '通知', icon: 'i-bell' },
  { route: 'profile', label: '我的', icon: 'i-grid' },
]

const tabs = computed(() => {
  if (authStore.role === 'teacher') return teacherTabs
  if (authStore.role === 'admin') return adminTabs
  return studentTabs
})

/* 详情类页面（教师工作台、管理员端等）不属于 tab 目标，此时不高亮任何一项 */
const tabRoutes = computed(() => tabs.value.map((t) => t.route))
const activeRoute = computed(() =>
  tabRoutes.value.includes(route.name) ? route.name : ''
)
</script>

<template>
  <nav v-if="isMobile" class="tab-bar" aria-label="底部导航">
    <button
      v-for="t in tabs"
      :key="t.route + t.label"
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
