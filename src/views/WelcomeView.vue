<script setup>
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()

/** 平台内的演示卡片（仅用于宣传页视觉预览） */
const showcaseCards = [
  { icon: 'i-book', tone: '', tag: '知识沉淀', title: '学习笔记', desc: '教程、实验记录与复盘经验' },
  { icon: 'i-users', tone: 'blue', tag: '一起成长', title: '学习小组', desc: '问题讨论、答疑与共同实践' },
  { icon: 'i-trophy', tone: 'amber', tag: '发现机会', title: '竞赛资源', desc: '赛事线索、备赛方向与案例' },
  { icon: 'i-spark', tone: '', tag: '实践成长', title: '优秀案例', desc: '项目过程、成果展示与复盘' },
]

const features = [
  {
    icon: 'i-book',
    title: '学习资源，集中发现',
    desc: '按学习方向、课程主题与资源类型查找笔记、外部教程和竞赛线索，减少在不同渠道间反复寻找。',
  },
  {
    icon: 'i-users',
    title: '知识协作，共同进步',
    desc: '围绕小组、问题求助和经验分享开展交流，让一次解答有机会沉淀成后来者可复用的知识。',
  },
  {
    icon: 'i-spark',
    title: '实践成果，清晰呈现',
    desc: '整理项目案例、竞赛复盘和个人学习成果，并由作者明确展示范围与使用许可。',
  },
]

/** 使用流程：让访客在几秒内明白平台怎么用 */
const steps = [
  {
    step: '01',
    title: '注册账号',
    desc: '用校园邮箱、学号或用户名创建账号，填写所在院系与显示名称。',
    icon: 'i-users',
  },
  {
    step: '02',
    title: '发现内容',
    desc: '通过全站搜索、分类筛选或学习小组，找到与你方向相关的笔记和案例。',
    icon: 'i-search',
  },
  {
    step: '03',
    title: '沉淀与协作',
    desc: '发布笔记、加入小组、提交竞赛线索，把经验留存为可复用的知识。',
    icon: 'i-bookmark',
  },
]

/** 平台概览数据（示例） */
const stats = [
  { value: '120+', label: '学习笔记' },
  { value: '36', label: '活跃学习小组' },
  { value: '18', label: '课程与竞赛资源' },
  { value: '9', label: '优秀实践案例' },
]

function enterPlatform() {
  router.push({ name: 'home' })
}
</script>

<template>
  <section class="welcome-screen" id="welcomePage">
    <div class="welcome-hero">
      <div class="welcome-copy">
        <div class="welcome-kicker"><span class="demo-dot"></span> 面向校园学习与实践的知识协作平台</div>
        <h1 class="welcome-title">
          让每一份学习积累，<br /><span>都成为成长的起点。</span>
        </h1>
        <p class="welcome-description">
          从一份课程笔记、一个项目案例或一次学习交流开始。把分散的学习资源连接起来，让经验可以被发现，让实践成果被看见，也让你更容易找到下一步的方向。
        </p>
        <div class="welcome-cta">
          <button class="solid-btn" type="button" @click="enterPlatform">
            开始探索 <AppIcon name="i-arrow" />
          </button>
          <button class="outline-btn" type="button" @click="router.push({ name: 'login' })">
            <AppIcon name="i-users" /> 登录 / 注册账号
          </button>
        </div>
        <div class="welcome-trust-note">
          <AppIcon name="i-shield" />
          <span>以课程与实践为中心组织资源。内容展示不等于转载许可；正式校园身份认证与账号服务将在后续接入。</span>
        </div>
      </div>

      <div class="welcome-showcase" aria-label="平台功能预览">
        <div class="showcase-halo"></div>
        <div class="showcase-board">
          <div class="showcase-topbar">
            <div class="showcase-brand">
              <span class="showcase-mark"><AppIcon name="i-grid" /></span>
              <span>学习空间</span>
            </div>
            <span class="showcase-live">探索 · 分享 · 实践</span>
          </div>

          <div class="showcase-welcome">
            <small>YOUR LEARNING SPACE</small>
            <h3>找到你的下一步。</h3>
            <p>发现可复用的经验，与志同道合的同学一起成长。</p>
          </div>

          <div class="showcase-search">
            <AppIcon name="i-search" /><span>搜索笔记、竞赛、项目案例……</span>
          </div>

          <div class="showcase-cards">
            <div v-for="c in showcaseCards" :key="c.title" class="showcase-card">
              <div class="showcase-card-top">
                <span class="showcase-card-icon" :class="c.tone"><AppIcon :name="c.icon" /></span>
                <span class="showcase-card-tag">{{ c.tag }}</span>
              </div>
              <strong>{{ c.title }}</strong>
              <p>{{ c.desc }}</p>
            </div>
          </div>

          <div class="showcase-bottom">
            <span>让有价值的经验持续积累</span>
            <strong>学习 · 协作 · 成长 ↗</strong>
          </div>
        </div>

        <div class="showcase-float top"><AppIcon name="i-bookmark" />把经验留给下一位学习者</div>
        <div class="showcase-float bottom"><AppIcon name="i-target" />从目标出发，规划下一步</div>
      </div>
    </div>
  </section>

  <!-- 平台概览 -->
  <section class="welcome-stats" aria-label="平台概览">
    <div class="welcome-stats-inner">
      <div v-for="s in stats" :key="s.label" class="welcome-stat">
        <strong>{{ s.value }}</strong>
        <span>{{ s.label }}</span>
      </div>
      <span class="welcome-stats-note">示例数据</span>
    </div>
  </section>

  <section class="welcome-features" id="welcomeFeatures">
    <div class="welcome-features-head">
      <div>
        <div class="section-kicker">ONE CAMPUS · SHARED KNOWLEDGE</div>
        <h2>学习不止于收藏资料，更在于持续积累。</h2>
        <p>平台把资源、交流、实践和个人成长连接为一条更清晰的学习路径。</p>
      </div>
    </div>
    <div class="welcome-feature-grid">
      <article v-for="f in features" :key="f.title" class="welcome-feature">
        <div class="welcome-feature-icon"><AppIcon :name="f.icon" /></div>
        <h3>{{ f.title }}</h3>
        <p>{{ f.desc }}</p>
      </article>
    </div>
  </section>

  <!-- 三步开始 -->
  <section class="welcome-steps" id="welcomeSteps">
    <div class="welcome-features-head">
      <div>
        <div class="section-kicker">HOW IT WORKS</div>
        <h2>三步开始使用。</h2>
        <p>无需复杂配置，先从发现内容开始。</p>
      </div>
    </div>
    <ol class="welcome-step-list">
      <li v-for="s in steps" :key="s.step" class="welcome-step">
        <span class="welcome-step-no">{{ s.step }}</span>
        <span class="welcome-step-icon"><AppIcon :name="s.icon" /></span>
        <h3>{{ s.title }}</h3>
        <p>{{ s.desc }}</p>
      </li>
    </ol>
    <div class="welcome-steps-cta">
      <button class="solid-btn" type="button" @click="router.push({ name: 'login' })">
        注册账号开始使用 <AppIcon name="i-arrow" />
      </button>
      <button class="text-link" type="button" @click="enterPlatform">
        先随便逛逛 <AppIcon name="i-arrow" />
      </button>
    </div>
  </section>

  <footer class="welcome-footer" id="welcomeFooter">
    <div class="welcome-footer-brand">
      <span class="showcase-mark"><AppIcon name="i-grid" /></span>
      <div>
        <div class="welcome-footer-name">校园学习平台</div>
        <div class="welcome-footer-sub">LEARN · SHARE · BUILD</div>
      </div>
    </div>
    <div class="welcome-footer-links">
      <button type="button" class="text-link" @click="router.push({ name: 'login' })">登录 / 注册</button>
      <button type="button" class="text-link" @click="enterPlatform">进入平台</button>
      <button type="button" class="text-link" @click="router.push({ name: 'home' })">学习资源</button>
    </div>
    <span class="welcome-footer-note">当前为前端原型 · 示例内容不代表真实学校公告或赛事安排</span>
  </footer>
</template>
