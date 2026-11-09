<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { adminNoticeSeeds, adminNoticeStates, adminNoticeMeta } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ④ 官方通知管理（管理员端独立实现，设计书 §7.4）。
 *
 * 与教师端「校级首页内容管理」是**两套独立实现**（用户明确选择 1B）：
 *   - 数据源不同：本页用 `data/admin.js` 的 adminNoticeSeeds，
 *     教师端用 `data/teacher.js` 的 officialNotices；
 *   - 状态存储不同：本页写 `stores/admin.js` 的 noticeStates，
 *     教师端写 `stores/teacher.js` 的 notices；
 *   - 审计口径不同：本页所有发布/撤回/归档都进管理员审计日志，
 *     教师端的操作只进通知自身的变更记录。
 *
 * 为什么要分开：管理员端管理的是全站级别的正式通知，
 * 撤回与更正的责任主体、留痕要求和申诉口径都比教师端严格。
 * 共用一套实现会让教师端操作影响管理员端记录。
 *
 * §7.4 能力清单：创建、编辑、设定有效期、发布、撤回、归档、更正、
 * 预览桌面端与移动端效果、查看变更记录。
 */

const showForm = ref(false)
const editingId = ref('')

const form = ref({
  title: '',
  body: '',
  publisher: '教务处',
  scope: 'campus',
  importance: 'normal',
  pinned: false,
  publishedAt: '',
  expireAt: '',
})

function resetForm() {
  editingId.value = ''
  form.value = {
    title: '',
    body: '',
    publisher: '教务处',
    scope: 'campus',
    importance: 'normal',
    pinned: false,
    publishedAt: '',
    expireAt: '',
  }
}

const formReady = computed(() => form.value.title.trim() && form.value.body.trim())

/* ---------- 通知列表 ---------- */
/** 静态种子 + 本次会话新建/修改的运行时状态 */
const notices = computed(() =>
  adminNoticeSeeds.map((n) => {
    const rt = adminStore.noticeStates[n.id] || {}
    return {
      ...n,
      ...rt,
      state: rt.state || n.state,
      changes: rt.changes || [],
      meta: adminNoticeMeta(rt.state || n.state),
    }
  })
)

const publishedCount = computed(() => notices.value.filter((n) => n.state === 'published').length)
const expiringCount = computed(
  () =>
    notices.value.filter(
      (n) => n.state === 'published' && n.expireAt && n.expireAt <= '2026-11-30'
    ).length
)

/* ---------- 新建 / 编辑 ---------- */
function openForm(notice) {
  if (notice) {
    editingId.value = notice.id
    form.value = {
      title: notice.title,
      body: notice.body,
      publisher: notice.publisher,
      scope: notice.scope,
      importance: notice.importance,
      pinned: notice.pinned,
      publishedAt: notice.publishedAt || '',
      expireAt: notice.expireAt || '',
    }
  } else {
    resetForm()
  }
  showForm.value = true
}

function saveDraft() {
  if (!formReady.value) {
    showToast('请先填写标题与正文。')
    return
  }
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const id = editingId.value || `NT-2026-${String(Date.now()).slice(-4)}`
  const cur = adminStore.noticeStates[id] || {}

  adminStore.noticeStates[id] = {
    ...cur,
    id,
    title: form.value.title.trim(),
    body: form.value.body.trim(),
    publisher: form.value.publisher.trim() || '教务处',
    scope: form.value.scope,
    importance: form.value.importance,
    pinned: form.value.pinned,
    publishedAt: form.value.publishedAt,
    expireAt: form.value.expireAt,
    state: cur.state === 'published' || cur.state === 'corrected' ? cur.state : 'draft',
    changes: [
      ...(cur.changes || []),
      {
        time: now,
        actor: '管理员演示账号',
        action: cur.title ? '编辑' : '创建',
        detail: cur.title ? '修改了通知内容' : '保存为草稿',
      },
    ],
  }

  showForm.value = false
  resetForm()
  showToast(cur.title ? '已保存修改。' : `已创建草稿（${id}）。`)
}

/* ---------- 发布 / 撤回 / 归档 / 更正 ---------- */
const pending = ref({ id: '', action: '' })

const actionDef = {
  publish: {
    type: 'noticePublish',
    label: '发布通知',
    hint: '可说明发布依据。发布后会在首页通知区展示。',
    danger: false,
    confirm: '确认发布',
  },
  withdraw: {
    type: 'noticeWithdraw',
    label: '撤回通知',
    hint: '请说明撤回原因，避免用户继续依据错误信息行动。',
    danger: true,
    confirm: '确认撤回（高影响）',
  },
  archive: {
    type: 'noticeArchive',
    label: '归档通知',
    hint: '归档表示历史内容保留可查但不参与推荐。',
    danger: false,
    confirm: '确认归档',
  },
  correct: {
    type: 'noticePublish',
    label: '发布更正',
    hint: '请说明更正内容，更正说明会公示给看到该通知的用户。',
    danger: true,
    confirm: '确认发布更正（高影响）',
  },
  expire: {
    type: 'noticeArchive',
    label: '标记为已过期',
    hint: '超过有效期后自动退出展示，确认归档处理方式。',
    danger: false,
    confirm: '确认标记过期',
  },
}

function ask(notice, action) {
  pending.value = { id: notice.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const notice = notices.value.find((n) => n.id === pending.value.id)
  if (!notice) return
  const action = pending.value.action
  const def = actionDef[action]
  if (!def) return

  const stateMap = {
    publish: 'published',
    withdraw: 'withdrawn',
    archive: 'archived',
    correct: 'corrected',
    expire: 'expired',
  }

  const res = applyAdminAction({
    type: def.type,
    target: notice.title,
    reason,
    caseNo: caseNo || notice.id,
    mutate: () => {
      const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
      const cur = adminStore.noticeStates[notice.id] || {}
      adminStore.noticeStates[notice.id] = {
        ...cur,
        state: stateMap[action],
        publishedAt:
          action === 'publish' && !notice.publishedAt
            ? new Date().toISOString().slice(0, 10)
            : cur.publishedAt ?? notice.publishedAt,
        corrected: action === 'correct' ? true : cur.corrected,
        changes: [
          ...(cur.changes || []),
          { time: now, actor: '管理员演示账号', action: def.label, detail: reason },
        ],
      }
      return `通知状态变更为「${adminNoticeMeta(stateMap[action]).label}」`
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}

/* ---------- 预览（§7.4「预览桌面端与移动端展示效果」） ---------- */
const previewId = ref('')
const previewMode = ref('desktop')
</script>

<template>
  <AdminShell module="notices" title="官方通知管理" desc="维护全站官方通知：创建、编辑、设定有效期、发布、撤回、归档与更正，并保留变更记录。">
    <template #actions>
      <button class="outline-btn" @click="showForm = !showForm">
        {{ showForm ? '收起表单' : '新建官方通知' }}
      </button>
    </template>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>
        已撤回或被更正的公告要显示合理状态，避免用户继续依据错误信息行动。
        撤回表示内容暂时下线；归档表示历史内容保留可查但不参与推荐 —— 两者不可混用。
      </div>
    </div>

    <div class="page-stats">
      <div class="page-stat">
        <span>通知总数</span>
        <strong>{{ notices.length }}</strong>
        <small>含草稿与历史归档</small>
      </div>
      <div class="page-stat">
        <span>正在展示</span>
        <strong>{{ publishedCount }}</strong>
        <small>已发布且未过期</small>
      </div>
      <div class="page-stat">
        <span>临近到期</span>
        <strong>{{ expiringCount }}</strong>
        <small>需确认延期或归档</small>
      </div>
    </div>

    <!-- 新建 / 编辑 -->
    <div v-if="showForm" class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>{{ editingId ? '编辑通知' : '新建官方通知' }}</h2>
            <p>未发布的内容可以随时修改；发布后的重要修改会记录更正说明。</p>
          </div>
          <button class="mini-btn" @click="showForm = false">收起</button>
        </div>

        <div class="auth-field">
          <label for="anTitle">通知标题</label>
          <div class="auth-input-wrap">
            <AppIcon name="i-bellring" />
            <input id="anTitle" v-model="form.title" type="text" placeholder="例：关于开展本学期实践项目申报的通知" />
          </div>
        </div>

        <div class="auth-field">
          <label for="anBody">正文</label>
          <div class="auth-input-wrap">
            <AppIcon name="i-file" />
            <textarea
              id="anBody"
              v-model="form.body"
              class="textarea-md"
              rows="4"
              placeholder="写清时间、对象与需要完成的事项"
            ></textarea>
          </div>
        </div>

        <div class="auth-grid">
          <div class="auth-field">
            <label for="anPublisher">发布单位</label>
            <div class="auth-input-wrap">
              <AppIcon name="i-users" />
              <input id="anPublisher" v-model="form.publisher" type="text" placeholder="例：教务处" />
            </div>
          </div>
          <div class="auth-field">
            <label for="anScope">可见范围</label>
            <div class="auth-input-wrap">
              <AppIcon name="i-eye" />
              <select id="anScope" v-model="form.scope" class="page-select select-full">
                <option value="campus">校内可见</option>
                <option value="public">公开可见</option>
                <option value="members">成员可见</option>
              </select>
            </div>
          </div>
          <div class="auth-field">
            <label for="anPublishAt">发布时间</label>
            <div class="auth-input-wrap">
              <AppIcon name="i-file" />
              <input id="anPublishAt" v-model="form.publishedAt" type="date" />
            </div>
          </div>
          <div class="auth-field">
            <label for="anExpireAt">失效时间</label>
            <div class="auth-input-wrap">
              <AppIcon name="i-file" />
              <input id="anExpireAt" v-model="form.expireAt" type="date" />
            </div>
          </div>
        </div>

        <div class="page-actions mt-12">
          <button class="mini-btn" @click="form.importance = form.importance === 'high' ? 'normal' : 'high'">
            {{ form.importance === 'high' ? '取消重要' : '标为重要' }}
          </button>
          <button class="mini-btn" @click="form.pinned = !form.pinned">
            {{ form.pinned ? '取消置顶' : '设为置顶' }}
          </button>
          <span class="admin-item-chip">重要级别：{{ form.importance === 'high' ? '重要' : '普通' }}</span>
          <span class="admin-item-chip">{{ form.pinned ? '已置顶' : '未置顶' }}</span>
        </div>

        <div class="page-actions mt-12">
          <button class="solid-btn" :disabled="!formReady" @click="saveDraft">
            {{ editingId ? '保存修改' : '保存为草稿' }}
          </button>
          <button class="outline-btn" @click="resetForm">清空</button>
        </div>
      </div>
    </div>

    <!-- 通知列表 -->
    <div class="page-section">
      <div v-for="n in notices" :key="n.id" class="notice-card">
        <div class="review-head">
          <span class="page-list-icon"><AppIcon name="i-bellring" /></span>
          <div class="page-list-content">
            <strong>{{ n.title }}</strong>
            <p>{{ n.body }}</p>
          </div>
          <span class="page-badge" :class="n.meta.tone">{{ n.meta.label }}</span>
        </div>

        <div class="notice-meta">
          <span class="admin-item-chip">{{ n.publisher }}</span>
          <span class="admin-item-chip">{{ n.scope === 'campus' ? '校内可见' : n.scope === 'public' ? '公开可见' : '成员可见' }}</span>
          <span v-if="n.publishedAt" class="admin-item-chip">发布于 {{ n.publishedAt }}</span>
          <span v-if="n.expireAt" class="admin-item-chip">失效于 {{ n.expireAt }}</span>
          <span class="admin-item-chip" :class="n.importance === 'high' ? 'high' : ''">
            {{ n.importance === 'high' ? '重要' : '普通' }}
          </span>
          <span v-if="n.pinned" class="admin-item-chip amber">置顶</span>
          <span v-if="n.corrected" class="admin-item-chip medium">已更正</span>
          <span class="admin-item-chip">编号：{{ n.id }}</span>
        </div>

        <div class="page-actions mt-12">
          <button v-if="n.state === 'draft'" class="mini-btn" @click="openForm(n)">编辑</button>
          <button v-if="n.state === 'draft'" class="mini-btn" @click="ask(n, 'publish')">发布</button>
          <button v-if="['published', 'corrected'].includes(n.state)" class="mini-btn" @click="ask(n, 'correct')">
            发布更正
          </button>
          <button v-if="['published', 'corrected'].includes(n.state)" class="mini-btn" @click="ask(n, 'withdraw')">
            撤回
          </button>
          <button v-if="['published', 'corrected', 'withdrawn'].includes(n.state)" class="mini-btn" @click="ask(n, 'archive')">
            归档
          </button>
          <button v-if="n.state === 'published' && n.expireAt" class="mini-btn" @click="ask(n, 'expire')">
            标记已过期
          </button>
          <button class="mini-btn" @click="previewId = previewId === n.id ? '' : n.id">
            {{ previewId === n.id ? '收起预览' : '预览效果' }}
          </button>
        </div>

        <!-- 变更记录 -->
        <div v-if="n.changes.length" class="notice-change-log">
          <strong>变更记录</strong>
          <div v-for="(c, i) in n.changes" :key="i" class="review-history-row">
            <strong>{{ c.time }}</strong>
            <span>{{ c.actor }} · {{ c.action }}{{ c.detail ? ' — ' + c.detail : '' }}</span>
          </div>
        </div>

        <!-- 预览桌面端与移动端展示效果 -->
        <div v-if="previewId === n.id" class="notice-preview">
          <div class="page-actions">
            <button
              class="mini-btn"
              :class="{ 'is-active': previewMode === 'desktop' }"
              @click="previewMode = 'desktop'"
            >
              桌面端
            </button>
            <button
              class="mini-btn"
              :class="{ 'is-active': previewMode === 'mobile' }"
              @click="previewMode = 'mobile'"
            >
              移动端
            </button>
          </div>
          <div class="notice-preview-frame" :class="previewMode">
            <span class="notice-preview-label">
              {{ previewMode === 'desktop' ? '首页通知区（桌面端）' : '首页通知区（移动端）' }}
            </span>
            <div class="notice-preview-body">
              <span class="tiny-status">{{ n.importance === 'high' ? '重要' : '普通' }}</span>
              <strong>{{ n.title }}</strong>
              <span class="notice-preview-meta">
                {{ n.publisher }} · {{ n.publishedAt || '未发布' }}
                <template v-if="n.expireAt"> · 有效期至 {{ n.expireAt }}</template>
              </span>
            </div>
          </div>
        </div>

        <AdminReasonForm
          :open="pending.id === n.id"
          :action="actionDef[pending.action]?.label || ''"
          :hint="actionDef[pending.action]?.hint || ''"
          :case-no="n.id"
          :danger="actionDef[pending.action]?.danger"
          :confirm-text="actionDef[pending.action]?.confirm || '确认'"
          @cancel="cancel"
          @confirm="confirm"
        />
      </div>
    </div>
  </AdminShell>
</template>
