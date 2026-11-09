<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { profileContentLinks } from '../data/pages.js'
import { roleMeta } from '../data/dict.js'
import { authStore, signOut } from '../stores/auth.js'
import { showToast } from '../composables/useToast.js'

const route = useRoute()
const router = useRouter()

const displayName = ref('学生演示账号')
const direction = ref('')
const bio = ref('')

const currentRole = computed(() => roleMeta(authStore.role))
const currentRoute = computed(() => route.name)

/**
 * 当前身份可用的工作台。
 * 设计书 §4：教师端与管理员端不应出现在学生端的入口列表里。
 */
const availableRoles = computed(() => {
  if (authStore.role === 'admin') {
    return [
      { route: 'admin', icon: 'i-shield', title: '平台管理端', desc: '举报、反馈、规则与账号权限管理。' },
      { route: 'notes', icon: 'i-file', title: '内容浏览', desc: '查看与处理站内学习内容。' },
    ]
  }
  if (authStore.role === 'teacher') {
    return [
      { route: 'teacher', icon: 'i-book', title: '教师工作台', desc: '学习小组、案例推荐、被分配审核任务。' },
      { route: 'notes', icon: 'i-file', title: '我的笔记', desc: '发布与维护自己的学习内容。' },
      { route: 'planner', icon: 'i-target', title: '学习规划', desc: '按目标生成可修改的阶段计划。' },
    ]
  }
  return [
    { route: 'planner', icon: 'i-target', title: '学习规划', desc: '按目标生成可修改的阶段计划。' },
    { route: 'forum', icon: 'i-users', title: '我的小组', desc: '创建或加入的学习小组与讨论。' },
  ]
})

function saveProfile() {
  showToast('已验证个人资料表单；此原型不会将资料保存到服务器。')
}

function onLogout() {
  signOut()
  showToast('已退出当前演示身份，回到登录界面。')
  router.push({ name: 'login' })
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">YOUR LEARNING SPACE</div>
        <h1>个人中心</h1>
        <p>管理个人资料、内容、收藏、反馈和隐私设置。真实身份信息与公开展示资料应分开管理。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-modal="privacy">隐私说明</button>
        <button class="solid-btn" data-create="note">发布笔记</button>
      </div>
    </div>

    <div class="page-layout-two">
      <div>
        <div class="page-panel">
          <div class="stack-row">
            <div class="avatar avatar-lg">学</div>
            <div>
              <h2 class="title-md">学生演示账号</h2>
              <div class="page-card-meta">
                <span class="page-badge amber">未连接真实账号</span>
                <span>专业与年级待完善</span>
              </div>
            </div>
          </div>

          <div class="form-grid-two mt-18">
            <div class="form-row">
              <label for="profileDisplayName">显示名称</label>
              <input id="profileDisplayName" v-model="displayName" />
            </div>
            <div class="form-row">
              <label for="profileDirection">学习方向</label>
              <input id="profileDirection" v-model="direction" placeholder="例如：人工智能 / 嵌入式" />
            </div>
          </div>
          <div class="form-row">
            <label for="profileBio">个人简介</label>
            <textarea
              id="profileBio"
              v-model="bio"
              placeholder="介绍你的学习兴趣（可选）"
              class="textarea-md"
            ></textarea>
          </div>
          <div class="page-actions">
            <button class="solid-btn" @click="saveProfile">保存演示资料</button>
            <button class="outline-btn" data-modal="privacy">隐私与公开设置说明</button>
          </div>
        </div>

        <div class="page-section">
          <div class="page-section-head">
            <div>
              <h2>我的内容与活动</h2>
              <p>当前为原型状态，真实账号内容需要后端数据接入。</p>
            </div>
          </div>
          <div class="page-card-grid">
            <button v-for="item in profileContentLinks" :key="item.route" class="role-card" :data-route="item.route">
              <AppIcon :name="item.icon" />
              <strong>{{ item.title }}</strong>
              <span>{{ item.desc }}</span>
            </button>
          </div>
        </div>

        <div class="page-section">
          <div class="page-section-head">
            <div>
              <h2>我的反馈与建议</h2>
              <p>查看个人反馈进度；当前表单仅为本地演示。</p>
            </div>
          </div>
          <div class="page-actions">
            <button class="outline-btn" data-modal="bug">提交 Bug 反馈</button>
            <button class="outline-btn" data-modal="suggestion">提出功能建议</button>
            <button
              class="outline-btn"
              @click="showToast('演示状态：当前没有连接真实反馈工单。')"
            >
              查看演示状态
            </button>
          </div>
        </div>
      </div>

      <aside class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>当前身份与权限</h2>
            <p>身份在登录界面选定，此处显示当前身份可用的工作台。</p>
          </div>
        </div>
        <div class="identity-card">
          <span class="identity-icon"><AppIcon :name="currentRole.icon" /></span>
          <div>
            <strong>{{ currentRole.label }}</strong>
            <small>{{ authStore.displayName }}</small>
            <span class="identity-badge">{{ currentRole.badge }}</span>
          </div>
        </div>
        <p class="text-soft-12 mt-12">{{ currentRole.desc }}</p>

        <div class="page-section-head mt-15">
          <div>
            <h2>可用工作台</h2>
            <p>不同身份可见的工作台不同。</p>
          </div>
        </div>
        <div class="role-switch-grid">
          <button
            v-for="role in availableRoles"
            :key="role.route"
            class="role-card"
            :class="{ 'is-current': role.route === currentRoute }"
            :data-route="role.route"
          >
            <AppIcon :name="role.icon" />
            <strong>{{ role.title }}</strong>
            <span>{{ role.desc }}</span>
          </button>
        </div>

        <div class="page-callout mt-12">
          <AppIcon name="i-info" />
          <div>正式平台应根据经验证的身份、角色和业务授权控制入口和操作权限。当前为原型演示，身份切换需退出后重新登录。</div>
        </div>

        <button class="outline-btn w-full justify-center mt-12" @click="onLogout">
          退出登录 <AppIcon name="i-arrow" />
        </button>
      </aside>
    </div>
  </section>
</template>
