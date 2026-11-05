<script setup>
import { ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { profileRoles, profileContentLinks } from '../data/pages.js'
import { showToast } from '../composables/useToast.js'

const displayName = ref('学生演示账号')
const direction = ref('')
const bio = ref('')

function saveProfile() {
  showToast('已验证个人资料表单；此原型不会将资料保存到服务器。')
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
            <h2>原型角色入口</h2>
            <p>用于体验不同工作台，不代表真实授权。</p>
          </div>
        </div>
        <div class="page-callout">
          <AppIcon name="i-info" />
          <div>正式平台应根据经验证的身份、角色和业务授权控制入口和操作权限。此处切换仅用于产品原型体验。</div>
        </div>
        <div class="role-switch-grid">
          <button v-for="role in profileRoles" :key="role.route" class="role-card" :data-route="role.route">
            <AppIcon :name="role.icon" />
            <strong>{{ role.title }}</strong>
            <span>{{ role.desc }}</span>
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>
