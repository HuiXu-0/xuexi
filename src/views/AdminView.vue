<script setup>
import { computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { adminTasks, adminShortcuts, agentDefinitions } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'

const taskMessages = {
  review: '已将演示事项标记为核实中；尚未执行真实审核。',
  resolve: '已将演示事项标记为处理完成；真实平台需保存理由和审计记录。',
  users: '账号与权限管理为占位演示；真实角色必须由身份核验和授权规则控制。',
  notices: '通知管理为占位演示；发布、撤回和更正都应记录操作者、时间与原因。',
  refresh: '已刷新本地演示状态；没有连接真实后台。',
}

const tasks = computed(() =>
  adminTasks.map((t) => ({
    ...t,
    status: demoStore.adminTaskStatus[t.id] || { label: '待处理', class: 'amber' },
    resolved: !!demoStore.adminTaskStatus[t.id]?.resolved,
  }))
)

function onTaskAction(action, id) {
  if (action === 'review') {
    demoStore.adminTaskStatus[id] = { label: '核实中', class: 'blue', resolved: false }
  } else if (action === 'resolve') {
    demoStore.adminTaskStatus[id] = { label: '已处理（演示）', class: 'green', resolved: true }
    if (demoStore.adminReportsCount > 0) demoStore.adminReportsCount -= 1
  }
  showToast(taskMessages[action])
}

function onShortcut(action) {
  showToast(taskMessages[action] || '该管理操作目前只提供原型交互。')
}

function onAgentToggle(key) {
  demoStore.agentState[key] = !demoStore.agentState[key]
  showToast('已切换本地演示开关；不影响真实模型或审核行为。')
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">PLATFORM OPERATIONS</div>
        <h1>管理员控制台</h1>
        <p>处理账号权限、内容举报、作品授权争议、用户反馈和平台规则，并保留关键操作记录。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-route="profile">返回个人中心</button>
        <button class="solid-btn" @click="onShortcut('refresh')">刷新演示状态</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>这是管理端产品原型，不会真正封禁账号或修改平台配置。正式平台应遵循最小权限原则，高影响操作需要确认、记录原因，并在适用情况下支持申诉。</div>
    </div>

    <div class="page-stats">
      <div class="page-stat">
        <span>待处理举报</span>
        <strong>{{ demoStore.adminReportsCount }}</strong>
        <small>演示队列</small>
      </div>
      <div class="page-stat">
        <span>待处理反馈</span>
        <strong>4</strong>
        <small>Bug 与功能建议示例</small>
      </div>
      <div class="page-stat">
        <span>待核实链接</span>
        <strong>2</strong>
        <small>竞赛与外部资源示例</small>
      </div>
    </div>

    <div class="page-layout-two">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>举报与内容治理</h2>
            <p>查看上下文、风险理由与处理状态；争议内容应谨慎核实。</p>
          </div>
          <span class="page-badge amber">示例工单</span>
        </div>

        <div>
          <div v-for="t in tasks" :key="t.id" class="page-list-row admin-task">
            <span class="page-list-icon"><AppIcon :name="t.icon" /></span>
            <div class="page-list-content">
              <strong>{{ t.title }}</strong>
              <p>{{ t.desc }}</p>
              <small>{{ t.meta }}</small>
              <div v-if="!t.resolved" class="page-actions mt-9">
                <button class="mini-btn" @click="onTaskAction('review', t.id)">标记正在核实</button>
                <button class="mini-btn" @click="onTaskAction('resolve', t.id)">处理完成</button>
              </div>
            </div>
            <span class="page-badge" :class="t.status.class">{{ t.status.label }}</span>
          </div>
        </div>
      </div>

      <aside class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>管理快捷入口</h2>
            <p>按职责拆分后台模块。</p>
          </div>
        </div>

        <div v-for="s in adminShortcuts" :key="s.title" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="s.icon" /></span>
          <div class="page-list-content">
            <strong>{{ s.title }}</strong>
            <p>{{ s.desc }}</p>
            <div class="page-actions" v-if="s.actions.length">
              <button
                v-for="a in s.actions"
                :key="a.label"
                class="mini-btn"
                :data-admin-action="a.adminAction"
                :data-modal="a.modal"
                @click="a.adminAction && onShortcut(a.adminAction)"
              >
                {{ a.label }}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>Agent 管理</h2>
            <p>只管理产品级开关、适用范围与抽查状态，不允许 Agent 自行提升权限。</p>
          </div>
          <span class="page-badge amber">本地演示开关</span>
        </div>

        <div v-for="agent in agentDefinitions" :key="agent.key" class="agent-card">
          <div class="agent-icon"><AppIcon :name="agent.icon" /></div>
          <div>
            <h3>{{ agent.title }}</h3>
            <p>{{ agent.desc }}</p>
            <small
              class="page-badge agent-status"
              :class="demoStore.agentState[agent.key] ? 'green' : 'amber'"
            >
              {{ demoStore.agentState[agent.key] ? '原型已启用' : '原型已停用' }}
            </small>
          </div>
          <button
            class="switch"
            role="switch"
            :aria-checked="String(demoStore.agentState[agent.key])"
            :aria-label="`切换${agent.title}`"
            @click="onAgentToggle(agent.key)"
          ></button>
        </div>

        <div class="page-callout">
          <AppIcon name="i-info" />
          <div>上述开关仅在当前预览中切换状态，不会启停真实模型或改变真实审核行为。正式平台需要记录配置变化、抽查误判，并支持异常时暂停自动拦截。</div>
        </div>
      </div>
    </div>
  </section>
</template>
