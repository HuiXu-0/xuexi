<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import AgentSlot from '../components/AgentSlot.vue'
import { agentDefinitions, adminTasks } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'
import {
  adminModules,
  adminWorkItems,
  workItemStates,
  severityLevels,
  punishmentLevels,
  auditRecords,
  auditTypes,
} from '../data/admin.js'

/**
 * 管理员控制台。
 *
 * 设计书 §4.3 定义了 9 个模块，§7.1–7.8 给出各自职责。
 * 这里把 9 个模块都做出来：工作台、账号权限、内容举报、官方通知、
 * 反馈建议、审核规则、Agent 管理、操作审计、基础配置。
 */

/** 当前打开的模块 */
const activeModule = ref('dashboard')

const currentModule = computed(
  () => adminModules.find((m) => m.key === activeModule.value) || adminModules[0]
)

/* ---------- ① 工作台 ---------- */
const severityFilter = ref('all')
const ownerFilter = ref('all')

const filteredItems = computed(() =>
  adminWorkItems.filter((i) => {
    const okSeverity = severityFilter.value === 'all' || i.severity === severityFilter.value
    const okOwner = ownerFilter.value === 'all' || i.owner === ownerFilter.value
    return okSeverity && okOwner
  })
)

const itemStates = computed(() =>
  adminWorkItems.map((i) => ({
    ...i,
    status: demoStore.adminTaskStatus[i.id] || { label: '待处理', class: 'amber' },
    resolved: !!demoStore.adminTaskStatus[i.id]?.resolved,
  }))
)

function onItemAction(action, id) {
  if (action === 'review') {
    demoStore.adminTaskStatus[id] = { label: '核实中', class: 'blue', resolved: false }
  } else if (action === 'resolve') {
    demoStore.adminTaskStatus[id] = { label: '已处理', class: 'green', resolved: true }
    if (demoStore.adminReportsCount > 0) demoStore.adminReportsCount -= 1
  }
  showToast(
    {
      review: '已将事项标记为核实中；高影响操作仍需人工确认并记录理由。',
      resolve: '已将事项标记为已处理；处理理由与操作记录会写入审计日志。',
    }[action] || '该管理操作目前只提供原型交互。'
  )
}

/* ---------- ② 账号与权限 ---------- */
const accountRows = computed(() => [
  { id: 'ACC-001', name: '学生演示账号', role: '学生', scope: '仅本人内容', status: '正常', violations: 0, tone: 'green' },
  { id: 'ACC-002', name: '教师演示账号', role: '教师', scope: '本人小组 + 被分配审核事项', status: '正常', violations: 1, tone: 'green' },
  { id: 'ACC-003', name: '受限账号演示', role: '学生', scope: '禁止发布（限制发布）', status: '限制中', violations: 2, tone: 'amber' },
  { id: 'ACC-004', name: '封禁账号演示', role: '学生', scope: '无法登录', status: '已封禁', violations: 3, tone: 'red' },
])

function onAccountAction(action, id) {
  showToast(
    {
      roles: '角色与授权范围调整会记录操作者、时间、对象与原因（审计留痕）。',
      restrict: '已演示限制功能操作。高影响处罚需明确确认并支持申诉。',
      ban: '已演示封禁操作。不应仅因一次低风险问题就永久封禁。',
      unban: '已演示解封操作，解封理由同样进入审计记录。',
    }[action] || '该账号操作目前只提供原型交互。'
  )
}

/* ---------- ⑥ 审核规则 ---------- */
const ruleRows = ref([
  { id: 'R-01', name: '垃圾广告与刷屏', type: '确定性规则', scope: '笔记 / 帖子 / 资源简介', hits: 42, falsePositives: 3, state: '启用' },
  { id: 'R-02', name: '辱骂与人身攻击', type: '需上下文判断', scope: '全部文字字段', hits: 18, falsePositives: 7, state: '启用' },
  { id: 'R-03', name: '恶意链接与诈骗诱导', type: '确定性规则', scope: '帖子 / 资源链接', hits: 11, falsePositives: 1, state: '启用' },
  { id: 'R-04', name: '隐私信息泄露', type: '需上下文判断', scope: '头像名称 / 个人简介', hits: 5, falsePositives: 2, state: '启用' },
  { id: 'R-05', name: '侵权与未经授权转载', type: '需人工核实', scope: '优秀案例 / 附件', hits: 3, falsePositives: 0, state: '草稿' },
])

/* ---------- ⑨ 平台基础配置 ---------- */
const configRows = ref([
  { id: 'C-01', name: '编程基础', kind: '资源类别', state: '启用', note: '含 Python / JavaScript 等子方向' },
  { id: 'C-02', name: '嵌入式与硬件', kind: '资源类别', state: '启用', note: 'ESP32 / 单片机 / EDA 等' },
  { id: 'C-03', name: '入门', kind: '学习阶段标签', state: '启用', note: '与「零基础」合并中' },
  { id: 'C-04', name: '零基础', kind: '学习阶段标签', state: '待合并', note: '将迁移到「入门」' },
  { id: 'C-05', name: '学科竞赛', kind: '竞赛类型', state: '启用', note: '与「个人赛」为不同维度' },
])

function onAgentToggle(key) {
  demoStore.agentState[key] = !demoStore.agentState[key]
  showToast('已切换本地演示开关；不影响真实模型或审核行为。')
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">PLATFORM OPERATIONS</div>
        <h1>管理员控制台</h1>
        <p>处理账号权限、内容举报、作品授权争议、用户反馈和平台规则，并保留关键操作记录。</p>
      </div>
      <div class="page-heading-actions">
        <span class="page-badge amber">本地演示，不执行真实管理动作</span>
      </div>
    </div>

    <div class="page-callout">
      <AppIcon name="i-shield" />
      <div>这是管理端产品原型，不会真正封禁账号或修改平台配置。正式平台应遵循最小权限原则，高影响操作需要确认、记录原因，并在适用情况下支持申诉。</div>
    </div>

    <!-- 9 个模块的切换 -->
    <div class="admin-modules" role="tablist" aria-label="管理模块">
      <button
        v-for="m in adminModules"
        :key="m.key"
        class="admin-module-btn"
        :class="{ active: activeModule === m.key }"
        type="button"
        role="tab"
        :aria-selected="String(activeModule === m.key)"
        @click="activeModule = m.key"
      >
        <AppIcon :name="m.icon" />
        <span>{{ m.title }}</span>
      </button>
    </div>

    <div class="page-panel mt-15">
      <div class="page-section-head">
        <div>
          <h2>{{ currentModule.title }}</h2>
          <p>{{ currentModule.desc }}</p>
        </div>
        <span class="page-badge">{{ currentModule.actions.length }} 项操作</span>
      </div>

      <!-- ① 管理工作台 -->
      <template v-if="activeModule === 'dashboard'">
        <div class="page-stats">
          <div class="page-stat">
            <span>待处理事项</span>
            <strong>{{ filteredItems.filter((i) => !i.resolved).length }}</strong>
            <small>含举报、审核异常与反馈</small>
          </div>
          <div class="page-stat">
            <span>高严重程度</span>
            <strong>{{ filteredItems.filter((i) => i.severity === 'high').length }}</strong>
            <small>需优先处理</small>
          </div>
          <div class="page-stat">
            <span>待分配负责人</span>
            <strong>{{ filteredItems.filter((i) => i.owner === '待分配').length }}</strong>
            <small>演示队列</small>
          </div>
        </div>

        <div class="page-toolbar mt-15">
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

        <div v-for="i in itemStates" :key="i.id" class="page-list-row admin-task">
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
            </div>
            <div v-if="!i.resolved" class="page-actions mt-9">
              <button class="mini-btn" @click="onItemAction('review', i.id)">标记正在核实</button>
              <button class="mini-btn" @click="onItemAction('resolve', i.id)">处理完成</button>
            </div>
          </div>
          <span class="page-badge" :class="i.status.class">{{ i.status.label }}</span>
        </div>

        <div v-if="!filteredItems.length" class="page-empty">当前筛选条件下没有待处理事项。</div>
      </template>

      <!-- ② 账号与权限管理 -->
      <template v-else-if="activeModule === 'accounts'">
        <div class="page-section-head">
          <div>
            <h3>账号列表</h3>
            <p>查看角色、授权范围与违规记录。角色调整与处罚操作都会写入审计日志。</p>
          </div>
        </div>

        <div v-for="a in accountRows" :key="a.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-users" /></span>
          <div class="page-list-content">
            <strong>{{ a.name }}</strong>
            <p>角色：{{ a.role }} · 授权范围：{{ a.scope }}</p>
            <div class="admin-item-meta">
              <span class="admin-item-chip">账号编号：{{ a.id }}</span>
              <span class="admin-item-chip" :class="a.tone">状态：{{ a.status }}</span>
              <span class="admin-item-chip">违规记录：{{ a.violations }} 条</span>
            </div>
            <div class="page-actions mt-9">
              <button class="mini-btn" @click="onAccountAction('roles', a.id)">分配角色权限</button>
              <button class="mini-btn" @click="onAccountAction('restrict', a.id)">限制功能</button>
              <button class="mini-btn" @click="onAccountAction('ban', a.id)">暂时封禁</button>
              <button class="mini-btn" @click="onAccountAction('unban', a.id)">解封</button>
            </div>
          </div>
        </div>

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
      </template>

      <!-- ③ 内容与举报管理 -->
      <template v-else-if="activeModule === 'reports'">
        <p class="text-soft-12">
          管理范围包括笔记、优秀案例、论坛帖子与回复、资源导航条目、竞赛信息、头像与简介等用户提交内容。
          处理流程：提交举报 → 确认受理 → 必要时临时隐藏 → 通知当事人 → 核实材料 → 处理并说明理由 → 允许申诉。
        </p>
        <div v-for="t in adminTasks" :key="t.id" class="page-list-row admin-task">
          <span class="page-list-icon"><AppIcon :name="t.icon" /></span>
          <div class="page-list-content">
            <strong>{{ t.title }}</strong>
            <p>{{ t.desc }}</p>
            <small>{{ t.meta }}</small>
          </div>
          <span class="page-badge amber">待核实</span>
        </div>
        <div class="page-actions mt-12">
          <button class="mini-btn" @click="onItemAction('review', 'DEMO-003')">标记正在核实</button>
          <button class="mini-btn" @click="onItemAction('resolve', 'DEMO-003')">处理完成并说明理由</button>
        </div>
      </template>

      <!-- ④ 官方首页内容管理 -->
      <template v-else-if="activeModule === 'notices'">
        <p class="text-soft-12">
          由获授权的内容管理员维护官方通知：创建、编辑、设定有效期、发布、撤回与归档，并保留变更记录。
          已撤回或被更正的公告要显示合理状态，避免用户继续依据错误信息行动。
        </p>
        <div class="page-actions mt-12">
          <button class="solid-btn" data-create="notice">创建校级通知</button>
          <button class="outline-btn" @click="onItemAction('review', 'W-106')">检查即将到期通知</button>
          <button class="outline-btn" @click="onItemAction('resolve', 'W-106')">归档已到期通知</button>
        </div>
      </template>

      <!-- ⑤ 反馈与创新建议管理 -->
      <template v-else-if="activeModule === 'feedback'">
        <p class="text-soft-12">
          可分配负责人、追踪状态、记录验证结果并回复提交者。
          提交者应能看到处理进度（设计书 §12.3 反馈状态可见性）。
        </p>
        <div class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-shield" /></span>
          <div class="page-list-content">
            <strong>Bug：移动端底部导航在部分机型被安全区遮挡</strong>
            <p>提交时间：2026-11-03 21:45 · 状态：待分配负责人</p>
          </div>
          <span class="page-badge amber">待处理</span>
        </div>
        <div class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-spark" /></span>
          <div class="page-list-content">
            <strong>建议：竞赛条目增加「报名截止」提醒</strong>
            <p>提交时间：2026-10-29 11:08 · 状态：已回复</p>
          </div>
          <span class="page-badge green">已处理</span>
        </div>
        <div class="page-actions mt-12">
          <button class="mini-btn" @click="onItemAction('review', 'W-103')">分配负责人</button>
          <button class="mini-btn" @click="onItemAction('resolve', 'W-103')">标记已验证并回复</button>
        </div>
      </template>

      <!-- ⑥ 审核规则管理 -->
      <template v-else-if="activeModule === 'rules'">
        <p class="text-soft-12">
          规则应区分确定性与需上下文判断两类。敏感词不能只依赖庞大词库 ——
          需考虑引用、技术讨论与教学用途，避免把所有包含某个词的文本都认定为违规。
          规则变更后可回滚不合理版本。
        </p>
        <div v-for="r in ruleRows" :key="r.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-shield" /></span>
          <div class="page-list-content">
            <strong>{{ r.name }}</strong>
            <p>适用范围：{{ r.scope }}</p>
            <div class="admin-item-meta">
              <span class="admin-item-chip">类型：{{ r.type }}</span>
              <span class="admin-item-chip">近期命中：{{ r.hits }}</span>
              <span class="admin-item-chip" :class="r.falsePositives > 5 ? 'amber' : ''">
                误判反馈：{{ r.falsePositives }}
              </span>
            </div>
            <div class="page-actions mt-9">
              <button class="mini-btn" @click="showToast('演示：规则修改需要填写变更说明。')">修改规则</button>
              <button class="mini-btn" @click="showToast('演示：已停用该规则，历史命中记录保留。')">停用</button>
              <button class="mini-btn" @click="showToast('演示：可回滚到历史版本。')">回滚</button>
              <button class="mini-btn" @click="showToast('演示：抽查自动放行与拦截样本。')">抽查样本</button>
            </div>
          </div>
          <span class="page-badge" :class="r.state === '启用' ? 'green' : 'gray'">{{ r.state }}</span>
        </div>
      </template>

      <!-- ⑦ Agent 管理 -->
      <template v-else-if="activeModule === 'agents'">
        <p class="text-soft-12">
          Agent 管理仅涉及产品层面的开关与治理：启用状态、适用范围、阈值配置、运行状态与结果抽查。
          不允许 Agent 自行修改权限、绕过审核规则或取得管理员角色。
        </p>

        <div v-for="agent in agentDefinitions" :key="agent.key" class="agent-card">
          <div class="agent-icon"><AppIcon :name="agent.icon" /></div>
          <div>
            <h3>{{ agent.title }}</h3>
            <p>{{ agent.desc }}</p>
            <small
              class="page-badge agent-status"
              :class="demoStore.agentState[agent.key] ? 'green' : 'amber'"
            >
              {{ demoStore.agentState[agent.key] ? '原型已启用' : '原型已停用' }}
            </small>
          </div>
          <button
            class="switch"
            role="switch"
            :aria-checked="String(demoStore.agentState[agent.key])"
            :aria-label="`切换${agent.title}`"
            @click="onAgentToggle(agent.key)"
          ></button>
        </div>

        <!-- 审核 Agent 承载区：设计书 §8.3，构建方式确定后在此接入实际功能 -->
        <AgentSlot agent-key="moderation" class="mt-15" />

        <div class="page-callout">
          <AppIcon name="i-info" />
          <div>上述开关仅在当前预览中切换状态，不会启停真实模型或改变真实审核行为。正式平台需要记录配置变化、抽查误判，并支持异常时暂停自动拦截。</div>
        </div>
      </template>

      <!-- ⑧ 操作审计记录 -->
      <template v-else-if="activeModule === 'audit'">
        <p class="text-soft-12">
          记录操作者、时间、操作对象、操作类型、原因、处理结果及必要的关联案件编号。
          普通用户不应看到内部敏感审计信息，但应能查看与自己有关的处理决定和理由。
        </p>
        <div v-for="r in auditRecords" :key="r.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-file" /></span>
          <div class="page-list-content">
            <strong>{{ r.action }} · {{ r.target }}</strong>
            <p>原因：{{ r.reason }}</p>
            <small>结果：{{ r.result }}</small>
            <div class="admin-item-meta">
              <span class="admin-item-chip">编号：{{ r.id }}</span>
              <span class="admin-item-chip">类型：{{ auditTypes[r.type] }}</span>
              <span class="admin-item-chip">操作者：{{ r.operator }}</span>
              <span class="admin-item-chip">时间：{{ r.at }}</span>
              <span v-if="r.caseNo" class="admin-item-chip">关联案件：{{ r.caseNo }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- ⑨ 平台基础配置 -->
      <template v-else-if="activeModule === 'config'">
        <p class="text-soft-12">
          维护资源类别、技术方向标签、竞赛类型、问题状态与用户可见的社区规则说明。
          停用分类时应规定既有内容如何处理（迁移到替代分类、归入「其他」或保留历史分类），
          不应导致内容无故丢失。
        </p>
        <div v-for="c in configRows" :key="c.id" class="page-list-row">
          <span class="page-list-icon"><AppIcon name="i-grid" /></span>
          <div class="page-list-content">
            <strong>{{ c.name }}</strong>
            <p>{{ c.kind }} · {{ c.note }}</p>
          </div>
          <span class="page-badge" :class="c.state === '启用' ? 'green' : 'amber'">{{ c.state }}</span>
        </div>
        <div class="page-actions mt-12">
          <button class="mini-btn" @click="showToast('演示：新增分类。')">新增分类</button>
          <button class="mini-btn" @click="showToast('演示：同义标签合并前需检查关联内容数量。')">合并同义标签</button>
          <button class="mini-btn" @click="showToast('演示：停用分类需选择内容迁移方式。')">停用并迁移</button>
        </div>
      </template>
    </div>
  </section>
</template>
