<script setup>
import { ref, computed } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import AgentSlot from '../components/AgentSlot.vue'
import { plannerLevels, plannerHours, plannerDurations, plannerPrinciples } from '../data/pages.js'
import { demoStore } from '../stores/demo.js'
import { showToast } from '../composables/useToast.js'

const goal = ref('')
const level = ref(plannerLevels[0])
const hours = ref(5)
const duration = ref(8)
const difficulty = ref('')

const output = ref(null)

const stepCount = computed(() => Math.min(4, Math.max(2, Math.ceil(duration.value / 3))))

function generate() {
  if (!demoStore.agentState.planner) {
    showToast('学习规划 Agent 当前在原型中处于停用状态。')
    return
  }
  const g = goal.value.trim()
  if (!g) {
    showToast('先填写学习目标。')
    return
  }

  const phases = [
    {
      title: '目标拆解与基础盘点',
      desc: `确认“${g}”需要的基础知识和最终产出。当前基础：${level.value}。先列出已有能力与缺口。`,
    },
    {
      title: '学习核心知识',
      desc: `每周约 ${hours.value} 小时，按主题分段学习并整理笔记；每一阶段都记录来源与尚未解决的问题。`,
    },
    {
      title: '完成一个小型实践',
      desc: '选择规模可控的练习或原型，记录环境、实现步骤、结果和失败尝试，避免只看教程不动手。',
    },
    {
      title: '复盘并调整计划',
      desc: difficulty.value.trim()
        ? `用可观察的产出检查进度，再调整后续任务。你提到的困难是：${difficulty.value.trim()}。后续应优先针对这一困难调整。`
        : '用可观察的产出检查进度，再调整后续任务。若发现计划过重，可减少任务或延长周期。',
    },
  ]

  output.value = {
    goal: g,
    hours: hours.value,
    duration: duration.value,
    steps: phases.slice(0, stepCount.value).map((p, i) => ({ no: i + 1, ...p })),
  }

  requestAnimationFrame(() => {
    document.getElementById('planOutput')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function reset() {
  output.value = null
  requestAnimationFrame(() => {
    document.getElementById('plannerForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
</script>

<template>
  <section class="subpage">
    <div class="page-heading">
      <div>
        <div class="page-kicker">PERSONAL LEARNING PLANNER</div>
        <h1>个人学习规划</h1>
        <p>根据学习目标、当前基础、可投入时间和期望周期组织阶段计划，并关联平台中已有的真实资源。</p>
      </div>
      <div class="page-heading-actions">
        <span class="page-badge amber">本地演示，不调用真实模型</span>
      </div>
    </div>

    <div class="page-layout-two">
      <div class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>告诉我们你想达成什么</h2>
            <p>非必填信息可以跳过；信息不足时，规划应明确展示假设。</p>
          </div>
        </div>

        <form id="plannerForm" @submit.prevent="generate">
          <div class="form-row">
            <label for="planGoal">学习目标</label>
            <input
              id="planGoal"
              v-model="goal"
              placeholder="例如：从零开始掌握嵌入式开发"
              required
            />
          </div>
          <div class="form-grid-two">
            <div class="form-row">
              <label for="planLevel">当前基础</label>
              <select id="planLevel" v-model="level" class="page-select select-full">
                <option v-for="l in plannerLevels" :key="l">{{ l }}</option>
              </select>
            </div>
            <div class="form-row">
              <label for="planHours">每周可投入时间</label>
              <select id="planHours" v-model.number="hours" class="page-select select-full">
                <option v-for="h in plannerHours" :key="h.value" :value="h.value">{{ h.label }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <label for="planDuration">期望周期</label>
            <select id="planDuration" v-model.number="duration" class="page-select select-full">
              <option v-for="d in plannerDurations" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </div>
          <div class="form-row">
            <label for="planDifficulty">当前困难（可选）</label>
            <textarea
              id="planDifficulty"
              v-model="difficulty"
              placeholder="例如：不知道先学什么、看完教程但不会动手…"
              class="textarea-lg"
            ></textarea>
          </div>
          <button class="solid-btn" type="submit">
            生成计划示例 <AppIcon name="i-arrow" />
          </button>
        </form>
      </div>

      <aside class="page-panel">
        <div class="page-section-head">
          <div>
            <h2>规划原则</h2>
            <p>建议应当可执行，也应允许调整。</p>
          </div>
        </div>
        <div v-for="p in plannerPrinciples" :key="p.title" class="page-list-row">
          <span class="page-list-icon"><AppIcon :name="p.icon" /></span>
          <div class="page-list-content">
            <strong>{{ p.title }}</strong>
            <p>{{ p.desc }}</p>
          </div>
        </div>
        <div class="page-callout">
          <AppIcon name="i-info" />
          <div>当前按钮生成的是规则示例，不代表模型已连接。正式 Agent 必须明确假设，不伪造资源链接，也不承诺竞赛或职业结果。</div>
        </div>

        <!-- 规划 Agent 承载区：设计书 §8.4，构建方式确定后在此接入实际功能 -->
        <AgentSlot agent-key="planner" class="mt-15" />
      </aside>
    </div>

    <div v-if="output" id="planOutput" class="plan-output" aria-live="polite">
      <div class="page-section-head">
        <div>
          <h2>学习计划示例</h2>
          <p>目标：{{ output.goal }} · 周期：{{ output.duration }} 周 · 每周约 {{ output.hours }} 小时</p>
        </div>
        <span class="page-badge amber">规则示例 · 非真实模型输出</span>
      </div>

      <div class="page-callout">
        <AppIcon name="i-info" />
        <div>这是前端规则生成的示例计划，并未调用 AI 模型。正式 Agent 应根据用户反馈持续调整，并为推荐的每项资源提供真实、可访问的站内条目链接。</div>
      </div>

      <div v-for="s in output.steps" :key="s.no" class="plan-step">
        <span class="plan-step-no">{{ s.no }}</span>
        <div>
          <strong>阶段 {{ s.no }}：{{ s.title }}</strong>
          <p>{{ s.desc }}</p>
        </div>
      </div>

      <div class="page-actions mt-14">
        <button class="mini-btn" data-route="notes">浏览学习笔记</button>
        <button class="mini-btn" data-route="resources">浏览资源导航</button>
        <button class="mini-btn" @click="reset">重新规划</button>
      </div>
    </div>
  </section>
</template>
