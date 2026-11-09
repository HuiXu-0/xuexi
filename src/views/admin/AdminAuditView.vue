<script setup>
import { computed, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import { adminStore } from '../../stores/admin.js'
import { auditRecords as seedRecords, auditTypes } from '../../data/admin.js'

/**
 * ⑧ 操作审计记录（设计书 §7.8）。
 *
 * §7.8 原文：记录操作者、时间、操作对象、操作类型、原因、处理结果，
 *   以及必要的关联案件编号。
 *   普通用户不应看到内部敏感审计信息，
 *   但应能查看与自己有关的处理决定和理由。
 *
 * 数据来源有两处：
 *   1. `data/admin.js` 的静态示例记录（演示基线）；
 *   2. `stores/admin.js` 里本次会话通过 applyAdminAction 产生的记录。
 * 后者排在最前 —— 用户刚执行的操作要能立刻看到。
 */

const typeFilter = ref('all')
const keyword = ref('')

/** 审计类型的中文名（新增的类型在 admin.js 的 auditTypes 里补） */
const typeLabel = computed(() => ({
  ...auditTypes,
  feedback: '反馈处理',
  work: '事项处置',
  config: '平台配置',
}))

const records = computed(() => {
  const live = adminStore.auditRecords
  const all = [...live, ...seedRecords]
  return all.filter((r) => {
    const okType = typeFilter.value === 'all' || r.type === typeFilter.value
    const kw = keyword.value.trim()
    const okKw =
      !kw ||
      r.target.includes(kw) ||
      r.action.includes(kw) ||
      r.reason.includes(kw) ||
      r.operator.includes(kw) ||
      (r.caseNo || '').includes(kw)
    return okType && okKw
  })
})

/** 出现过的类型（静态 + 本次会话） */
const types = computed(() => {
  const keys = new Set([
    ...Object.keys(auditTypes),
    'feedback',
    'work',
    'config',
    ...adminStore.auditRecords.map((r) => r.type),
  ])
  return [...keys]
})

const stats = computed(() => [
  { label: '审计记录总数', value: records.value.length, note: '含演示基线与本次会话' },
  {
    label: '本次会话新增',
    value: adminStore.auditRecords.length,
    note: '通过统一动作层写入',
  },
  {
    label: '涉及案件编号',
    value: records.value.filter((r) => r.caseNo).length,
    note: '可回溯到具体事项',
  },
])
</script>

<template>
  <AdminShell module="audit" title="操作审计记录" desc="记录角色变化、内容删除恢复、封禁解封、规则更新等操作的操作者、时间、对象、原因与结果。">
    <div class="page-callout">
      <AppIcon name="i-file" />
      <div>
        记录操作者、时间、操作对象、操作类型、原因、处理结果及必要的关联案件编号。
        普通用户不应看到内部敏感审计信息，但应能查看与自己有关的处理决定和理由。
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
        <button class="page-filter-btn" :class="{ active: typeFilter === 'all' }" @click="typeFilter = 'all'">
          全部类型
        </button>
        <button
          v-for="t in types"
          :key="t"
          class="page-filter-btn"
          :class="{ active: typeFilter === t }"
          @click="typeFilter = t"
        >
          {{ typeLabel[t] || t }}
        </button>
      </div>
      <div class="page-toolbar-right">
        <input
          v-model="keyword"
          class="page-input"
          type="search"
          placeholder="搜索对象、原因、操作者或案件编号"
        />
      </div>
    </div>

    <div v-for="r in records" :key="r.id" class="page-list-row">
      <span class="page-list-icon"><AppIcon name="i-file" /></span>
      <div class="page-list-content">
        <strong>{{ r.action }} · {{ r.target }}</strong>
        <p>原因：{{ r.reason }}</p>
        <small>结果：{{ r.result }}</small>
        <div class="admin-item-meta">
          <span class="admin-item-chip">编号：{{ r.id }}</span>
          <span class="admin-item-chip">类型：{{ typeLabel[r.type] || r.type }}</span>
          <span class="admin-item-chip">操作者：{{ r.operator }}</span>
          <span class="admin-item-chip">时间：{{ r.at }}</span>
          <span v-if="r.caseNo" class="admin-item-chip amber">关联案件：{{ r.caseNo }}</span>
          <span v-if="r.isNew" class="admin-item-chip green">本次会话</span>
        </div>
      </div>
    </div>

    <div v-if="!records.length" class="page-empty">当前筛选条件下没有审计记录。</div>
  </AdminShell>
</template>
