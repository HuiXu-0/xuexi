<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { navItems, notifications } from '../data/content.js'
import { profileRoles } from '../data/pages.js'
import { showToast } from '../composables/useToast.js'
import { useTheme, toggleTheme } from '../composables/useTheme.js'

const route = useRoute()
const router = useRouter()
const theme = useTheme()

const navOpen = ref(false)
const notifOpen = ref(false)
const roleOpen = ref(false)
const notifRef = ref(null)
const notifBtnRef = ref(null)
const roleRef = ref(null)

/** 角色入口：教师工作台 / 管理员端 / 学习规划 Agent */
const roleItems = profileRoles

const themeLabel = computed(() =>
  theme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式'
)

watch(
  () => route.path,
  () => {
    navOpen.value = false
    notifOpen.value = false
    roleOpen.value = false
  }
)

function onOutsideClick(e) {
  if (notifOpen.value && notifRef.value && !notifRef.value.contains(e.target) && e.target !== notifBtnRef.value) {
    notifOpen.value = false
  }
  if (roleOpen.value && roleRef.value && !roleRef.value.contains(e.target)) {
    roleOpen.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    navOpen.value = false
    notifOpen.value = false
    roleOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onOutsideClick)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onOutsideClick)
  document.removeEventListener('keydown', onKeydown)
})

function goHome() {
  router.push({ name: 'home' })
}

function headerSearch() {
  router.push({ name: 'home' })
  showToast('全局搜索可查找本原型中所有演示内容。')
  requestAnimationFrame(() => {
    document.getElementById('globalSearch')?.focus()
  })
}

function onThemeToggle() {
  const next = toggleTheme()
  showToast(next === 'dark' ? '已切换到深色模式。' : '已切换到浅色模式。')
}
</script>

<template>
  <div class="topline">
    <div class="container topline-inner">
      <div class="topline-left">
        <span class="demo-dot"></span>
        <span>校园学习平台 · 学习资源 / 实践成果 / 知识协作</span>
      </div>
      <div class="topline-right">首页内容为交互演示，正式使用时展示已核实信息与真实内容</div>
    </div>
  </div>

  <header class="header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="陕西科技大学镐京学院学习平台首页" @click.prevent="goHome">
        <div class="brand-stack">
          <img class="brand-logo" src="/assets/haojing-logo.png" alt="陕西科技大学镐京学院" width="300" height="42" />
          <div class="brand-row">
            <img class="brand-logo-sub" src="/assets/iflytek-logo.png" alt="科大讯飞 iFLYTEK" width="90" height="30" />
            <span class="brand-title">校园学习平台</span>
          </div>
        </div>
      </a>

      <nav class="nav" :class="{ open: navOpen }" aria-label="主导航">
        <!--
          手机端主导航已由底部 tab 承担，汉堡菜单里不再重复列出，
          只保留角色入口与登录。窄屏桌面（data-device=desktop）仍显示完整导航。
        -->
        <button
          v-for="item in navItems"
          :key="item.nav"
          :class="{ active: route.name === item.route }"
          @click="router.push({ name: item.route })"
        >
          {{ item.label }}
        </button>

        <!-- 移动端顶栏空间有限，把角色入口与登录收进汉堡菜单 -->
        <div class="nav-mobile-only">
          <button
            v-for="r in roleItems"
            :key="r.route"
            @click="router.push({ name: r.route })"
          >
            {{ r.title }}
          </button>
          <button @click="router.push({ name: 'login' })">登录 / 注册</button>
        </div>
      </nav>

      <div class="header-actions">
        <button class="icon-btn" aria-label="全局搜索" title="全局搜索" @click="headerSearch">
          <AppIcon name="i-search" />
        </button>

        <div class="action-wrap" ref="notifRef">
          <button
            ref="notifBtnRef"
            class="icon-btn"
            aria-label="通知与消息"
            title="通知与消息"
            @click.stop="notifOpen = !notifOpen"
          >
            <AppIcon name="i-bell" />
            <span class="notify-dot"></span>
          </button>
          <div class="notification-pop" :class="{ open: notifOpen }">
            <h3>通知与消息</h3>
            <div v-for="n in notifications" :key="n.title" class="notification-row">
              <strong>{{ n.title }}</strong>{{ n.text }}
            </div>
            <button class="text-link" data-modal="notifications">
              查看通知规则 <AppIcon name="i-arrow" />
            </button>
          </div>
        </div>

        <!-- 角色工作台入口：教师 / 管理员 / 学习规划，避免只能从个人中心二级绕进去 -->
        <div class="action-wrap role-wrap" ref="roleRef">
          <button
            class="icon-btn"
            aria-label="切换工作台"
            title="切换工作台"
            :aria-expanded="String(roleOpen)"
            @click.stop="roleOpen = !roleOpen"
          >
            <AppIcon name="i-grid" />
          </button>
          <div class="notification-pop role-pop" :class="{ open: roleOpen }">
            <h3>切换工作台</h3>
            <button
              v-for="r in roleItems"
              :key="r.route"
              class="role-pop-item"
              type="button"
              @click="router.push({ name: r.route })"
            >
              <span class="role-pop-icon"><AppIcon :name="r.icon" /></span>
              <span class="role-pop-text">
                <strong>{{ r.title }}</strong>
                <small>{{ r.desc }}</small>
              </span>
              <AppIcon name="i-arrow" />
            </button>
            <p class="role-pop-note">当前为原型体验入口，不代表真实授权。</p>
          </div>
        </div>

        <!-- 深色模式切换：此前只有欢迎页有，平台内想切主题必须先退回宣传页 -->
        <button
          class="icon-btn"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="onThemeToggle"
        >
          <AppIcon :name="theme === 'dark' ? 'i-sun' : 'i-moon'" />
        </button>

        <button class="welcome-link" type="button" @click="router.push({ name: 'login' })">
          登录 / 注册
        </button>

        <button class="profile-btn" aria-label="个人中心" @click="router.push({ name: 'profile' })">
          <span class="avatar">学</span><span>个人中心</span>
        </button>

        <button class="icon-btn mobile-menu" aria-label="打开导航" @click="navOpen = !navOpen">
          <AppIcon name="i-menu" />
        </button>
      </div>
    </div>
  </header>
</template>
