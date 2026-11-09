<script setup>
import { computed, ref } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
import { useRouter } from 'vue-router'
import {
  teacherGroups,
  groupChannelTypes,
  pendingJoinRequests,
} from '../../data/teacher.js'
import { channelTypes, joinModes } from '../../data/dict.js'
import {
  teacherStore,
  groupState,
  updateGroup,
  toggleChannel,
  handleJoinRequest,
  addPinnedNotice,
  setGroupPostState,
} from '../../stores/teacher.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 学习小组管理（设计书 §6.2）。
 *
 * §6.2 原文的能力清单有 10 项，这里按「能不能真做」分三档落地：
 *   A 档做实 —— 有交互、有状态流转（建改归档、频道、置顶、加入申请、标记已解决）
 *   B 档做界面 —— 结构 + 文案 + 状态标签（规则维护、违规处置、共同管理者）
 *   C 档标边界 —— 明确说明哪些操作教师做不到（跨小组、他人私有内容）
 *
 * §6.2 末尾的硬约束：
 *   「教师不得通过小组管理功能读取其他小组的私密内容，
 *     也不能在未获授权的情况下访问学生的私有案例或笔记。」
 * 所以这里只列当前教师自己的小组，不提供任何跨小组入口。
 */

const router = useRouter()

/** 当前教师的小组（含运行时状态） */
const groups = computed(() => teacherGroups.map((g) => groupState(g)))

/** 当前选中的小组 */
const activeId = ref(groups.value[0]?.id || '')
const active = computed(() => groups.value.find((g) => g.id === activeId.value) || groups.value[0])

/** 是否只看进行中的 */
const onlyActive = ref(false)
const visibleGroups = computed(() =>
  onlyActive.value ? groups.value.filter((g) => g.status === 'active') : groups.value
)

/* ---------- 加入申请（§6.2「管理成员加入申请」） ---------- */
const requests = computed(() =>
  pendingJoinRequests
    .filter((r) => r.groupId === active.value?.id)
    .map((r) => ({
      ...r,
      state: teacherStore.joinRequests[r.id]?.status || r.status,
    }))
)

/* ---------- 频道结构（§5.2.3） ---------- */
const channels = computed(() =>
  groupChannelTypes.map((key) => {
    const def = channelTypes[key]
    const cur = active.value?.channels.find((c) => c.key === key)
    return {
      key,
      ...def,
      enabled: cur?.enabled ?? false,
      count: cur?.count ?? 0,
    }
  })
)

/* ---------- 小组规则维护（B 档） ---------- */
const ruleDraft = ref('')
function saveRules() {
  const text = ruleDraft.value.trim()
  if (!text) {
    showToast('规则内容不能为空。')
    return
  }
  const rules = text.split('\n').map((s) => s.trim()).filter(Boolean)
  updateGroup(active.value.id, { rules })
  ruleDraft.value = ''
  showToast(`已保存 ${rules.length} 条小组规则（演示态，仅存内存）。`)
}

/* ---------- 置顶通知（A 档） ---------- */
const noticeTitle = ref('')
function publishPinned() {
  const t = noticeTitle.value.trim()
  if (!t) {
    showToast('请先填写通知标题。')
    return
  }
  addPinnedNotice(active.value.id, { title: t, pinnedAt: new Date().toISOString().slice(0, 10) })
  noticeTitle.value = ''
  showToast('已发布置顶通知（演示态）。')
}
const pinnedList = computed(() => teacherStore.pinnedNotices[active.value?.id] || [])

/* ---------- 小组内讨论处置（B 档：§5.2.6 三档删除） ---------- */
/**
 * §5.2.6 原文：「删除内容应区分普通删除、隐藏待审核和永久删除；
 * 普通用户不应拥有绕开平台规则的永久清理能力。」
 * 所以教师只有前两档，没有永久删除。
 */
const demoPosts = [
  { id: 'GP-101', title: '串口通信偶发丢帧，有人遇到过吗？', author: '李同学', solved: false, state: 'normal' },
  { id: 'GP-102', title: '分享一个不用 delay 的稳态滤波写法', author: '王同学', solved: true, state: 'normal' },
  { id: 'GP-103', title: '（待核实）引用他人论文里的架构图', author: '周同学', solved: false, state: 'normal' },
]
const posts = computed(() =>
  demoPosts.map((p) => ({ ...p, ...(teacherStore.groupPostStates[p.id] || {}) }))
)

/* ---------- 操作 ---------- */
function onToggleChannel(key) {
  toggleChannel(active.value.id, key)
  const cur = active.value.channels.find((c) => c.key === key)
  showToast(`频道「${channelTypes[key].label}」已${cur?.enabled ? '启用' : '停用'}。`)
}

function onArchive(group) {
  const next = group.status === 'active' ? 'archived' : 'active'
  updateGroup(group.id, { status: next })
  showToast(next === 'archived' ? '小组已归档，不再接受加入申请。' : '小组已恢复为进行中。')
}

function onEditGroup(group) {
  updateGroup(group.id, { title: group.title })
  showToast('小组信息编辑为演示态：正式平台需要支持名称、简介、目标、标签、加入规则与频道结构的完整编辑。')
}

function onHandleRequest(req, approved) {
  handleJoinRequest(req.id, approved)
  showToast(approved ? `已通过 ${req.applicant} 的加入申请（演示态）。` : `已拒绝 ${req.applicant} 的加入申请。`)
}

function onPostAction(postId, state, reason) {
  setGroupPostState(postId, state, reason)
  showToast(
    state === 'hidden'
      ? '已隐藏待核实并记录原因与处理人。'
      : '已标记为已解决并突出显示。'
  )
}

function onAssignCoManager() {
  showToast(
    '共同管理员指定为演示态：正式平台需校验平台规则，并在指定后记录变更与生效时间。'
  )
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">GROUP MANAGEMENT</div>
        <h1>学习小组管理</h1>
        <p>创建、修改和归档自己创建的学习小组，维护频道结构、规则与成员申请。</p>
      </div>
      <div class="page-heading-actions">
        <button class="outline-btn" @click="router.push({ name: 'teacher' })">返回工作台</button>
        <button class="solid-btn" data-create="teacherGroup">创建教师学习小组</button>
      </div>
    </div>

    <!--
      §6.2 硬约束。跨小组、他人私有内容这类操作**不提供入口**，
      而不是提供后再报错 —— 设计书 §4.2 同一原则。
    -->
    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        小组管理权限仅作用于对应小组。你看不到也无法进入其他小组，
        包括其他小组的私密帖子、成员信息与讨论摘要；
        学生的私有案例与笔记也不在小组管理范围内。
      </div>
    </div>

    <!--
      小组列表与详情采用「上下」而非「左右」结构。
      左侧只有小组卡片（高度有限），右侧详情 + 加入申请往往更高，
      放同一行会让左栏下方出现大片空白，看起来像内容塌陷。
    -->
    <div class="page-section">
      <div class="page-section-head">
        <div>
          <h2>我创建的小组</h2>
          <p>共 {{ groups.length }} 个，含已归档。点击卡片切换下方管理对象。</p>
        </div>
        <label class="mini-check">
          <input v-model="onlyActive" type="checkbox" /> 只看进行中
        </label>
      </div>

      <div class="group-stack">
        <div
          v-for="g in visibleGroups"
          :key="g.id"
          class="group-card"
          :class="{ 'is-active': g.id === activeId }"
        >
          <button class="group-card-head" @click="activeId = g.id">
            <span class="page-list-icon"><AppIcon :name="g.icon" /></span>
            <span class="page-list-content">
              <strong>{{ g.title }}</strong>
              <p>{{ g.desc }}</p>
            </span>
            <span class="page-badge" :class="g.status === 'active' ? 'green' : 'gray'">
              {{ g.status === 'active' ? '进行中' : '已归档' }}
            </span>
          </button>

          <div class="admin-item-meta">
            <span class="admin-item-chip">成员 {{ g.members }} 人</span>
            <span class="admin-item-chip">{{ joinModes[g.joinMode]?.label }}</span>
            <span class="admin-item-chip">更新于 {{ g.updatedAt }}</span>
          </div>

          <div class="page-actions mt-12">
            <button class="mini-btn" @click="activeId = g.id">进入管理</button>
            <button class="mini-btn" @click="onEditGroup(g)">编辑信息</button>
            <button class="mini-btn" @click="onArchive(g)">
              {{ g.status === 'active' ? '归档小组' : '恢复小组' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 小组详情 -->
    <template v-if="active">
      <div class="page-section">
        <div class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>{{ active.title }}</h2>
              <p>{{ active.scope }}</p>
            </div>
            <span class="page-badge" :class="active.status === 'active' ? 'green' : 'gray'">
              {{ active.status === 'active' ? '进行中' : '已归档' }}
            </span>
          </div>

          <div class="group-goal">
            <strong>学习目标</strong>
            {{ active.goal }}
          </div>

          <div class="tag-row mt-12">
            <span v-for="t in active.tags" :key="t" class="tag">{{ t }}</span>
          </div>

          <div class="admin-item-meta">
            <span class="admin-item-chip">{{ joinModes[active.joinMode]?.label }}</span>
            <span class="admin-item-chip">成员 {{ active.members }} 人</span>
            <span class="admin-item-chip">{{ active.channels.filter((c) => c.enabled).length }} 个频道</span>
          </div>
        </div>
      </div>

      <!-- 成员加入申请 -->
      <div class="page-section">
        <div class="page-panel">
          <div class="page-section-head">
            <div>
              <h2>成员加入申请</h2>
              <p>{{ joinModes[active.joinMode]?.desc }}</p>
            </div>
          </div>
          <div v-for="r in requests" :key="r.id" class="page-list-row">
            <span class="page-list-icon"><AppIcon name="i-users" /></span>
            <div class="page-list-content">
              <strong>{{ r.applicant }}</strong>
              <p>{{ r.reason }}</p>
              <small>申请于 {{ r.appliedAt }}</small>
            </div>
            <div v-if="r.state === 'pending'" class="page-actions">
              <button class="mini-btn" @click="onHandleRequest(r, true)">通过</button>
              <button class="mini-btn" @click="onHandleRequest(r, false)">拒绝</button>
            </div>
            <span v-else class="page-badge" :class="r.state === 'approved' ? 'green' : 'gray'">
              {{ r.state === 'approved' ? '已通过' : '已拒绝' }}
            </span>
          </div>
          <div v-if="!requests.length" class="page-empty">该小组当前没有待处理的加入申请。</div>
        </div>
      </div>
    </template>

    <!-- 频道结构（§5.2.3）：6 类频道在窄栏里 2 列排会挤成一团，单独占一整行放 3 列 -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>频道结构</h2>
            <p>
              按小组需要选择，不要求全部设置。当前小组：{{ active?.title || '未选择' }}
            </p>
          </div>
          <span class="page-badge green">
            已启用 {{ channels.filter((c) => c.enabled).length }} / {{ channels.length }}
          </span>
        </div>
        <div class="channel-grid">
          <button
            v-for="c in channels"
            :key="c.key"
            class="channel-toggle"
            :class="{ on: c.enabled }"
            @click="onToggleChannel(c.key)"
          >
            <span class="icon-wrap"><AppIcon :name="c.icon" /></span>
            <span>
              <strong>{{ c.label }}</strong>
              <small>{{ c.desc }}</small>
            </span>
            <span class="channel-flag">
              <span class="page-badge" :class="c.enabled ? 'green' : 'gray'">
                {{ c.enabled ? '已启用' : '未启用' }}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>

    <div class="page-layout-two">
      <!-- 置顶通知（A 档） -->
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>置顶通知</h2>
            <p>发布小组规则、活动安排与重要通知。</p>
          </div>
        </div>

        <div class="auth-field">
          <label for="pinnedTitle">通知标题</label>
          <div class="auth-input-wrap">
            <AppIcon name="i-bellring" />
            <input id="pinnedTitle" v-model="noticeTitle" type="text" placeholder="例：本周五提交阶段报告" />
          </div>
        </div>
        <button class="solid-btn" @click="publishPinned">发布置顶通知</button>

        <div v-if="pinnedList.length" class="mt-12">
          <div v-for="n in pinnedList" :key="n.id" class="page-list-row">
            <span class="page-list-icon"><AppIcon name="i-bellring" /></span>
            <div class="page-list-content">
              <strong>{{ n.title }}</strong>
              <small>置顶于 {{ n.pinnedAt }}</small>
            </div>
            <span class="page-badge amber">置顶</span>
          </div>
        </div>
      </div>

      <!-- 小组规则维护（B 档） -->
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>小组规则</h2>
            <p>每行一条，保存后即时生效（演示态）。</p>
          </div>
        </div>
        <ul class="rule-list">
          <li v-for="(r, i) in active.rules" :key="i">{{ r }}</li>
        </ul>
        <div class="auth-field mt-12">
          <label for="ruleInput">新增规则</label>
          <div class="auth-input-wrap">
            <AppIcon name="i-file" />
            <input id="ruleInput" v-model="ruleDraft" type="text" placeholder="例：提问时贴出复现步骤" />
          </div>
        </div>
        <button class="outline-btn" @click="saveRules">保存规则</button>
      </div>
    </div>

    <!-- 讨论查看与处理（B 档：§5.2.6） -->
    <div class="page-section">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>小组讨论</h2>
            <p>
              删除内容区分普通删除、隐藏待审核和永久删除；
              教师没有绕开平台规则的永久清理能力。
            </p>
          </div>
          <button class="mini-btn" @click="onAssignCoManager">指定共同管理者</button>
        </div>

        <div v-for="p in posts" :key="p.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-message" /></span>
          <div class="page-list-content">
            <strong>{{ p.title }}</strong>
            <small>作者：{{ p.author }}</small>
            <div class="admin-item-meta">
              <span v-if="p.state === 'hidden'" class="admin-item-chip high">已隐藏待核实</span>
              <span v-if="p.solved" class="admin-item-chip green">已解决 · 最佳答案</span>
            </div>
            <p v-if="p.reason" class="mt-9">处理说明：{{ p.reason }} · {{ p.at }}</p>
          </div>
          <div class="page-actions">
            <button
              v-if="p.state !== 'hidden'"
              class="mini-btn"
              @click="onPostAction(p.id, 'hidden', '涉及争议，暂时下线等待核实')"
            >
              隐藏待核实
            </button>
            <button
              v-if="!p.solved"
              class="mini-btn"
              @click="onPostAction(p.id, 'solved', '问题已解决并标记最佳答案')"
            >
              标记已解决
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
