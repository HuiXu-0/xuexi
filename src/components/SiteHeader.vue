<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { navItems, notifications } from '../data/content.js'
import { showToast } from '../composables/useToast.js'

const route = useRoute()
const router = useRouter()

const navOpen = ref(false)
const notifOpen = ref(false)
const notifRef = ref(null)
const notifBtnRef = ref(null)

watch(
  () => route.path,
  () => {
    navOpen.value = false
    notifOpen.value = false
  }
)

function onOutsideClick(e) {
  if (notifOpen.value && notifRef.value && !notifRef.value.contains(e.target) && e.target !== notifBtnRef.value) {
    notifOpen.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    navOpen.value = false
    notifOpen.value = false
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
        <button
          v-for="item in navItems"
          :key="item.nav"
          :class="{ active: route.name === item.route }"
          @click="router.push({ name: item.route })"
        >
          {{ item.label }}
        </button>
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
