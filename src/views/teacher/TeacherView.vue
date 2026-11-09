<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import { authStore } from '../../stores/auth.js'
import { demoStore } from '../../stores/demo.js'
import { teacherStore, groupState } from '../../stores/teacher.js'
import {
  teacherGroups,
  teacherPublishedItems,
  studentQuestions,
  pendingJoinRequests,
  reviewTasks,
} from '../../data/teacher.js'
import { recommendStates } from '../../stores/caseAuth.js'
import { contentStates, contentStateOrder, recommendMeta, reviewTaskStates } from '../../data/dict.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 教师工作台（设计书 §6.1）。
 *
 * 页面目标是「让教师快速处理自己负责的学习小组、内容推荐和审核任务，
 * 避免教师进入后台后仍需要在多个页面寻找待办事项」——
 * 所以这里是**待办聚合**，不是内容陈列。
 * 完整的编辑与管理操作在「学习平台管理」各子页面完成，
 * 工作台只给摘要 + 直达操作入口。
 */

const router = useRouter()

/* ---------- 权限 ---------- */
/** 审核任务只在被授予审核职责时出现（§6.1.2 原文） */
const canReview = computed(() => authStore.role === 'admin' || authStore.canReview)
/** 校级内容管理仅授权角色（§4.2） */
const hasContentAdmin = computed(() => authStore.role === 'admin' || authStore.contentAdmin)

/* ---------- §6.1.2 我管理的学习小组 ---------- */
/**
 * 待处理加入申请按 groupId 归组统计。
 * 不能用申请 id 前缀去猜归属 —— 申请 id 是 JR-xxx，与小组 id（TG-xxx）无关。
 */
const myGroups = computed(() =>
  teacherGroups.map((g) => {
    const runtime = groupState(g)
    const pendingCount = pendingJoinRequests.filter(
      (r) => r.groupId === g.id && (teacherStore.joinRequests[r.id]?.status || r.status) === 'pending'
    ).length
    return { ...runtime, pending: pendingCount }
  })
)

/* ---------- §6.1.2 待处理的案例推荐申请 ---------- */
const pendingRecommendations = computed(() => {
  const local = demoStore.recommendRequests.map((r) => ({
    id: r.id,
    title: r.caseTitle,
    author: '待确认作者',
    reason: r.reason,
    createdAt: r.createdAt,
    state: teacherStore.recommendStates[r.id]?.state || r.state || 'pending',
    isLocal: true,
  }))
  const demo = [
    {
      id: 'DEMO-REC-001',
      title: '智能硬件项目实践复盘',
      author: '赵同学',
      reason: '项目复盘完整，对后续学习者有参考价值。',
      createdAt: '2026-11-06',
      state: 'pending',
      isLocal: false,
    },
  ]
  return [...local, ...demo]
    .filter((r) => ['pending', 'modified'].includes(r.state))
    .map((r) => ({
      ...r,
      stateMeta: recommendMeta(r.state),
      stateLabel: r.state === 'modified' ? '学生要求修改' : recommendStates[r.state]?.label || '等待学生确认',
    }))
})

/* ---------- §6.1.2 等待人工复核的内容（仅审核权限） ---------- */
const humanReviewTasks = computed(() =>
  reviewTasks
    .filter((t) => {
      const s = teacherStore.reviewTaskStates[t.id]?.status || t.status
      return s === 'needHuman' || s === 'pending'
    })
    .map((t) => ({
      ...t,
      stateMeta: reviewTaskStates[teacherStore.reviewTaskStates[t.id]?.status || t.status],
    }))
)

/* ---------- §6.1.2 近期发布的推荐资源或公告 ---------- */
const publishedItems = computed(() =>
  teacherPublishedItems.slice(0, 4).map((p) => ({
    ...p,
    stateMeta: contentStates[p.state] || contentStates.published,
  }))
)

/* ---------- §6.1.2 需要回复的学生问题 / 反馈 ---------- */
const openQuestions = computed(() =>
  studentQuestions
    .filter((q) => (teacherStore.questions[q.id]?.status || q.status) === 'pending')
    .map((q) => ({ ...q, stateMeta: contentStates.pending }))
)

/* ---------- §6.1.2 相关内容状态统计 ---------- */
const stateStats = computed(() => {
  /* 演示态：按教师名下内容的实际状态归类 */
  const raw = {
    published: myGroups.value.filter((g) => g.status === 'active').length + publishedItems.value.length,
    pending: pendingRecommendations.value.length + openQuestions.value.length,
    review: humanReviewTasks.value.length,
    archived: myGroups.value.filter((g) => g.status === 'archived').length,
    draft: 0,
    returned: 0,
    hidden: 0,
    removed: 0,
    deleted: 0,
  }
  return contentStateOrder
    .map((k) => ({ key: k, count: raw[k] || 0, meta: contentStates[k] }))
    .filter((s) => s.count > 0)
})

/* ---------- 待办聚合：按优先级 + 截止时间排序 ---------- */
/**
 * 设计书 §6.1.2：「被分配的任务应显示截止时间或优先级（如适用），
 * 并提供明确操作入口。」
 */
const priorityWeight = { high: 0, normal: 1, low: 2 }

const todoItems = computed(() => {
  const list = []

  pendingRecommendations.value.forEach((r) => {
    list.push({
      id: `todo-rec-${r.id}`,
      kind: '案例推荐',
      kindIcon: 'i-trophy',
      title: r.title,
      detail: `作者 ${r.author} · ${r.stateLabel}`,
      priority: r.state === 'modified' ? 'high' : 'normal',
      dueAt: null,
      route: 'teacherReviews',
      action: '处理推荐',
    })
  })

  /*
   * 审核类待办只在有审核职责时加入。
   * §6.1.2 原文：「等待人工复核的内容（仅在有审核权限时显示）」——
   * 没有授权就完全不该看到，更不该在待办列表里露出入口。
   */
  if (canReview.value) {
    humanReviewTasks.value.forEach((t) => {
      list.push({
        id: `todo-rv-${t.id}`,
        kind: '内容审核',
        kindIcon: 'i-shield',
        title: t.title,
        detail: `${t.type} · ${t.riskLabel}`,
        priority: t.priority,
        dueAt: t.dueAt,
        route: 'teacherTasks',
        action: '进入审核',
      })
    })
  }

  openQuestions.value.forEach((q) => {
    list.push({
      id: `todo-q-${q.id}`,
      kind: q.kind,
      kindIcon: q.kindIcon,
      title: q.title,
      detail: `${q.from} · ${q.group}`,
      priority: q.priority,
      dueAt: q.dueAt,
      route: 'teacher',
      action: '去回复',
      self: true,
    })
  })

  pendingJoinRequests
    .filter((r) => (teacherStore.joinRequests[r.id]?.status || r.status) === 'pending')
    .forEach((r) => {
      list.push({
        id: `todo-jr-${r.id}`,
        kind: '加入申请',
        kindIcon: 'i-users',
        title: `${r.applicant} 申请加入「${r.groupTitle}」`,
        detail: r.reason,
        priority: 'normal',
        dueAt: null,
        route: 'teacherGroups',
        action: '去处理',
      })
    })

  /* 优先级高的排前面；同级按有截止时间的排前面（越早越靠前），无截止时间的排最后 */
  return list.sort((a, b) => {
    const p = priorityWeight[a.priority] - priorityWeight[b.priority]
    if (p !== 0) return p
    if (a.dueAt && b.dueAt) return a.dueAt < b.dueAt ? -1 : 1
    if (a.dueAt) return -1
    if (b.dueAt) return 1
    return 0
  })
})

const stats = computed(() => [
  { label: '待处理事项', value: todoItems.value.length, note: '按优先级与截止时间排序' },
  { label: '我管理的小组', value: myGroups.value.filter((g) => g.status === 'active').length, note: '含已归档共 ' + myGroups.value.length + ' 个' },
  { label: '待回复问题', value: openQuestions.value.length, note: '来自小组与反馈建议' },
])

/* ---------- 操作 ---------- */
function go(routeName) {
  router.push({ name: routeName })
}

function replyQuestion(q) {
  /* 演示态：直接标记为已回复并给出占位答复，正式平台需真实提交 */
  teacherStore.questions[q.id] = {
    status: 'replied',
    reply: '已收到你的问题，我会在小组公告里补充一份排查步骤。',
    at: new Date().toISOString().slice(0, 16).replace('T', ' '),
  }
  showToast('已记录一条演示回复。正式平台需要真实提交并保留回复记录。')
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">TEACHER WORKSPACE</div>
        <h1>教师工作台</h1>
        <p>集中处理待办事项、近期小组动态与审核推荐状态。只展示你有权查看的内容。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" data-route="profile">返回个人中心</button>
        <button class="solid-btn" data-route="teacherGroups">管理我的小组</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>
        正式平台需要验证教师身份，并按课程、小组或明确授权限制管理范围。
        普通教师默认无权发布校级官方通知或管理全站账号；
        内容审核任务也需要单独授权才会出现在待办中。
      </div>
    </div>

    <div class="page-stats">
      <div v-for="s in stats" :key="s.label" class="page-stat">
        <span>{{ s.label }}</span>
        <strong>{{ s.value }}</strong>
        <small>{{ s.note }}</small>
      </div>
    </div>

    <!--
      §6.1.2 的核心：待处理事项。
      「避免教师进入后台后仍需要在多个页面寻找待办事项」——
      所以待办集中在这里，每条直接给操作入口。
    -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>待处理事项</h2>
            <p>按优先级与截止时间排序，处理结果会同步到对应模块。</p>
          </div>
          <span class="page-badge amber">{{ todoItems.length }} 项待办</span>
        </div>

        <div v-if="todoItems.length" class="todo-list">
          <div v-for="t in todoItems" :key="t.id" class="todo-item">
            <span class="page-list-icon"><AppIcon :name="t.kindIcon" /></span>
            <div class="page-list-content">
              <strong>{{ t.title }}</strong>
              <p>{{ t.detail }}</p>
              <div class="admin-item-meta">
                <span class="admin-item-chip">{{ t.kind }}</span>
                <span
                  class="admin-item-chip"
                  :class="t.priority === 'high' ? 'high' : t.priority === 'normal' ? 'medium' : 'green'"
                >
                  {{ t.priority === 'high' ? '高优先级' : t.priority === 'normal' ? '常规优先级' : '低优先级' }}
                </span>
                <span v-if="t.dueAt" class="admin-item-chip red">截止 {{ t.dueAt }}</span>
              </div>
            </div>
            <button
              class="mini-btn"
              @click="t.self ? replyQuestion(openQuestions.find((q) => t.id === `todo-q-${q.id}`)) : go(t.route)"
            >
              {{ t.action }}
            </button>
          </div>
        </div>

        <div v-else class="page-empty">
          当前没有待处理事项。新的推荐申请、审核任务与学生问题会出现在这里。
        </div>
      </div>
    </div>

    <!--
      下面几个区块一律通栏。
      之前「我管理的学习小组」与「近期发布」并排，左块 667px、右块 493px，
      和上下方的通栏面板（1180px）对不齐 —— 同一页里出现三种宽度。
      通栏后所有区块宽度一致，左右边缘对齐到同一条基准线。
    -->
    <div class="page-section">
      <!-- §6.1.2 我管理的学习小组 -->
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>我管理的学习小组</h2>
            <p>小组管理权限仅作用于对应小组。</p>
          </div>
          <button class="mini-btn" @click="go('teacherGroups')">全部小组</button>
        </div>

        <div v-for="g in myGroups" :key="g.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="g.icon" /></span>
          <div class="page-list-content">
            <strong>{{ g.title }}</strong>
            <p>{{ g.desc }}</p>
            <div class="admin-item-meta">
              <span class="admin-item-chip">成员 {{ g.members }} 人</span>
              <span class="admin-item-chip">频道 {{ g.channels.filter((c) => c.enabled).length }} 个</span>
              <span v-if="g.pending" class="admin-item-chip amber">
                待处理加入申请 {{ g.pending }}
              </span>
              <span class="admin-item-chip">更新于 {{ g.updatedAt }}</span>
            </div>
          </div>
          <span class="page-badge" :class="g.status === 'active' ? 'green' : 'gray'">
            {{ g.status === 'active' ? '进行中' : '已归档' }}
          </span>
        </div>
      </div>
    </div>

    <!-- §6.1.2 等待人工复核的内容（仅审核权限时显示） -->
    <div v-if="canReview" class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>等待人工复核</h2>
            <p>仅显示你被分配的审核事项。</p>
          </div>
          <button class="mini-btn" @click="go('teacherTasks')">审核队列</button>
        </div>
        <div v-for="t in humanReviewTasks" :key="t.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="t.typeIcon" /></span>
          <div class="page-list-content">
            <strong>{{ t.title }}</strong>
            <p>{{ t.reason }}</p>
            <small>{{ t.type }} · {{ t.riskLabel }} · 截止 {{ t.dueAt }}</small>
          </div>
          <span class="page-badge" :class="t.stateMeta?.tone">{{ t.stateMeta?.label }}</span>
        </div>
      </div>
    </div>

    <!-- §6.1.2 近期发布的推荐资源或公告 -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>近期发布</h2>
            <p>你发布的推荐资源与公告。</p>
          </div>
        </div>
        <div v-for="p in publishedItems" :key="p.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="p.kindIcon" /></span>
          <div class="page-list-content">
            <strong>{{ p.title }}</strong>
            <p>{{ p.desc }}</p>
            <small>{{ p.kind }} · {{ p.scope }} · {{ p.publishedAt }}</small>
          </div>
          <span class="page-badge" :class="p.stateMeta.tone">{{ p.stateMeta.label }}</span>
        </div>
      </div>
    </div>

    <!-- §6.1.2 需要回复的学生问题 / 反馈 -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>需要回复的学生问题</h2>
            <p>仅限有权限的范围。</p>
          </div>
        </div>
        <div v-for="q in openQuestions" :key="q.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="q.kindIcon" /></span>
          <div class="page-list-content">
            <strong>{{ q.title }}</strong>
            <p>{{ q.excerpt }}</p>
            <small>{{ q.from }} · {{ q.group }} · {{ q.askedAt }}</small>
          </div>
          <button class="mini-btn" @click="replyQuestion(q)">回复</button>
        </div>
        <div v-if="!openQuestions.length" class="page-empty">没有待回复的问题。</div>
      </div>
    </div>

    <!-- §6.1.2 相关内容状态统计 -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>内容状态统计</h2>
            <p>与你相关的内容当前所处的状态。</p>
          </div>
        </div>
        <div class="state-stat-grid">
          <div v-for="s in stateStats" :key="s.key" class="state-stat">
            <strong>{{ s.count }}</strong>
            <span>{{ s.meta.label }}</span>
            <small>{{ s.meta.desc }}</small>
          </div>
        </div>
      </div>
    </div>

    <!-- §6.5 首页内容管理入口（仅授权角色可见） -->
    <div v-if="hasContentAdmin" class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>校级首页内容管理</h2>
            <p>你已获得校级内容管理授权，可以创建、编辑、设定有效期、发布、撤回和归档正式通知。</p>
          </div>
          <button class="mini-btn" @click="go('teacherContent')">进入管理</button>
        </div>
      </div>
    </div>
  </section>
</template>
