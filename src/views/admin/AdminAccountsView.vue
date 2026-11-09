<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { accountSeeds, accountStates, punishmentLevels } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ② 账号与权限管理（设计书 §7.2）。
 *
 * §7.2 原文要点：
 *   - 管理员可以分配或撤销角色权限、限制功能、封禁与解封账号；
 *   - 处罚应按情节分级，不应仅因一次低风险问题就永久封禁；
 *   - 涉及角色变化与封禁解封的操作都要留痕；
 *   - 封禁与限制要支持申诉。
 *
 * 所有改动都走统一动作层 —— 高影响操作（分配角色 / 限制 / 封禁 / 解封）
 * 必须先填理由，未填会被动作层直接拒绝。
 */

const roleFilter = ref('all')
const statusFilter = ref('all')

const accounts = computed(() =>
  accountSeeds.map((a) => {
    const rt = adminStore.accounts[a.id] || {}
    const status = rt.status || a.status
    return {
      ...a,
      status,
      scope: rt.scope || a.scope,
      violations: rt.violations ?? a.violations,
      appealNote: rt.appealNote || '',
      appealResult: rt.appealResult || '',
    }
  })
)

const filtered = computed(() =>
  accounts.value.filter((a) => {
    const okRole = roleFilter.value === 'all' || a.role === roleFilter.value
    const okStatus = statusFilter.value === 'all' || a.status === statusFilter.value
    return okRole && okStatus
  })
)

const stats = computed(() => [
  { label: '账号总数', value: accounts.value.length, note: '含学生 / 教师 / 管理员' },
  { label: '受限中', value: accounts.value.filter((a) => a.status === 'restricted').length, note: '部分功能受限' },
  { label: '申诉待受理', value: accounts.value.filter((a) => a.status === 'appealing').length, note: '需给出复核结论' },
])

/* ---------- 操作 ---------- */
const pending = ref({ id: '', action: '' })

const actionMeta = {
  assign: { label: '分配角色权限', hint: '请说明授予该权限的依据（课程、职责或授权文件）。', danger: false },
  revoke: { label: '撤销角色权限', hint: '请说明撤销原因与生效范围。', danger: true },
  restrict: { label: '限制发布功能', hint: '请说明限制原因与期限。', danger: true },
  release: { label: '解除限制', hint: '可说明解除依据。', danger: false },
  ban: { label: '暂时封禁账号', hint: '请说明封禁依据。单次低风险问题不应直接封禁。', danger: true },
  unban: { label: '解封账号', hint: '请说明解封依据，以及是否恢复原有权限范围。', danger: false },
  appeal: { label: '受理封禁申诉', hint: '请说明复核结论与后续处置。', danger: false },
}

function ask(acc, action) {
  pending.value = { id: acc.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const acc = accounts.value.find((a) => a.id === pending.value.id)
  if (!acc) return
  const action = pending.value.action

  const map = {
    assign: { type: 'assign', status: 'normal' },
    revoke: { type: 'revoke', status: 'restricted' },
    restrict: { type: 'restrict', status: 'restricted' },
    release: { type: 'release', status: 'normal' },
    ban: { type: 'ban', status: 'banned' },
    unban: { type: 'unban', status: 'normal' },
    appeal: { type: 'appeal', status: 'normal' },
  }
  const cfg = map[action]
  if (!cfg) return

  const res = applyAdminAction({
    type: cfg.type,
    target: `${acc.name}（${acc.id}）`,
    reason,
    caseNo: caseNo || acc.id,
    mutate: () => {
      const cur = adminStore.accounts[acc.id] || {}
      adminStore.accounts[acc.id] = {
        ...cur,
        status: cfg.status,
        scope: cfg.status === 'normal' ? '仅本人内容' : cur.scope || acc.scope,
        violations: cur.violations ?? acc.violations,
        appealNote: action === 'appeal' ? reason : cur.appealNote,
        appealResult: action === 'appeal' ? '申诉已受理，处罚已复核调整' : cur.appealResult,
      }
      return `账号状态变更为「${accountStates[cfg.status]?.label}」`
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}
</script>

<template>
  <AdminShell module="accounts" title="账号与权限管理" desc="查看账号基础信息与授权范围，分配或撤销角色权限，限制功能、封禁与解封，并处理申诉。">
    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        处罚应按情节分级，不应仅因一次低风险内容问题就自动实施永久封禁。
        封禁与限制支持申诉；涉及角色变化与封禁解封的操作都会写入操作审计记录。
      </div>
    </div>

    <div class="page-stats">
      <div v-for="s in stats" :key="s.label" class="page-stat">
        <span>{{ s.label }}</span>
        <strong>{{ s.value }}</strong>
        <small>{{ s.note }}</small>
      </div>
    </div>

    <div class="page-toolbar mt-18">
      <div class="page-toolbar-left">
        <button class="page-filter-btn" :class="{ active: roleFilter === 'all' }" @click="roleFilter = 'all'">
          全部角色
        </button>
        <button
          v-for="r in ['学生', '教师']"
          :key="r"
          class="page-filter-btn"
          :class="{ active: roleFilter === r }"
          @click="roleFilter = r"
        >
          {{ r }}
        </button>
      </div>
      <div class="page-toolbar-right">
        <select v-model="statusFilter" class="page-select" aria-label="按状态筛选">
          <option value="all">全部状态</option>
          <option v-for="(m, k) in accountStates" :key="k" :value="k">{{ m.label }}</option>
        </select>
      </div>
    </div>

    <div v-for="a in filtered" :key="a.id" class="page-list-row">
      <span class="page-list-icon"><AppIcon name="i-users" /></span>
      <div class="page-list-content">
        <strong>{{ a.name }}</strong>
        <p>角色：{{ a.role }} · 授权范围：{{ a.scope }}</p>
        <div class="admin-item-meta">
          <span class="admin-item-chip">账号编号：{{ a.id }}</span>
          <span class="admin-item-chip" :class="accountStates[a.status]?.tone">
            状态：{{ accountStates[a.status]?.label }}
          </span>
          <span class="admin-item-chip">违规记录：{{ a.violations }} 条</span>
          <span class="admin-item-chip">注册于 {{ a.registeredAt }}</span>
        </div>
        <p v-if="a.appealNote" class="auth-case-note">
          申诉处理说明：{{ a.appealNote }} → {{ a.appealResult }}
        </p>

        <div class="page-actions mt-12">
          <button class="mini-btn" @click="ask(a, 'assign')">分配角色权限</button>
          <button class="mini-btn" @click="ask(a, 'revoke')">撤销角色权限</button>
          <button
            v-if="a.status !== 'restricted'"
            class="mini-btn"
            @click="ask(a, 'restrict')"
          >
            限制功能
          </button>
          <button
            v-if="a.status === 'restricted'"
            class="mini-btn"
            @click="ask(a, 'release')"
          >
            解除限制
          </button>
          <button v-if="a.status !== 'banned'" class="mini-btn" @click="ask(a, 'ban')">暂时封禁</button>
          <button v-if="a.status === 'banned'" class="mini-btn" @click="ask(a, 'unban')">解封</button>
          <button
            v-if="a.status === 'appealing'"
            class="mini-btn is-danger"
            @click="ask(a, 'appeal')"
          >
            受理申诉
          </button>
        </div>

        <AdminReasonForm
          :open="pending.id === a.id"
          :action="actionMeta[pending.action]?.label || ''"
          :hint="actionMeta[pending.action]?.hint || ''"
          :case-no="a.id"
          :danger="actionMeta[pending.action]?.danger"
          :confirm-text="actionMeta[pending.action]?.danger ? '确认执行（高影响）' : '确认执行'"
          @cancel="cancel"
          @confirm="confirm"
        />
      </div>
    </div>

    <div v-if="!filtered.length" class="page-empty">当前筛选条件下没有账号。</div>

    <div class="page-section-head mt-18">
      <div>
        <h3>处罚层级</h3>
        <p>按情节采用，不应仅因一次低风险内容问题就自动实施永久封禁。</p>
      </div>
    </div>
    <div class="punish-grid">
      <div v-for="p in punishmentLevels" :key="p.key" class="punish-item">
        <strong>{{ p.label }}</strong>
        <small>{{ p.desc }}</small>
      </div>
    </div>
  </AdminShell>
</template>
