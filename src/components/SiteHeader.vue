<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { notifications } from '../data/content.js'
import { roleMeta } from '../data/dict.js'
import { authStore, currentNav, signOut } from '../stores/auth.js'
import { showToast } from '../composables/useToast.js'
import { useTheme, toggleTheme } from '../composables/useTheme.js'

const route = useRoute()
const router = useRouter()
const theme = useTheme()

const navOpen = ref(false)
const notifOpen = ref(false)
const menuOpen = ref(false)
const notifRef = ref(null)
const notifBtnRef = ref(null)
const menuRef = ref(null)

/**
 * 导航按当前角色渲染。
 * 设计书 §4.1–4.3 定义了学生端 / 教师端 / 管理员端三套主导航；
 * 角色在登录界面选定，这里只负责呈现，不再提供跨角色跳转入口。
 */
/**
 * 导航项按当前授权过滤。
 *
 * `requires` 声明该入口需要哪项授权：
 *   contentAdmin —— 校级内容管理（§4.2 仅授权角色可见）
 *   canReview    —— 内容审核职责（§6.4 审核队列只在授权范围内出现）
 *
 * 不满足条件时**整个入口不渲染**，而不是渲染成灰的再报错。
 */
function allowed(item) {
  if (item.requires === 'contentAdmin') {
    return authStore.role === 'admin' || authStore.contentAdmin
  }
  if (item.requires === 'canReview') {
    return authStore.role === 'admin' || authStore.canReview
  }
  return true
}

const navItems = computed(() =>
  currentNav.value
    .filter((item) => allowed(item))
    .map((item) =>
      item.children
        ? { ...item, children: item.children.filter((c) => allowed(c)) }
        : item
    )
    .filter((item) => !item.children || item.children.length > 0)
)
const currentRole = computed(() => roleMeta(authStore.role))
/** 头像文字：用角色自带的单字缩写，避免与文字标签连读成「学生学生」 */
const roleInitial = computed(() => currentRole.value.initial || currentRole.value.label.charAt(0))
const themeLabel = computed(() =>
  theme.value === 'dark' ? '切换到浅色模式' : '切换到深色模式'
)

/** 某个一级入口下的子项里，当前路由是否命中 */
function isChildActive(item) {
  return item.children?.some((c) => c.route === route.name)
}

watch(
  () => route.path,
  () => {
    navOpen.value = false
    notifOpen.value = false
    menuOpen.value = false
  }
)

function onOutsideClick(e) {
  if (notifOpen.value && notifRef.value && !notifRef.value.contains(e.target) && e.target !== notifBtnRef.value) {
    notifOpen.value = false
  }
  if (menuOpen.value && menuRef.value && !menuRef.value.contains(e.target)) {
    menuOpen.value = false
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    navOpen.value = false
    notifOpen.value = false
    menuOpen.value = false
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

/* 二级下拉：桌面端 hover / 点击展开，移动端在汉堡菜单里平铺 */
const openGroup = ref('')

/*
 * 下拉展开时给 html 加一个标记类。
 *
 * 浮层菜单盖住下方内容时，视觉上容易被误看成「页面排版错乱」。
 * 现在用一层半透明遮罩覆盖整个页面内容，菜单浮在遮罩之上：
 * 内容变暗但位置不动，既没有错位感，也不会因为下沉/上浮而跳动。
 * 遮罩本身由 .nav-scrim 负责，这里只负责加标记类与收起逻辑。
 */
watch(
  () => openGroup.value,
  (v) => {
    if (import.meta.env.SSR) return
    document.documentElement.classList.toggle('nav-dropdown-open', !!v)
  }
)

/** 点遮罩收起菜单 */
function closeGroup() {
  clearGroupCloseTimer()
  openGroup.value = ''
}

/*
 * 关闭延时。
 * 即使 DOM 上已经无缝，鼠标从触发器斜向快速移向菜单时，
 * 中途仍可能短暂离开 .nav-group 触发 mouseleave。
 * 延迟一小段时间再关，给用户足够时间把指针移到目标项上。
 */
let groupCloseTimer = 0

function clearGroupCloseTimer() {
  if (groupCloseTimer) {
    clearTimeout(groupCloseTimer)
    groupCloseTimer = 0
  }
}

function toggleGroup(key) {
  clearGroupCloseTimer()
  openGroup.value = openGroup.value === key ? '' : key
}

function onGroupEnter(key) {
  /* 桌面端 hover 展开；触屏设备靠点击 */
  if (!window.matchMedia('(hover: hover)').matches) return
  clearGroupCloseTimer()
  openGroup.value = key
}

function onGroupLeave() {
  if (!window.matchMedia('(hover: hover)').matches) return
  clearGroupCloseTimer()
  groupCloseTimer = setTimeout(() => {
    openGroup.value = ''
    groupCloseTimer = 0
  }, 220)
}

/** 选中下拉项后立刻收起菜单并跳转 */
function onPickChild(routeName) {
  clearGroupCloseTimer()
  openGroup.value = ''
  router.push({ name: routeName })
}

function onLogout() {
  signOut()
  showToast('已退出当前演示身份，回到登录界面。')
  router.push({ name: 'login' })
}
</script>

<template>
  <!--
    二级下拉展开时的半透明遮罩。
    用 Teleport 挂到 body，才能脱离 header 的堆叠上下文，
    从而「压暗页面内容、但顶栏与菜单保持清晰」。
  -->
  <Teleport to="body">
    <div v-if="openGroup" class="nav-scrim" @click="closeGroup"></div>
  </Teleport>

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
        <template v-for="item in navItems" :key="item.key">
          <!-- 带二级项的一级入口 -->
          <div
            v-if="item.children"
            class="nav-group"
            @mouseenter="onGroupEnter(item.key)"
            @mouseleave="onGroupLeave"
          >
            <button
              class="nav-group-trigger"
              :class="{ active: isChildActive(item) }"
              :aria-expanded="String(openGroup === item.key)"
              @click="toggleGroup(item.key)"
            >
              {{ item.label }}
              <AppIcon name="i-arrow" class="nav-caret" />
            </button>
            <div v-show="openGroup === item.key" class="nav-dropdown">
              <button
                v-for="c in item.children"
                :key="c.label"
                :class="{ active: route.name === c.route }"
                @click="onPickChild(c.route)"
              >
                {{ c.label }}
              </button>
            </div>
          </div>

          <!-- 普通一级入口 -->
          <button
            v-else
            :class="{ active: route.name === item.route }"
            @click="router.push({ name: item.route })"
          >
            {{ item.label }}
          </button>
        </template>
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

        <!-- 深色模式切换 -->
        <button
          class="icon-btn"
          :aria-label="themeLabel"
          :title="themeLabel"
          @click="onThemeToggle"
        >
          <AppIcon :name="theme === 'dark' ? 'i-sun' : 'i-moon'" />
        </button>

        <!-- 当前身份：角色在登录界面选定，此处只显示，不提供跨角色切换 -->
        <div class="action-wrap" ref="menuRef">
          <button
            class="profile-btn"
            :aria-label="`当前身份：${currentRole.label}`"
            @click.stop="menuOpen = !menuOpen"
          >
            <span class="avatar">{{ roleInitial }}</span>
            <span>{{ currentRole.label }}</span>
          </button>
          <div class="notification-pop identity-pop" :class="{ open: menuOpen }">
            <h3>当前身份</h3>
            <div class="identity-card">
              <span class="identity-icon"><AppIcon :name="currentRole.icon" /></span>
              <div>
                <strong>{{ currentRole.label }}</strong>
                <small>{{ authStore.displayName }}</small>
                <span class="identity-badge">{{ currentRole.badge }}</span>
              </div>
            </div>
            <p class="identity-note">
              身份在登录界面选定，导航与操作权限随之变化。如需切换身份，请退出后重新登录。
            </p>
            <button class="text-link" @click="onLogout">
              退出登录 <AppIcon name="i-arrow" />
            </button>
          </div>
        </div>

        <button class="icon-btn mobile-menu" aria-label="打开导航" @click="navOpen = !navOpen">
          <AppIcon name="i-menu" />
        </button>
      </div>
    </div>
  </header>
</template>
