<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../../components/AppIcon.vue'
import { authStore } from '../../stores/auth.js'
import { teacherStore, setNoticeState } from '../../stores/teacher.js'
import { officialNotices } from '../../data/teacher.js'
import { contentStates } from '../../data/dict.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 校级首页内容管理（设计书 §6.5）。
 *
 * §6.5 原文：学校内容管理员可执行
 *   新建官方通知 / 编辑未发布内容 / 设定发布和失效时间 / 设置重要级别和置顶状态 /
 *   预览桌面端与移动端展示效果 / 发布、撤回、归档或更正通知 / 查看通知变更记录。
 *
 * §4.2 末尾的硬约束：普通教师若无对应权限，**不应执行上述操作**。
 * 所以没有权限时整页只展示说明与申请入口，不出现任何可误触的按钮。
 */

const router = useRouter()

const hasContentAdmin = computed(() => authStore.role === 'admin' || authStore.contentAdmin)

/* ---------- 通知列表 ---------- */
/**
 * 通知列表 = 静态演示数据 + 本次会话新建的通知。
 * 新建的通知存在 teacherStore.notices 里，必须一起并进来，
 * 否则保存后列表数量不变，用户会以为没保存成功。
 */
const notices = computed(() => {
  const runtime = teacherStore.notices || {}
  const merged = officialNotices.map((n) => ({ ...n, ...(runtime[n.id] || {}) }))
  /* 新建的（id 不在静态列表里的）追加在后面 */
  const staticIds = new Set(officialNotices.map((n) => n.id))
  const created = Object.values(runtime).filter((n) => !staticIds.has(n.id))
  return [...merged, ...created].map((n) => ({
    ...n,
    stateMeta: contentStates[n.state] || contentStates.draft,
    changes: n.changes || [],
  }))
})

/* ---------- 新建 / 编辑 ---------- */
const showForm = ref(false)
const editingId = ref('')
const form = ref({
  title: '',
  body: '',
  publisherUnit: '教务处',
  publishedAt: '',
  expireAt: '',
  importance: 'normal',
  pinned: false,
  scope: 'campus',
})

function resetForm() {
  editingId.value = ''
  form.value = {
    title: '',
    body: '',
    publisherUnit: '教务处',
    publishedAt: '',
    expireAt: '',
    importance: 'normal',
    pinned: false,
    scope: 'campus',
  }
}

function openForm(notice) {
  if (notice) {
    editingId.value = notice.id
    form.value = {
      title: notice.title,
      body: notice.body,
      publisherUnit: notice.publisherUnit,
      publishedAt: notice.publishedAt || '',
      expireAt: notice.expireAt || '',
      importance: notice.importance,
      pinned: notice.pinned,
      scope: notice.scope,
    }
  } else {
    resetForm()
  }
  showForm.value = true
}

const formReady = computed(() => form.value.title.trim() && form.value.body.trim())

function saveDraft() {
  if (!formReady.value) {
    showToast('请先填写标题与正文。')
    return
  }
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  if (editingId.value) {
    const cur = teacherStore.notices[editingId.value] || {}
    setNoticeState(editingId.value, {
      ...form.value,
      state: cur.state === 'published' ? 'published' : 'draft',
      changes: [
        ...(cur.changes || []),
        { time: now, actor: authStore.displayName, action: '编辑', detail: '修改了通知内容' },
      ],
    })
    showToast('已保存修改。已发布通知的重要修改会记录修改内容与原因。')
  } else {
    /* id 用时间戳保证唯一：连续新建不会与静态数据或上一条冲突 */
    const id = `NT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    setNoticeState(id, {
      ...form.value,
      id,
      publisher: `${form.value.publisherUnit}`,
      state: 'draft',
      changes: [{ time: now, actor: authStore.displayName, action: '创建', detail: '保存为草稿' }],
    })
    showToast(`已创建草稿（${id}）。未发布内容可以继续编辑。`)
  }
  resetForm()
  showForm.value = false
}

/* ---------- 发布 / 撤回 / 归档 / 更正 ---------- */
function onPublish(notice) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  setNoticeState(notice.id, {
    state: 'published',
    publishedAt: notice.publishedAt || new Date().toISOString().slice(0, 10),
    changes: [
      ...(notice.changes || []),
      { time: now, actor: authStore.displayName, action: '发布', detail: '正式发布' },
    ],
  })
  showToast('通知已发布。')
}

function onWithdraw(notice) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  setNoticeState(notice.id, {
    state: 'withdrawn',
    changes: [
      ...(notice.changes || []),
      { time: now, actor: authStore.displayName, action: '撤回', detail: '手动撤回' },
    ],
  })
  showToast('通知已撤回。')
}

function onArchive(notice) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  setNoticeState(notice.id, {
    state: 'archived',
    changes: [
      ...(notice.changes || []),
      { time: now, actor: authStore.displayName, action: '归档', detail: '归档保存' },
    ],
  })
  showToast('通知已归档，保留可查但不参与推荐。')
}

function onCorrect(notice) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
  setNoticeState(notice.id, {
    state: 'published',
    corrected: true,
    changes: [
      ...(notice.changes || []),
      { time: now, actor: authStore.displayName, action: '更正', detail: '已发布通知的重要修改' },
    ],
  })
  showToast('已记录更正说明。')
}

/* ---------- 预览（§6.5「预览桌面端与移动端展示效果」） ---------- */
const previewId = ref('')
const previewNotice = computed(() => notices.value.find((n) => n.id === previewId.value))
const previewMode = ref('desktop')
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">OFFICIAL NOTICE</div>
        <h1>校级首页内容管理</h1>
        <p>创建、编辑、设定有效期、发布、撤回和归档正式通知，并保留变更记录。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" @click="router.push({ name: 'teacher' })">返回工作台</button>
        <button v-if="hasContentAdmin" class="solid-btn" @click="openForm(null)">新建官方通知</button>
      </div>
    </div>

    <!-- §4.2：无权限时不展示任何可误触的虚假操作按钮 -->
    <div v-if="!hasContentAdmin" class="page-section">
      <div class="page-panel">
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
      </div>
    </div>

    <template v-else>
      <div class="page-callout">
        <AppIcon name="i-info" />
        <div>
          对已发布的正式通知进行重要修改时，会记录修改内容与原因，
          必要时显示更正说明。撤回与归档的区别是：撤回表示内容暂时下线，
          归档表示历史内容保留可查但不参与推荐。
        </div>
      </div>

      <!-- 新建 / 编辑 -->
      <div v-if="showForm" class="page-section">
        <div class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>{{ editingId ? '编辑通知' : '新建官方通知' }}</h2>
              <p>未发布的内容可以随时修改，发布后重要修改会记录更正说明。</p>
            </div>
            <button class="mini-btn" @click="showForm = false">收起</button>
          </div>

          <div class="auth-field field-mid">
            <label for="noticeTitle">通知标题</label>
            <div class="auth-input-wrap">
              <AppIcon name="i-bellring" />
              <input id="noticeTitle" v-model="form.title" type="text" placeholder="例：关于开展本学期实践项目申报的通知" />
            </div>
          </div>

          <div class="auth-field">
            <label for="noticeBody">正文</label>
            <div class="auth-input-wrap">
              <AppIcon name="i-file" />
              <textarea
                id="noticeBody"
                v-model="form.body"
                class="textarea-md"
                rows="4"
                placeholder="写清时间、对象与需要完成的事项"
              ></textarea>
            </div>
          </div>

          <div class="auth-grid">
            <div class="auth-field">
              <label for="noticeUnit">发布单位</label>
              <div class="auth-input-wrap">
                <AppIcon name="i-users" />
                <input id="noticeUnit" v-model="form.publisherUnit" type="text" placeholder="例：教务处" />
              </div>
            </div>
            <div class="auth-field">
              <label for="noticeScope">可见范围</label>
              <div class="auth-input-wrap">
                <AppIcon name="i-eye" />
                <select id="noticeScope" v-model="form.scope" class="page-select select-full">
                  <option value="campus">校内可见</option>
                  <option value="public">公开可见</option>
                  <option value="members">成员可见</option>
                </select>
              </div>
            </div>
            <div class="auth-field">
              <label for="noticePublishAt">发布时间</label>
              <div class="auth-input-wrap">
                <AppIcon name="i-file" />
                <input id="noticePublishAt" v-model="form.publishedAt" type="date" />
              </div>
            </div>
            <div class="auth-field">
              <label for="noticeExpireAt">失效时间</label>
              <div class="auth-input-wrap">
                <AppIcon name="i-file" />
                <input id="noticeExpireAt" v-model="form.expireAt" type="date" />
              </div>
            </div>
          </div>

          <div class="page-actions mt-12">
            <span class="admin-item-chip">重要级别：{{ form.importance === 'high' ? '重要' : '普通' }}</span>
            <span class="admin-item-chip">{{ form.pinned ? '已置顶' : '未置顶' }}</span>
          </div>
          <div class="page-actions mt-9">
            <button class="mini-btn" @click="form.importance = form.importance === 'high' ? 'normal' : 'high'">
              {{ form.importance === 'high' ? '取消重要' : '标为重要' }}
            </button>
            <button class="mini-btn" @click="form.pinned = !form.pinned">
              {{ form.pinned ? '取消置顶' : '设为置顶' }}
            </button>
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
        <div class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>通知列表</h2>
              <p>共 {{ notices.length }} 条。</p>
            </div>
          </div>

          <div v-for="n in notices" :key="n.id" class="notice-card">
            <div class="review-head">
              <span class="page-list-icon"><AppIcon name="i-bellring" /></span>
              <div class="page-list-content">
                <strong>{{ n.title }}</strong>
                <p>{{ n.body }}</p>
              </div>
              <span class="page-badge" :class="n.stateMeta.tone">{{ n.stateMeta.label }}</span>
            </div>

            <div class="notice-meta">
              <span class="admin-item-chip">{{ n.publisher }}</span>
              <span class="admin-item-chip">{{ n.scope }}</span>
              <span v-if="n.publishedAt" class="admin-item-chip">发布于 {{ n.publishedAt }}</span>
              <span v-if="n.expireAt" class="admin-item-chip">失效于 {{ n.expireAt }}</span>
              <span class="admin-item-chip" :class="n.importance === 'high' ? 'high' : ''">
                {{ n.importanceLabel || (n.importance === 'high' ? '重要' : '普通') }}
              </span>
              <span v-if="n.pinned" class="admin-item-chip amber">置顶</span>
              <span v-if="n.corrected" class="admin-item-chip medium">已更正</span>
            </div>

            <div class="page-actions mt-9">
              <button v-if="n.state === 'draft'" class="mini-btn" @click="openForm(n)">编辑</button>
              <button v-if="n.state === 'draft'" class="mini-btn" @click="onPublish(n)">发布</button>
              <button v-if="n.state === 'published'" class="mini-btn" @click="onCorrect(n)">发布更正</button>
              <button v-if="n.state === 'published'" class="mini-btn" @click="onWithdraw(n)">撤回</button>
              <button v-if="['published', 'withdrawn'].includes(n.state)" class="mini-btn" @click="onArchive(n)">归档</button>
              <button class="mini-btn" @click="previewId = previewId === n.id ? '' : n.id">
                {{ previewId === n.id ? '收起预览' : '预览效果' }}
              </button>
            </div>

            <!-- §6.5「查看通知变更记录」 -->
            <div class="notice-change-log">
              <strong>变更记录</strong>
              <div v-for="(c, i) in n.changes" :key="i" class="review-history-row">
                <strong>{{ c.time }}</strong>
                <span>{{ c.actor }} · {{ c.action }}{{ c.detail ? ' — ' + c.detail : '' }}</span>
              </div>
            </div>

            <!-- §6.5「预览桌面端与移动端展示效果」 -->
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
                  <span class="tiny-status">{{ n.importanceLabel || '普通' }}</span>
                  <strong>{{ n.title }}</strong>
                  <span class="notice-preview-meta">
                    {{ n.publisher }} · {{ n.publishedAt || '未发布' }}
                    <template v-if="n.expireAt"> · 有效期至 {{ n.expireAt }}</template>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>
