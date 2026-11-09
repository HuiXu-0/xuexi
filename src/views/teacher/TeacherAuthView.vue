<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import { demoStore } from '../../stores/demo.js'
import { teacherStore } from '../../stores/teacher.js'
import { recommendMeta } from '../../data/dict.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 授权确认状态（设计书 §4.2 教师端导航第 4 项）。
 *
 * §6.3.3 原文：「平台应保存学生对具体展示范围的确认记录。」
 * §6.3.4：「学生授权范围是最终公开范围的上限。」
 *
 * 所以这里展示的是**学生侧的确认记录**，教师只能查看，
 * 不能代替学生确认或扩大范围 —— 也没有任何可以点的处置按钮。
 *
 * 之前它是「学生案例推荐」页面底部的一个区块，但导航里却是独立的
 * 一级子项，两者指向同一个路由，导致下拉菜单里两项同时高亮。
 * 现拆成独立路由。
 */

const router = useRouter()

/** 学生对展示范围的确认记录 */
const authRecords = computed(() => {
  const records = Object.entries(demoStore.caseAuthorizations || {}).map(([caseId, v]) => ({
    caseId,
    ...v,
  }))
  /* 推荐申请里带的确认信息也一并列出（教师自己发起的那些） */
  const fromRequests = demoStore.recommendRequests.map((r) => ({
    caseId: r.caseId,
    state: r.state,
    sections: r.sections || {},
    note: '',
    updatedAt: r.createdAt,
    title: r.caseTitle,
    fromRecommend: true,
  }))
  const seen = new Set(records.map((r) => r.caseId))
  return [...records, ...fromRequests.filter((r) => !seen.has(r.caseId))]
})

/** 待学生确认的（教师视角下最需要关注的状态） */
const pendingCount = computed(
  () => authRecords.value.filter((r) => ['pending', 'modified'].includes(r.state)).length
)

/** 确认范围（§5.6.5 分项公开） */
const sectionLabels = {
  intro: '项目简介',
  process: '实现过程',
  doc: '原理文档',
  source: '源代码',
  screenshot: '成果截图',
  contact: '联系方式',
  members: '成员名单',
  license: '使用许可',
}

function onRemind() {
  showToast(
    '已记录一条演示提醒。正式平台需要向学生发送确认通知，并保留确认时间与确认范围的记录。'
  )
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">AUTHORIZATION RECORD</div>
        <h1>授权确认状态</h1>
        <p>学生对具体展示范围的确认记录。教师只能查看，不能代替学生确认或扩大授权范围。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" @click="router.push({ name: 'teacherReviews' })">返回案例推荐</button>
        <button class="outline-btn" @click="router.push({ name: 'teacher' })">返回工作台</button>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        <strong>学生授权范围是最终公开范围的上限。</strong>
        教师推荐的展示范围不能超出学生已确认的范围；未获完整授权前，
        原理文档、源代码、联系方式与成员名单不会默认公开。
      </div>
    </div>

    <div class="page-stats">
      <div class="page-stat">
        <span>确认记录</span>
        <strong>{{ authRecords.length }}</strong>
        <small>本次会话内的演示数据</small>
      </div>
      <div class="page-stat">
        <span>待学生确认</span>
        <strong>{{ pendingCount }}</strong>
        <small>等待学生逐项确认展示范围</small>
      </div>
      <div class="page-stat">
        <span>已确认</span>
        <strong>{{ authRecords.length - pendingCount }}</strong>
        <small>可进入平台审核环节</small>
      </div>
    </div>

    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>确认记录</h2>
            <p>每条记录保留学生确认的范围与时间。</p>
          </div>
        </div>

        <div v-for="a in authRecords" :key="a.caseId" class="review-card">
          <div class="review-head">
            <span class="page-list-icon"><AppIcon name="i-shield" /></span>
            <div class="page-list-content">
              <strong>{{ a.title || a.caseId }}</strong>
              <p>{{ a.caseId }} · 更新于 {{ a.updatedAt }}</p>
            </div>
            <span class="page-badge" :class="recommendMeta(a.state)?.tone || 'gray'">
              {{ recommendMeta(a.state)?.label || a.state }}
            </span>
          </div>

          <!-- 学生逐项确认的范围 -->
          <div v-if="a.sections && Object.keys(a.sections).length" class="auth-flow">
            <div v-for="(v, k) in a.sections" :key="k" class="auth-section">
              <div class="auth-section-text">
                <strong>{{ sectionLabels[k] || k }}</strong>
                <small>{{ v === 'public' ? '同意公开' : v === 'private' ? '不公开' : v }}</small>
              </div>
            </div>
          </div>
          <p v-else class="auth-case-note">学生尚未逐项确认展示范围。</p>

          <p v-if="a.note" class="auth-case-note">学生备注：{{ a.note }}</p>

          <div class="page-actions mt-9">
            <button
              v-if="['pending', 'modified'].includes(a.state)"
              class="mini-btn"
              @click="onRemind"
            >
              提醒学生确认
            </button>
          </div>
        </div>

        <div v-if="!authRecords.length" class="page-empty">
          还没有授权确认记录。学生在案例页确认展示范围后，记录会出现在这里。
        </div>
      </div>
    </div>
  </section>
</template>
