<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import { demoStore } from '../../stores/demo.js'
import { authStore } from '../../stores/auth.js'
import { teacherStore, setRecommendState } from '../../stores/teacher.js'
import { cases } from '../../data/pages.js'
import {
  recommendFormFields,
  recommendPublishRules,
} from '../../data/teacher.js'
import {
  recommendFlow,
  recommendFlowOrder,
  recommendMeta,
  visibilityScopes,
  visibilityOrder,
} from '../../data/dict.js'
import { createRecommendRequest } from '../../stores/caseAuth.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 优秀案例推荐管理（设计书 §6.3）。
 *
 * §6.3.3 原文的建议状态：草稿、等待学生确认、学生要求修改、已同意、已拒绝、
 * 待平台审核、已发布、已撤回。
 *
 * §6.3.3 末尾的硬约束：
 *   「教师只能管理自己发起的推荐或明确授权给自己的事项。
 *     平台应保存学生对具体展示范围的确认记录。」
 * 所以列表只含当前教师发起的推荐，不提供查看他人推荐的入口。
 *
 * §6.3.4：学生授权范围是最终公开范围的上限 —— 教师的「拟发布范围」
 * 只能收窄，不能超出学生确认的范围。
 */

const router = useRouter()

/* ---------- 当前教师发起的推荐（§6.3.3 权限边界） ---------- */
const myRecommendations = computed(() => {
  const local = demoStore.recommendRequests.map((r) => ({
    id: r.id,
    title: r.caseTitle,
    author: '待作者确认',
    reason: r.reason,
    createdAt: r.createdAt,
    scope: '校内可见',
    fields: '项目简介、成果截图',
    note: '',
    baseState: r.state || 'pending',
    isLocal: true,
  }))
  const demo = [
    {
      id: 'DEMO-REC-001',
      title: '智能硬件项目实践复盘',
      author: '赵同学',
      reason: '项目复盘完整，对后续学习者有参考价值。',
      createdAt: '2026-11-06',
      scope: '校内可见',
      fields: '项目简介、成果截图、技术路线',
      note: '该案例在同类项目中完成度较高，推荐作为复盘范例。',
      baseState: 'pending',
      isLocal: false,
    },
    {
      id: 'DEMO-REC-002',
      title: '轻量级模型部署实践笔记',
      author: '孙同学',
      reason: '模型压缩与边缘部署部分有完整记录。',
      createdAt: '2026-11-02',
      scope: '公开可见',
      fields: '项目简介、评测数据、部署脚本说明',
      note: '',
      baseState: 'accepted',
      isLocal: false,
    },
  ]
  return [...local, ...demo].map((r) => {
    const runtime = teacherStore.recommendStates[r.id]
    const state = runtime?.state || r.baseState
    return {
      ...r,
      state,
      meta: recommendMeta(state),
      updatedAt: runtime?.updatedAt || r.createdAt,
      history: runtime?.history || [
        { time: `${r.createdAt} 09:00`, state: 'pending', note: '已发送推荐邀请，等待作者确认展示范围。' },
      ],
    }
  })
})

/* ---------- 状态流转条（§6.3.3） ---------- */
const flowPath = recommendFlowOrder

/** 当前推荐可推进到的下一状态 */
function nextStates(state) {
  return recommendFlow[state]?.next || []
}

/* ---------- 发起推荐（§6.3.1、§6.3.2） ---------- */
const form = ref({
  project: '',
  reason: '',
  fields: '',
  scope: 'campus',
  note: '',
})
const showForm = ref(false)

const formReady = computed(() => form.value.project.trim() && form.value.reason.trim() && form.value.fields.trim())

function resetForm() {
  form.value = { project: '', reason: '', fields: '', scope: 'campus', note: '' }
}

function onSubmitRecommend() {
  if (!formReady.value) {
    showToast('请先填写项目名称、推荐理由与拟展示字段。')
    return
  }
  const req = createRecommendRequest({
    caseId: `local-${Date.now()}`,
    caseTitle: form.value.project.trim(),
    teacher: authStore.displayName,
    reason: form.value.reason.trim(),
  })
  demoStore.teacherPendingCount += 1
  resetForm()
  showForm.value = false
  showToast(
    `已向作者发送推荐申请（${req.id}）。内容能否公开由作者逐项确认，教师推荐不等于自动授权。`
  )
}

/* ---------- 状态推进 ---------- */
function advance(rec, nextState) {
  const label = recommendMeta(nextState).label
  setRecommendState(rec.id, nextState, `推进到「${label}」`)
  showToast(`推荐已推进到「${label}」。`)
}

function withdraw(rec) {
  setRecommendState(rec.id, 'withdrawn', '教师撤回推荐')
  showToast('推荐已撤回。学生撤回授权时，正式平台需同步处理页面与搜索索引。')
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">CASE RECOMMENDATION</div>
        <h1>学生案例推荐</h1>
        <p>发起推荐、跟踪授权进度。推荐只是教师希望展示某个项目，公开与否由作者决定。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" @click="router.push({ name: 'teacher' })">返回工作台</button>
        <button class="solid-btn" @click="showForm = !showForm">
          {{ showForm ? '收起表单' : '发起推荐' }}
        </button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        <strong>教师只能管理自己发起的推荐或明确授权给自己的事项。</strong>
        推荐申请仅表示教师希望展示该项目，内容能否公开由作者逐项确认。
        未获完整授权前，原理文档、源代码、联系方式与成员名单不会默认公开。
      </div>
    </div>

    <!-- §6.3.2 推荐申请内容 -->
    <div v-if="showForm" class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>发起推荐申请</h2>
            <p>
              若项目目前没有公开页面，推荐邀请应先发送给作者，
              由作者决定是否创建或公开内容。
            </p>
          </div>
        </div>

        <div class="auth-grid">
          <div v-for="f in recommendFormFields" :key="f.key" class="auth-field">
            <label :for="`rec-${f.key}`">{{ f.label }}{{ f.required ? ' *' : '' }}</label>
            <div class="auth-input-wrap" :class="{ 'is-error': !f.required && false }">
              <AppIcon :name="f.key === 'project' ? 'i-spark' : f.key === 'scope' ? 'i-eye' : 'i-file'" />
              <select
                v-if="f.key === 'scope'"
                :id="`rec-${f.key}`"
                v-model="form.scope"
                class="page-select select-full"
              >
                <option v-for="v in visibilityOrder" :key="v" :value="v">
                  {{ visibilityScopes[v].label }}
                </option>
              </select>
              <input
                v-else
                :id="`rec-${f.key}`"
                v-model="form[f.key]"
                type="text"
                :placeholder="f.hint"
              />
            </div>
            <small class="auth-case-note">{{ f.hint }}</small>
          </div>
        </div>

        <div class="page-actions mt-12">
          <button class="solid-btn" :disabled="!formReady" @click="onSubmitRecommend">
            发送推荐邀请 <AppIcon name="i-send" />
          </button>
          <button class="outline-btn" @click="resetForm">清空</button>
        </div>
        <p v-if="!formReady" class="auth-case-note">
          带 * 的三项为必填。附件在正式平台需单独确认授权，此处只做登记。
        </p>
      </div>
    </div>

    <!-- §6.3.4 推荐发布要求 -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>推荐发布要求</h2>
            <p>发布前必须逐条确认。</p>
          </div>
        </div>
        <ul class="rules-list">
          <li v-for="(r, i) in recommendPublishRules" :key="i">{{ r }}</li>
        </ul>
      </div>
    </div>

    <!-- 我的推荐列表 -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>我发起的推荐</h2>
            <p>共 {{ myRecommendations.length }} 条。只有你发起的推荐会出现在这里。</p>
          </div>
        </div>

        <div v-for="rec in myRecommendations" :key="rec.id" class="review-card">
          <div class="review-head">
            <span class="page-list-icon"><AppIcon name="i-trophy" /></span>
            <div class="page-list-content">
              <strong>{{ rec.title }}</strong>
              <p>作者/团队：{{ rec.author }}</p>
              <p>推荐理由：{{ rec.reason }}</p>
            </div>
            <span class="page-badge" :class="rec.meta.tone">{{ rec.meta.label }}</span>
          </div>

          <div class="admin-item-meta">
            <span class="admin-item-chip">拟展示：{{ rec.fields }}</span>
            <span class="admin-item-chip">拟发布范围：{{ visibilityScopes[rec.scope]?.label || rec.scope }}</span>
            <span class="admin-item-chip">发起于 {{ rec.createdAt }}</span>
          </div>

          <p v-if="rec.note" class="auth-case-note">推荐说明：{{ rec.note }}</p>

          <!-- §6.3.3 状态流转 -->
          <div class="flow-track">
            <template v-for="(s, i) in flowPath" :key="s">
              <span
                class="flow-node"
                :class="{
                  done: flowPath.indexOf(rec.state) > i,
                  current: rec.state === s,
                }"
              >
                {{ recommendMeta(s).label }}
              </span>
              <span v-if="i < flowPath.length - 1" class="flow-arrow">›</span>
            </template>
          </div>
          <p class="auth-case-note">{{ rec.meta.desc }}</p>

          <div class="review-actions">
            <button
              v-for="next in nextStates(rec.state)"
              :key="next"
              class="mini-btn"
              @click="advance(rec, next)"
            >
              推进到「{{ recommendMeta(next).label }}」
            </button>
            <button
              v-if="!['withdrawn', 'rejected', 'published'].includes(rec.state)"
              class="mini-btn"
              @click="withdraw(rec)"
            >
              撤回推荐
            </button>
          </div>

          <div class="review-history">
            <div class="review-history-row" v-for="(h, i) in rec.history" :key="i">
              <strong>{{ h.time }}</strong>
              <span>{{ recommendMeta(h.state).label }}{{ h.note ? ' — ' + h.note : '' }}</span>
            </div>
          </div>
        </div>

        <div v-if="!myRecommendations.length" class="page-empty">
          还没有发起过推荐。点击右上角「发起推荐」开始。
        </div>
      </div>
    </div>

  </section>
</template>
