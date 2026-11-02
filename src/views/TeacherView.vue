<script setup>
import { computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { teacherManagedGroups } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'

const recommendations = computed(() => [
  ...demoStore.recommendations.map((r) => ({
    id: `local-${r.title}`,
    icon: 'i-trophy',
    title: r.title,
    desc: `推荐理由：${r.reason}。发布前需由作者确认拟展示字段和受众范围。`,
    meta: `作者：${r.author} · 状态：等待学生确认 · 本地演示`,
    isLocal: true,
  })),
  {
    id: 'DEMO-REC-001',
    icon: 'i-trophy',
    title: '智能硬件项目实践复盘（演示）',
    desc: '推荐理由：项目复盘对后续学习有参考价值。发布前需由作者确认拟展示字段和受众范围。',
    meta: '状态：等待学生确认',
    isLocal: false,
  },
])

function onAdminAction(action, id) {
  const messages = {
    'review-recommendation': '授权检查示例：教师推荐仍需作者确认拟展示字段与受众范围。',
    'close-recommendation': '已将推荐事项标记为已处理（演示）。',
    'notice-permission': '演示检查：校级通知操作只应向获得授权的内容管理员开放。',
    users: '账号与权限管理为占位演示；真实角色必须由身份核验和授权规则控制。',
  }
  if (action === 'close-recommendation' && id) {
    demoStore.recommendations = demoStore.recommendations.filter((r) => `local-${r.title}` !== id)
    if (demoStore.teacherPendingCount > 0) demoStore.teacherPendingCount -= 1
  }
  showToast(messages[action] || '该管理操作目前只提供原型交互。')
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">TEACHER WORKSPACE</div>
        <h1>教师工作台</h1>
        <p>集中处理教师负责的学习小组、学生案例推荐和被分配的审核事项。只展示已授权范围内的内容。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-route="profile">返回个人中心</button>
        <button class="solid-btn" data-create="teacherGroup">创建教师学习小组</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>这是教师端交互演示。正式平台需要验证教师身份并按课程、小组或明确授权限制管理范围，普通教师默认无权发布校级官方通知或管理全站账号。</div>
    </div>

    <div class="page-stats">
      <div class="page-stat">
        <span>我管理的小组</span>
        <strong>2</strong>
        <small>示例数量 · 待连接真实数据</small>
      </div>
      <div class="page-stat">
        <span>待处理案例推荐</span>
        <strong>{{ demoStore.teacherPendingCount }}</strong>
        <small>需确认作者授权范围</small>
      </div>
      <div class="page-stat">
        <span>待办审核事项</span>
        <strong>2</strong>
        <small>演示计数</small>
      </div>
    </div>

    <div class="page-layout-two">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>案例推荐申请</h2>
            <p>教师推荐不自动扩大作品作者的授权范围。</p>
          </div>
          <button class="mini-btn" data-create="recommendation">发起推荐邀请</button>
        </div>

        <div>
          <div v-for="r in recommendations" :key="r.id" class="page-list-row admin-task">
            <span class="page-list-icon"><AppIcon :name="r.icon" /></span>
            <div class="page-list-content">
              <strong>{{ r.title }}</strong>
              <p>{{ r.desc }}</p>
              <small>{{ r.meta }}</small>
              <div class="page-actions" style="margin-top: 9px">
                <button class="mini-btn" @click="onAdminAction('review-recommendation', r.id)">
                  查看授权流程
                </button>
                <button class="mini-btn" @click="onAdminAction('close-recommendation', r.id)">
                  标记已处理
                </button>
              </div>
            </div>
            <span class="page-badge amber">待确认</span>
          </div>
        </div>
      </div>

      <aside class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>我负责的学习小组</h2>
            <p>小组管理权限仅限对应小组。</p>
          </div>
        </div>
        <div v-for="g in teacherManagedGroups" :key="g.title" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="g.icon" /></span>
          <div class="page-list-content">
            <strong>{{ g.title }}</strong>
            <p>{{ g.desc }}</p>
            <small>{{ g.meta }}</small>
          </div>
        </div>
        <button
          class="outline-btn"
          data-route="forum"
          style="width: 100%; justify-content: center; margin-top: 12px"
        >
          查看学习论坛
        </button>
      </aside>
    </div>

    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>校级首页内容管理</h2>
            <p>仅获授权的学校内容管理员可操作。</p>
          </div>
          <span class="page-badge">独立授权</span>
        </div>
        <p style="font-size: 12px; color: var(--text-soft); line-height: 1.8; margin: 0">
          普通教师没有默认发布校级通知的权限。具备授权的内容管理员可以创建、编辑、设定有效期、发布、撤回和归档正式通知，并保留变更记录。
        </p>
        <div class="page-actions" style="margin-top: 12px">
          <button class="mini-btn" @click="onAdminAction('notice-permission')">检查演示权限</button>
          <button class="mini-btn" data-route="admin">查看平台管理端（演示）</button>
        </div>
      </div>
    </div>
  </section>
</template>
