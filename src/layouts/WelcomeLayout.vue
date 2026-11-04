<script setup>
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { useTheme, toggleTheme } from '../composables/useTheme.js'

/**
 * 宣传页 / 登录页共用的外壳：背景光晕 + welcome-header。
 * 对应参考文件的 .welcome-gate（原为 fixed 遮罩，这里作为路由布局）。
 */
const route = useRoute()
const router = useRouter()
const theme = useTheme()

function goHome() {
  router.push({ name: 'home' })
}

function goLogin() {
  router.push({ name: 'login' })
}

function goWelcome() {
  router.push({ name: 'welcome' })
}

function onThemeToggle() {
  toggleTheme()
}

/** 「平台特色」：不在宣传页时先跳过去，再滚动到特色区 */
async function scrollToFeatures() {
  if (route.name !== 'welcome') {
    await router.push({ name: 'welcome' })
    /* 路由的 scrollBehavior 会先平滑滚回顶部，等它结束再滚到特色区，
       否则两个滚动会互相覆盖。已在宣传页时无需等待。 */
    await new Promise((r) => setTimeout(r, 320))
  }
  document.getElementById('welcomeFeatures')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="welcome-gate">
    <div class="welcome-backdrop" aria-hidden="true">
      <div class="welcome-orb one"></div>
      <div class="welcome-orb two"></div>
    </div>

    <header class="welcome-header">
      <a class="brand" href="/welcome" aria-label="校园学习平台介绍页" @click.prevent="goWelcome">
        <div class="brand-mark"><AppIcon name="i-grid" /></div>
        <div>
          <div class="brand-name">校园学习平台</div>
          <div class="brand-sub">LEARN · SHARE · BUILD</div>
        </div>
      </a>

      <div class="welcome-header-actions">
        <!-- data-welcome-scroll 作为移动端媒体查询的隐藏钩子（与参考文件一致） -->
        <button
          class="welcome-link"
          type="button"
          data-welcome-scroll="welcomeFeatures"
          @click="scrollToFeatures"
        >
          平台特色
        </button>
        <button
          class="icon-btn"
          type="button"
          :aria-label="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
          :title="theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'"
          @click="onThemeToggle"
        >
          <AppIcon :name="theme === 'dark' ? 'i-sun' : 'i-moon'" />
        </button>
        <button class="welcome-link" type="button" @click="goLogin">登录 / 注册</button>
        <button class="solid-btn" type="button" @click="goHome">
          进入平台 <AppIcon name="i-arrow" />
        </button>
      </div>
    </header>

    <!--
      宣传页 ↔ 登录页不加 page-enter/page-exit 转场：
      参考文件这里是即时切换（只切 hidden），且 WelcomeView 是三段式片段根节点，
      套 <Transition> 会报「non-element root」并和 welcome-copy 自带的
      revealUp 叠加成双重动画，mode=out-in 还会留出一段空白。
      平台内 10 个页面的转场仍由 PlatformLayout 负责，与原原型一致。
    -->
    <router-view />
  </div>
</template>
