<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import AgentSlot from '../../components/AgentSlot.vue'
import { authStore } from '../../stores/auth.js'
import { teacherStore, setReviewTaskState } from '../../stores/teacher.js'
import { reviewTasks } from '../../data/teacher.js'
import {
  reviewActions,
  reviewActionOrder,
  reviewTaskStates,
  riskCategories,
} from '../../data/dict.js'
import { AGENT_KEYS } from '../../services/agentContract.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 教师审核任务（设计书 §6.4）。
 *
 * §6.4 原文：若教师被授予内容审核职责，可以在**授权范围内**查看待审核队列。
 * 每项任务应包含：内容类型、风险提示、审核理由、内容作者、可采取的操作和处理记录。
 * 可选操作：通过、退回修改、暂缓并转交、隐藏待核实、拒绝并说明理由。
 *
 * §6.4 末尾的硬约束：教师不能随意处理不属于其权限范围的用户账号、
 * 全站规则或其他部门的官方通知 —— 所以这里只有内容处置，没有账号操作。
 *
 * §8.3.6：审核与处罚分离。Agent 只做初筛与建议，不直接执行处置。
 * §15.4：Agent 不可用时按安全策略进入人工审核，**不能默认放行**。
 */

const router = useRouter()

/** 是否有审核职责 */
const canReview = computed(() => authStore.role === 'admin' || authStore.canReview)

/* ---------- 任务列表 ---------- */
const tasks = computed(() =>
  reviewTasks.map((t) => {
    const runtime = teacherStore.reviewTaskStates[t.id]
    const status = runtime?.status || t.status
    return {
      ...t,
      status,
      stateMeta: reviewTaskStates[status] || reviewTaskStates.pending,
      riskMeta: riskCategories[t.risk] || riskCategories.judgment,
      history: runtime?.history || t.history,
      doneAction: runtime?.action,
      doneReason: runtime?.reason,
    }
  })
)

/** 待处理的任务 */
const pendingTasks = computed(() =>
  tasks.value.filter((t) => ['pending', 'agentReview', 'needHuman'].includes(t.status))
)
const doneTasks = computed(() => tasks.value.filter((t) => t.status === 'done' || t.status === 'deferred'))

/* ---------- 处置 ---------- */
/**
 * 处置面板在任务卡内联展开，不用弹窗。
 *
 * 原因：项目的 ModalHost 是全局常驻的，自造同名的 .modal 弹层会与它抢
 * 选择器，状态也对不上。内联展开还有个好处 —— 处置时上下文仍在视野内，
 * 不用在弹窗和列表之间来回看。
 */
const acting = ref(null)
const reasonText = ref('')

function openAction(task, action) {
  /* 再次点击同一个动作 = 收起 */
  if (acting.value?.taskId === task.id && acting.value?.action === action) {
    acting.value = null
    reasonText.value = ''
    return
  }
  acting.value = { taskId: task.id, action }
  reasonText.value = ''
}

function closeAction() {
  acting.value = null
  reasonText.value = ''
}

function submitAction(task, action) {
  const a = reviewActions[action]
  if (a.needsReason && !reasonText.value.trim()) {
    showToast(a.reasonHint)
    return
  }
  setReviewTaskState(task.id, action, reasonText.value.trim(), authStore.displayName)
  closeAction()
  showToast(`已${a.label}：${task.title}。处理原因、执行主体与时间已记录。`)
}

/* ---------- Agent 承载区（§8.3） ---------- */
/**
 * 这里只挂承载区，不预设 Agent 的实现。
 * 接入点仍是 services/agentRuntime.js 的 runAgent()。
 */
const agentNote = computed(() => {
  const t = pendingTasks.value[0]
  return t?.agentNote || ''
})
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">REVIEW QUEUE</div>
        <h1>被分配的审核事项</h1>
        <p>在授权范围内处理待审核内容。每项任务都会说明风险提示与审核理由。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" @click="router.push({ name: 'teacher' })">返回工作台</button>
      </div>
    </div>

    <!--
      §6.4：审核队列只在被授予审核职责时出现。
      没有权限时不提供任何可误触的处置入口。
    -->
    <div v-if="!canReview" class="page-section">
      <div class="page-panel">
        <div class="permission-gate">
          <span class="permission-gate-icon"><AppIcon name="i-shield" /></span>
          <div>
            <strong>当前身份没有被授予内容审核职责</strong>
            <p>
              审核任务队列只对被授予审核职责的教师开放。
              普通教师可以处理自己小组内的初步管理事项，但不能查看全站待审核队列。
            </p>
            <p class="permission-gate-how">
              如需使用，请向平台管理员申请「内容审核职责」授权；
              授权通过后重新登录即可看到审核队列。
            </p>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="page-callout">
        <AppIcon name="i-info" />
        <div>
          你只能处理<strong>分配给你且在授权范围内</strong>的审核事项。
          不能处理全站账号、平台规则或其他部门的官方通知 —— 这些不在教师审核职责内。
          所有处置都会记录原因、执行主体与时间。
        </div>
      </div>

      <div class="page-stats">
        <div class="page-stat">
          <span>待处理</span>
          <strong>{{ pendingTasks.length }}</strong>
          <small>按分配时间进入队列</small>
        </div>
        <div class="page-stat">
          <span>待人工复核</span>
          <strong>{{ tasks.filter((t) => t.status === 'needHuman').length }}</strong>
          <small>Agent 置信不足或存在争议</small>
        </div>
        <div class="page-stat">
          <span>已完成</span>
          <strong>{{ doneTasks.length }}</strong>
          <small>含转交其他处理人</small>
        </div>
      </div>

      <!-- Agent 承载区：审核 Agent 只做初筛与建议 -->
      <div class="page-section">
        <AgentSlot :agent-key="AGENT_KEYS.moderation" title="内容审核 Agent（发布前风险初筛）">
          <div class="review-agent-note">
            <AppIcon name="i-info" />
            <span>
              Agent 只做初筛并提出建议，不直接执行处置。
              <template v-if="agentNote">
                <br />当前队列首条任务的 Agent 标记：{{ agentNote }}
              </template>
              <br />
              Agent 不可用时，任务会按安全策略进入人工审核队列，不会默认放行。
            </span>
          </div>
        </AgentSlot>
      </div>

      <!-- 待处理队列 -->
      <div class="page-section">
        <div class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>待审核队列</h2>
              <p>按风险优先级与截止时间排列。</p>
            </div>
          </div>

          <div v-for="t in pendingTasks" :key="t.id" class="review-card">
            <div class="review-head">
              <span class="page-list-icon"><AppIcon :name="t.typeIcon" /></span>
              <div class="page-list-content">
                <strong>{{ t.title }}</strong>
                <p>内容作者：{{ t.author }}</p>
              </div>
              <span class="page-badge" :class="t.stateMeta.tone">{{ t.stateMeta.label }}</span>
            </div>

            <div class="admin-item-meta">
              <span class="admin-item-chip">{{ t.type }}</span>
              <span class="admin-item-chip high">{{ t.riskMeta.label }}</span>
              <span class="admin-item-chip">{{ t.scope }}</span>
              <span class="admin-item-chip">分配于 {{ t.assignedAt }}</span>
              <span class="admin-item-chip red">截止 {{ t.dueAt }}</span>
            </div>

            <div class="review-snippet">
              <strong>审核理由：</strong>{{ t.reason }}
              <br /><span style="opacity: .75">内容片段：{{ t.snippet }}</span>
            </div>

            <div class="review-agent-note">
              <AppIcon name="i-shield" />
              <span>{{ t.agentNote }}</span>
            </div>

            <div class="review-actions">
              <button
                v-for="key in reviewActionOrder"
                :key="key"
                class="mini-btn"
                :class="{ 'is-active': acting?.taskId === t.id && acting?.action === key }"
                @click="openAction(t, key)"
              >
                {{ reviewActions[key].label }}
              </button>
            </div>

            <!-- 处置面板：内联展开，不用弹窗（ModalHost 是全局常驻的，自造 .modal 会冲突） -->
            <div v-if="acting?.taskId === t.id" class="review-action-panel">
              <p class="text-soft-12">{{ reviewActions[acting.action].desc }}</p>
              <div v-if="reviewActions[acting.action].needsReason" class="auth-field mt-9">
                <label :for="`reason-${t.id}`">处理说明</label>
                <div class="auth-input-wrap">
                  <AppIcon name="i-file" />
                  <input
                    :id="`reason-${t.id}`"
                    v-model="reasonText"
                    type="text"
                    :placeholder="reviewActions[acting.action].reasonHint"
                  />
                </div>
              </div>
              <p class="auth-case-note">
                处理原因、执行主体与时间会被记录。误判可由作者反馈申诉。
              </p>
              <div class="page-actions mt-9">
                <button
                  class="solid-btn"
                  @click="submitAction(t, acting.action)"
                >
                  确认{{ reviewActions[acting.action].label }}
                </button>
                <button class="outline-btn" @click="closeAction">取消</button>
              </div>
            </div>

            <div class="review-history">
              <div class="review-history-row" v-for="(h, i) in t.history" :key="i">
                <strong>{{ h.time }}</strong>
                <span>{{ h.actor }} · {{ h.action }}{{ h.detail ? ' — ' + h.detail : '' }}</span>
              </div>
            </div>
          </div>

          <div v-if="!pendingTasks.length" class="page-empty">
            当前没有待处理的审核事项。新的分配会出现在这里。
          </div>
        </div>
      </div>

      <!-- 已处理 -->
      <div v-if="doneTasks.length" class="page-section">
        <div class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>处理记录</h2>
              <p>已完成处置与转交的事项，含原因、执行主体与时间。</p>
            </div>
          </div>
          <div v-for="t in doneTasks" :key="t.id" class="page-list-row">
            <span class="page-list-icon"><AppIcon :name="t.typeIcon" /></span>
            <div class="page-list-content">
              <strong>{{ t.title }}</strong>
              <p>{{ t.doneReason || '（未填写说明）' }}</p>
              <small>
                {{ t.doneAction ? reviewActions[t.doneAction]?.label : '已处理' }}
                · {{ t.type }} · 处置于 {{ t.doneAt || t.assignedAt }}
              </small>
            </div>
            <span class="page-badge" :class="t.stateMeta.tone">{{ t.stateMeta.label }}</span>
          </div>
        </div>
      </div>
    </template>

  </section>
</template>
