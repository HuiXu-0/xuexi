<script setup>
import AppIcon from './AppIcon.vue'
import { footerLinks } from '../data/content.js'
</script>

<template>
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-brand">
        <div class="brand-stack" aria-label="陕西科技大学镐京学院 · 科大讯飞 · 校园学习平台">
          <img class="brand-logo" src="/assets/haojing-logo.png" alt="陕西科技大学镐京学院" width="300" height="42" />
          <div class="brand-row">
            <img class="brand-logo-sub" src="/assets/iflytek-logo.png" alt="科大讯飞 iFLYTEK" width="90" height="30" />
            <span class="brand-title">校园学习平台</span>
          </div>
        </div>
        <span style="font-weight: 400; color: var(--text-faint)">· 学习资源、实践成果与知识协作</span>
      </div>

      <div class="footer-links">
        <button v-for="link in footerLinks" :key="link.modal" :data-modal="link.modal">
          {{ link.label }}
        </button>
      </div>

      <div>交互原型 · 演示数据</div>
    </div>
  </footer>
</template>
