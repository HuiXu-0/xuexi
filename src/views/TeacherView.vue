<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { teacherManagedGroups, cases } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'
import { authStore } from '../stores/auth.js'
import {
  recommendStates,
  createRecommendRequest,
  getAuthorization,
} from '../stores/caseAuth.js'

/**
 * 推荐事项列表。
 * 教师推荐不等于学生自动授权 —— 状态统一走 recommendStates，
 * 「等待学生确认」是常态，只有 accepted/modified 才算拿到授权。
 */
const recommendations = computed(() => [
  ...demoStore.recommendations.map((r) => ({
    id: `local-${r.title}`,
    icon: 'i-trophy',
    title: r.title,
    desc: `推荐理由：${r.reason}。发布前需由作者确认拟展示字段和受众范围。`,
    meta: `作者：${r.author} · 状态：等待学生确认 · 本地演示`,
    state: 'pending',
    isLocal: true,
  })),
  ...demoStore.recommendRequests.map((r) => ({
    id: r.id,
    icon: 'i-trophy',
    title: r.caseTitle,
    desc: `推荐理由：${r.reason}`,
    meta: `编号：${r.id} · 发起于 ${r.createdAt} · 状态：${recommendStates[r.state]?.label}`,
    state: r.state,
    isLocal: true,
  })),
  {
    id: 'DEMO-REC-001',
    icon: 'i-trophy',
    title: '智能硬件项目实践复盘（演示）',
    desc: '推荐理由：项目复盘对后续学习有参考价值。发布前需由作者确认拟展示字段和受众范围。',
    meta: '状态：等待学生确认',
    state: 'pending',
    isLocal: false,
  },
])

/** 可发起推荐的案例（学生已有项目） */
const recommendableCases = computed(() => cases.slice(0, 4))

/** 当前选中的推荐目标 */
const recommendCaseId = ref('')

function onSubmitRecommend() {
  const c = recommendableCases.value.find((x) => x.id === recommendCaseId.value)
  if (!c) {
    showToast('请先选择一个要推荐的项目。')
    return
  }
  onCreateRecommend(c)
  recommendCaseId.value = ''
}

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

/** 发起推荐申请（设计书 §5.6.6 第 1~2 步） */
function onCreateRecommend(c) {
  const req = createRecommendRequest({
    caseId: c.id,
    caseTitle: c.title,
    teacher: authStore.displayName,
    reason: '项目实践完整，对后续学习者有参考价值。',
  })
  demoStore.teacherPendingCount += 1
  showToast(`已向作者发送推荐申请（${req.id}）。内容需作者逐项确认后才会展示。`)
}

/**
 * 校级公告管理权限门（设计书 §4.2）。
 * 不具备权限的普通教师不应看到可操作的校级公告管理入口；
 * 若展示入口说明权限不足，应清楚解释如何申请权限，
 * 不能展示可误触的虚假操作按钮。
 */
const hasContentAdmin = computed(() => authStore.role === 'admin' || authStore.contentAdmin)
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

        <!-- 可发起的推荐（设计书 §5.6.6 第 1 步） -->
        <div class="recommend-picker">
          <label class="auth-picker-label" for="recommendCaseSelect">选择要推荐的学生项目</label>
          <select id="recommendCaseSelect" v-model="recommendCaseId" class="page-select select-full">
            <option value="">请选择项目</option>
            <option v-for="c in recommendableCases" :key="c.id" :value="c.id">{{ c.title }}</option>
          </select>
          <button
            class="solid-btn mt-9"
            :disabled="!recommendCaseId"
            @click="onSubmitRecommend"
          >
            发起推荐申请 <AppIcon name="i-send" />
          </button>
          <p class="auth-case-note">
            推荐申请仅表示教师希望展示该项目，内容能否公开由作者逐项确认。
            未获完整授权前，文档、源码与联系方式不会默认公开。
          </p>
        </div>

        <div>
          <div v-for="r in recommendations" :key="r.id" class="page-list-row admin-task">
            <span class="page-list-icon"><AppIcon :name="r.icon" /></span>
            <div class="page-list-content">
              <strong>{{ r.title }}</strong>
              <p>{{ r.desc }}</p>
              <small>{{ r.meta }}</small>
              <div class="page-actions mt-9">
                <button class="mini-btn" @click="onAdminAction('review-recommendation', r.id)">
                  查看授权流程
                </button>
                <button class="mini-btn" @click="onAdminAction('close-recommendation', r.id)">
                  标记已处理
                </button>
              </div>
            </div>
            <span class="page-badge" :class="recommendStates[r.state]?.tone">
              {{ recommendStates[r.state]?.label || '待确认' }}
            </span>
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
          class="outline-btn w-full justify-center mt-12"
          data-route="forum"
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

        <!--
          权限门（设计书 §4.2）：
          具备授权 → 显示真实可操作入口；
          不具备授权 → 只说明如何申请，不展示任何可误触的操作按钮。
        -->
        <template v-if="hasContentAdmin">
          <p class="text-soft-12">
            你已获得校级内容管理授权。可以创建、编辑、设定有效期、发布、撤回和归档正式通知，并保留变更记录。
          </p>
          <div class="page-actions mt-12">
            <button class="mini-btn" data-create="notice">创建校级通知</button>
            <button class="mini-btn" @click="onAdminAction('notice-permission')">检查演示权限</button>
            <button class="mini-btn" data-route="admin">查看平台管理端</button>
          </div>
        </template>

        <template v-else>
          <div class="permission-gate">
            <span class="permission-gate-icon"><AppIcon name="i-shield" /></span>
            <div>
              <strong>当前身份没有校级内容管理权限</strong>
              <p>
                校级通知属于学校正式发布内容，需要由学校指定的「内容管理员」角色操作，
                普通教师账号默认不具备该权限。
              </p>
              <p class="permission-gate-how">
                如需使用，请向教务处或平台管理员申请「校级内容管理」授权；
                授权通过后重新登录即可看到管理入口。
              </p>
            </div>
          </div>
          <div class="page-actions mt-12">
            <button class="mini-btn" @click="onAdminAction('notice-permission')">查看权限说明</button>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>
