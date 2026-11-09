<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { adminStore, applyAdminAction } from '../../stores/admin.js'
import { adminWorkItems, severityLevels } from '../../data/admin.js'
import { showToast } from '../../composables/useToast.js'

/**
 * ① 管理工作台（设计书 §7.1）。
 *
 * §7.1 原文：事项应显示类型、严重程度、提交时间、当前负责人和处理状态。
 * §7.2.2：高影响操作需要确认、说明理由并留痕。
 *
 * 这里的状态流转全部落到 stores/admin.js 的统一动作层，
 * 每完成一项都会写入审计记录，审计页可以直接看到。
 */

const severityFilter = ref('all')
const ownerFilter = ref('all')

/** 事项运行时状态合并静态数据 */
const items = computed(() =>
  adminWorkItems.map((i) => {
    const rt = adminStore.workItems[i.id] || {}
    return {
      ...i,
      status: rt.status || 'pending',
      owner: rt.owner || i.owner,
      resolved: rt.status === 'done',
      note: rt.note || '',
    }
  })
)

const filtered = computed(() =>
  items.value.filter((i) => {
    const okSeverity = severityFilter.value === 'all' || i.severity === severityFilter.value
    const okOwner = ownerFilter.value === 'all' || i.owner === ownerFilter.value
    return okSeverity && okOwner
  })
)

const stats = computed(() => [
  { label: '待处理事项', value: items.value.filter((i) => !i.resolved).length, note: '含举报、审核异常与反馈' },
  { label: '高严重程度', value: items.value.filter((i) => i.severity === 'high' && !i.resolved).length, note: '需优先处理' },
  { label: '待分配负责人', value: items.value.filter((i) => i.owner === '待分配').length, note: '演示队列' },
])

const statusMeta = {
  pending: { label: '待处理', tone: 'amber' },
  reviewing: { label: '处理中', tone: 'blue' },
  done: { label: '已处理', tone: 'green' },
}

/* ---------- 操作 ---------- */
/** 正在展开理由面板的事项 id + 动作 */
const pending = ref({ id: '', action: '' })

function ask(item, action) {
  pending.value = { id: item.id, action }
}

function cancel() {
  pending.value = { id: '', action: '' }
}

function confirm({ reason, caseNo }) {
  const item = items.value.find((i) => i.id === pending.value.id)
  if (!item) return
  const action = pending.value.action

  const res = applyAdminAction({
    type: action === 'resolve' ? 'workResolve' : 'workReview',
    target: item.title,
    reason,
    caseNo: caseNo || item.id,
    mutate: () => {
      adminStore.workItems[item.id] = {
        status: action === 'resolve' ? 'done' : 'reviewing',
        owner: item.owner,
        note: reason,
      }
      return action === 'resolve' ? '已处理并归档队列' : '已标记为处理中，等待结论'
    },
  })

  cancel()
  showToast(res.ok ? res.message : res.message)
}

/** 直接分配负责人（普通操作，不强制填理由） */
function assign(item, owner) {
  const res = applyAdminAction({
    type: 'workAssign',
    target: item.title,
    reason: `分配给 ${owner}`,
    caseNo: item.id,
    mutate: () => {
      const cur = adminStore.workItems[item.id] || {}
      adminStore.workItems[item.id] = {
        ...cur,
        status: cur.status || 'pending',
        owner,
      }
      return `负责人已变更为 ${owner}`
    },
  })
  showToast(res.message)
}
</script>

<template>
  <AdminShell module="dashboard" title="管理员控制台" desc="处理账号权限、内容举报、作品授权争议、用户反馈和平台规则，并保留关键操作记录。">
    <template #actions>
      <span class="page-badge amber">本地演示，不执行真实管理动作</span>
    </template>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>
        这是管理端产品原型，不会真正封禁账号或修改平台配置。
        正式平台应遵循最小权限原则，高影响操作需要确认、记录原因，并在适用情况下支持申诉。
        本页所有处置都会写入操作审计记录。
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
        <button
          class="page-filter-btn"
          :class="{ active: severityFilter === 'all' }"
          @click="severityFilter = 'all'"
        >
          全部严重程度
        </button>
        <button
          v-for="(s, key) in severityLevels"
          :key="key"
          class="page-filter-btn"
          :class="{ active: severityFilter === key }"
          @click="severityFilter = key"
        >
          {{ s.label }}
        </button>
      </div>
      <div class="page-toolbar-right">
        <select v-model="ownerFilter" class="page-select" aria-label="按负责人筛选">
          <option value="all">全部负责人</option>
          <option value="待分配">待分配</option>
          <option value="管理员演示账号">管理员演示账号</option>
          <option value="资源维护组">资源维护组</option>
          <option value="内容管理员">内容管理员</option>
        </select>
      </div>
    </div>

    <div v-for="i in filtered" :key="i.id" class="page-list-row admin-task">
      <span class="page-list-icon"><AppIcon name="i-bellring" /></span>
      <div class="page-list-content">
        <strong>{{ i.title }}</strong>
        <p>{{ i.desc }}</p>
        <div class="admin-item-meta">
          <span class="admin-item-chip">类型：{{ i.type }}</span>
          <span class="admin-item-chip" :class="severityLevels[i.severity]?.tone">
            严重程度：{{ severityLevels[i.severity]?.label }}
          </span>
          <span class="admin-item-chip">提交时间：{{ i.submittedAt }}</span>
          <span class="admin-item-chip">负责人：{{ i.owner }}</span>
          <span v-if="i.note" class="admin-item-chip amber">处理说明：{{ i.note }}</span>
        </div>
        <div v-if="!i.resolved" class="page-actions mt-12">
          <button class="mini-btn" @click="ask(i, 'review')">标记正在核实</button>
          <button class="mini-btn" @click="ask(i, 'resolve')">处理完成</button>
          <button
            v-if="i.owner === '待分配'"
            class="mini-btn"
            @click="assign(i, '管理员演示账号')"
          >
            分配给我
          </button>
        </div>
      </div>
      <span class="page-badge" :class="statusMeta[i.status]?.tone">{{ statusMeta[i.status]?.label }}</span>

      <AdminReasonForm
        :open="pending.id === i.id"
        :action="pending.action === 'resolve' ? '处理完成' : '标记正在核实'"
        :hint="pending.action === 'resolve' ? '请说明处理结论与依据，提交者会看到这段说明。' : '请说明核实方向与需要确认的材料。'"
        :case-no="i.id"
        :confirm-text="pending.action === 'resolve' ? '确认处理完成' : '确认开始核实'"
        @cancel="cancel"
        @confirm="confirm"
      />
    </div>

    <div v-if="!filtered.length" class="page-empty">当前筛选条件下没有待处理事项。</div>
  </AdminShell>
</template>
