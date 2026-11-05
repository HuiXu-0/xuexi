<script setup>
import SiteHeader from '../components/SiteHeader.vue'
import SiteFooter from '../components/SiteFooter.vue'
import MobileTabBar from '../components/MobileTabBar.vue'
</script>

<template>
  <SiteHeader />

  <main class="main container" id="top">
    <!-- 转场动画与原单文件原型一致：page-enter / page-exit -->
    <router-view v-slot="{ Component }">
      <transition enter-active-class="page-enter" leave-active-class="page-exit" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </main>

  <SiteFooter />

  <!-- 手机端底部标签栏（桌面端不渲染） -->
  <MobileTabBar />
</template>
