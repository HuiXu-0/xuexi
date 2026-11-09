<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import HeroCanvas from '../components/HeroCanvas.vue'
import {
  homeCompetitions,
  homeDiscover,
  homeActivities,
  discoverFilters,
  heroSuggestions,
  siteNotices,
  noticeStates,
} from '../data/content.js'
import { useSearch, runSearch, clearSearch } from '../composables/useSearch.js'
import { showToast } from '../composables/useToast.js'
import { runAgent, AGENT_KEYS, agentRuntime } from '../services/agentRuntime.js'

const router = useRouter()
const search = useSearch()

const query = ref('')
const discoverFilter = ref('all')
const noticeIndex = ref(0)
const searchWrapRef = ref(null)

/**
 * 主要展示区的通知。
 * 设计书 §5.1.2 A：已过有效期的通知应自动退出主要展示区域（仍可在历史公告查看）；
 * 置顶和重要标记仅由具备权限的人员设置 —— 排序时置顶优先。
 */
const visibleNotices = computed(() =>
  siteNotices
    .filter((n) => n.state !== 'expired')
    .slice()
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
)

const currentNotice = computed(() => visibleNotices.value[noticeIndex.value] || visibleNotices.value[0])

/** 搜索 Agent 的调用状态（供结果浮层显示） */
const agentState = computed(() => agentRuntime[AGENT_KEYS.search])

/** 无结果时的调整建议 */
const emptySuggestions = computed(() => search.suggestions || [])

/* 公告自动轮播：桌面端手动点击圆点切换，移动端自动轮播 */
let noticeTimer = 0

onMounted(() => {
  noticeTimer = setInterval(() => {
    noticeIndex.value = (noticeIndex.value + 1) % visibleNotices.value.length
  }, 6000)
  document.addEventListener('click', onOutsideSearch)
})

onBeforeUnmount(() => {
  clearInterval(noticeTimer)
  document.removeEventListener('click', onOutsideSearch)
})

/** 点击搜索区域之外时收起结果浮层 */
function onOutsideSearch(e) {
  if (!search.active) return
  if (searchWrapRef.value && !searchWrapRef.value.contains(e.target)) {
    clearSearch()
    query.value = ''
  }
}

const filteredDiscover = computed(() =>
  discoverFilter.value === 'all'
    ? homeDiscover
    : homeDiscover.filter((d) => d.filterType === discoverFilter.value)
)

function submitSearch() {
  const q = query.value.trim()
  if (!q) {
    showToast('先输入关键词或描述你的学习目标。')
    document.getElementById('globalSearch')?.focus()
    return
  }
  runSearch(q)
  /*
   * 接入搜索 Agent（设计书 §8.2）。
   * Agent 负责理解自然语言意图、扩展相关概念并组织跨类别结果；
   * 它必须建立在真实内容之上，不能编造不存在的资源。
   * 当前为预留接口，真实实现接入后此处会自动显示 Agent 的处理状态。
   */
  runAgent(AGENT_KEYS.search, { query: q, count: search.count })
}

function applySuggestion(q) {
  query.value = q
  submitSearch()
}

function clearOnEscape(e) {
  if (e.key === 'Escape') {
    query.value = ''
    clearSearch()
  }
}

function openResult(result) {
  router.push({ name: result.route })
  showToast('已打开对应模块；具体内容仍为本地演示数据。')
}

function discoverAll() {
  discoverFilter.value = 'all'
  document.getElementById('discover')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div>
    <!-- 官方通知：多条公告轮播，含发布方/发布时间/有效期/重要程度与状态 -->
    <section class="notice-strip" aria-label="官方通知">
      <div class="notice-label"><AppIcon name="i-bellring" />官方通知</div>
      <div class="notice-text">
        <span class="tiny-status">{{ currentNotice.tag }}</span>
        <strong>{{ currentNotice.title }}</strong>
        <span class="notice-note">{{ currentNotice.note }}</span>
      </div>
      <div class="notice-meta">
        <span class="notice-meta-item"><AppIcon name="i-users" />{{ currentNotice.issuer }}</span>
        <span class="notice-meta-item"><AppIcon name="i-calendar" />{{ currentNotice.publishedAt }}</span>
        <span class="notice-meta-item"><AppIcon name="i-clock" />有效期至 {{ currentNotice.validUntil }}</span>
        <span class="notice-importance" :class="currentNotice.importance === '重要' ? 'high' : ''">
          {{ currentNotice.importance }}
        </span>
        <span v-if="currentNotice.state !== 'active'" class="notice-state" :class="currentNotice.state">
          {{ noticeStates[currentNotice.state]?.label }}
        </span>
      </div>
      <div class="notice-controls">
        <button
          v-for="n in visibleNotices"
          :key="n.id"
          class="notice-dot"
          :class="{ active: n.id === currentNotice.id }"
          :aria-label="`查看公告：${n.title}`"
          @click="noticeIndex = visibleNotices.findIndex((x) => x.id === n.id)"
        ></button>
      </div>
      <button class="text-link" data-item="notice-1">
        查看通知 <AppIcon name="i-arrow" />
      </button>
    </section>

    <!-- Hero -->
    <section class="hero" aria-labelledby="heroTitle">
      <HeroCanvas />
      <span class="dot-orbit d1" aria-hidden="true"></span>
      <span class="dot-orbit d2" aria-hidden="true"></span>
      <span class="dot-orbit d3" aria-hidden="true"></span>
      <span class="dot-orbit d4" aria-hidden="true"></span>

      <div class="hero-grid">
        <div class="hero-copy">
          <div class="eyebrow"><span class="eyebrow-line"></span> FIND YOUR NEXT STEP</div>
          <h1 id="heroTitle">让学习有方向，<br /><span class="highlight">让成果被看见。</span></h1>
          <p class="hero-desc">
            从一份笔记、一个项目案例或一次学习交流开始。连接课程与实践经验，发现适合自己的学习资源和同行者。
          </p>

          <div ref="searchWrapRef">
            <form class="search-shell" @submit.prevent="submitSearch">
              <div class="search-icon">
                <AppIcon name="i-search" class="icon-lg" />
              </div>
              <label class="sr-only" for="globalSearch">搜索学习内容</label>
              <input
                id="globalSearch"
                v-model="query"
                type="search"
                placeholder="搜索笔记、项目案例、竞赛或学习方向…"
                autocomplete="off"
                @keydown="clearOnEscape"
              />
              <button class="search-btn" type="submit">
                开始探索 <AppIcon name="i-arrow" />
              </button>
            </form>

            <!-- 搜索结果浮层：直接在输入框下方展开，不再把结果推到 Hero 之外的下一个区块 -->
            <div v-if="search.active" class="search-dropdown" aria-live="polite">
              <div class="search-dropdown-head">
                <strong>{{ search.title }}</strong>
                <span>{{ search.count }} 条演示匹配</span>
              </div>

              <!--
                Agent 承载区：设计书 §8.2 规定搜索结果由「全局搜索与发现 Agent」
                负责组织。这里先接入调用接口并展示其状态，
                真实 Agent 接上后这段会自动显示真实结果。
              -->
              <div class="search-agent-bar" :class="agentState.status">
                <AppIcon :name="agentState.status === 'loading' ? 'i-clock' : 'i-spark'" />
                <span v-if="agentState.status === 'loading'">搜索 Agent 正在理解你的需求…</span>
                <span v-else-if="agentState.status === 'ready'">结果由搜索 Agent 按内容类型组织</span>
                <span v-else>搜索 Agent 待接入，当前为普通关键词检索结果</span>
              </div>

              <div v-if="search.results.length" class="search-dropdown-list">
                <button
                  v-for="(r, i) in search.results"
                  :key="i"
                  class="search-dropdown-item"
                  type="button"
                  @click="openResult(r)"
                >
                  <span class="result-type">{{ r.typeLabel }}</span>
                  <span class="search-dropdown-text">
                    <strong>{{ r.heading }}</strong>
                    <small>{{ r.desc.slice(0, 72) }}</small>
                    <!-- 设计书 §13.2：结果需展示标签、作者/来源、更新时间与可见范围 -->
                    <span class="search-dropdown-meta">
                      <span v-for="t in r.tags" :key="t" class="search-meta-tag">{{ t }}</span>
                      <span class="search-meta-item"><AppIcon name="i-users" />{{ r.author }}</span>
                      <span class="search-meta-item"><AppIcon name="i-clock" />{{ r.updatedAt }}</span>
                      <span class="search-meta-scope">{{ r.scopeLabel }}</span>
                    </span>
                  </span>
                  <AppIcon name="i-arrow" />
                </button>
              </div>

              <!-- 设计书 §8.2.4：无结果时给调整建议，不编造结果 -->
              <div v-else class="search-dropdown-empty">
                <AppIcon name="i-info" />
                <div class="search-empty-body">
                  <strong>没有找到匹配的内容</strong>
                  <p>当前演示内容中没有匹配条目。可以尝试：</p>
                  <div class="search-empty-actions">
                    <button
                      v-for="s in emptySuggestions"
                      :key="s.text"
                      class="mini-btn"
                      @click="applySuggestion(s.query)"
                    >
                      {{ s.text }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="suggestions">
            <span>试试：</span>
            <button
              v-for="s in heroSuggestions"
              :key="s.query"
              type="button"
              @click="applySuggestion(s.query)"
            >
              {{ s.query }}
            </button>
            <button type="button" data-route="planner">制定学习计划</button>
          </div>

          <div class="demo-note">
            <AppIcon name="i-info" />示例内容仅用于预览交互；搜索结果为本页演示数据。
          </div>
        </div>

        <div class="hero-art" aria-hidden="true">
          <div class="orbit"></div>
          <div class="orbit-inner"></div>
          <div class="hub"><svg><use href="#i-grid" /></svg></div>
          <div class="float-node node-a">
            <span class="node-icon"><AppIcon name="i-book" /></span>
            <span>学习资源<small>笔记 · 教程 · 导航</small></span>
          </div>
          <div class="float-node node-b">
            <span class="node-icon"><AppIcon name="i-trophy" /></span>
            <span>竞赛实践<small>信息 · 案例 · 经验</small></span>
          </div>
          <div class="float-node node-c">
            <span class="node-icon"><AppIcon name="i-users" /></span>
            <span>学习交流<small>小组 · 讨论 · 答疑</small></span>
          </div>
          <div class="float-node node-d">
            <span class="node-icon"><AppIcon name="i-spark" /></span>
            <span>个人成长<small>方向 · 规划 · 展示</small></span>
          </div>
        </div>
      </div>
    </section>

    <!-- 近期竞赛与活动 -->
    <section class="section" id="competitions">
      <div class="section-head">
        <div class="section-title-wrap">
          <div class="section-kicker">UPCOMING &amp; OPPORTUNITIES</div>
          <h2>近期竞赛与活动</h2>
          <div class="section-sub">关注时间节点，也关注每场赛事对应的能力与实践方向。</div>
        </div>
        <button class="text-link" data-route="competitions">
          查看竞赛资源 <AppIcon name="i-arrow" />
        </button>
      </div>

      <div class="competition-grid">
        <article v-for="c in homeCompetitions" :key="c.id" class="competition-card">
          <div class="card-top">
            <span class="category-pill"><AppIcon :name="c.icon" />{{ c.category }}</span>
            <span class="status">{{ c.status }}</span>
          </div>
          <h3>{{ c.title }}</h3>
          <p class="card-desc">{{ c.desc }}</p>
          <div class="meta-row">
            <span v-for="m in c.metas" :key="m[1]" class="meta-item">
              <AppIcon :name="m[0]" />{{ m[1] }}
            </span>
          </div>
          <div class="card-divider"></div>
          <div class="card-foot">
            <span class="source-note">{{ c.sourceNote }}</span>
            <button class="open-card" :data-item="c.id">
              了解详情 <AppIcon name="i-arrow" />
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- 学习发现 -->
    <section class="section" id="discover">
      <div class="section-head">
        <div class="section-title-wrap">
          <div class="section-kicker">LEARN &amp; MAKE PROGRESS</div>
          <h2>学习发现</h2>
          <div class="section-sub">从他人的笔记、真实实践案例和整理过的外部资源中，找到下一步。</div>
        </div>
        <button class="text-link" @click="discoverAll">
          探索全部内容 <AppIcon name="i-arrow" />
        </button>
      </div>

      <div class="discover-toolbar" role="group" aria-label="筛选学习发现内容">
        <button
          v-for="f in discoverFilters"
          :key="f.value"
          class="filter-btn"
          :class="{ active: discoverFilter === f.value }"
          @click="discoverFilter = f.value"
        >
          {{ f.label }}
        </button>
      </div>

      <div class="discover-grid">
        <article v-for="d in filteredDiscover" :key="d.id" class="discover-card">
          <div class="cover" :class="d.coverClass">
            <AppIcon :name="d.coverIcon" />
            <span class="cover-label">{{ d.coverLabel }}</span>
            <div class="cover-illustration"></div>
          </div>
          <div class="discover-body">
            <div class="type-row">
              <span class="type-label">{{ d.typeLabel }}</span>
              <span class="demo-label">{{ d.demoLabel }}</span>
            </div>
            <h3>{{ d.title }}</h3>
            <p class="card-desc">{{ d.desc }}</p>
            <div class="tag-row">
              <span v-for="t in d.tags" :key="t" class="tag">{{ t }}</span>
            </div>
            <div class="discover-footer">
              <div class="author">
                <span class="author-avatar">{{ d.authorAvatar }}</span>
                <span>{{ d.authorName }}</span>
              </div>
              <button class="open-card" :data-item="d.id">
                {{ d.ctaLabel }} <AppIcon name="i-arrow" />
              </button>
            </div>
          </div>
        </article>

        <div v-if="!filteredDiscover.length" class="no-results">
          该分类暂时没有演示条目。正式平台可在这里展示真实内容或引导用户提交资源。
        </div>
      </div>
    </section>

    <!-- 学习小组动态 -->
    <section class="section" id="groups">
      <div class="section-head">
        <div class="section-title-wrap">
          <div class="section-kicker">LEARN TOGETHER</div>
          <h2>学习小组动态</h2>
          <div class="section-sub">找到同行者，让讨论、问题和经验成为可以持续积累的内容。</div>
        </div>
        <button class="text-link" data-route="forum">
          发现学习小组 <AppIcon name="i-arrow" />
        </button>
      </div>

      <div class="groups-layout">
        <article class="group-feature">
          <div class="group-art"><svg><use href="#i-circuit" /></svg></div>
          <div class="group-content">
            <div class="type-row">
              <span class="category-pill">公开学习小组</span>
              <span class="demo-label">演示内容</span>
            </div>
            <h3>嵌入式实践学习小组</h3>
            <p>从基础电路、开发板入门到小型原型项目，围绕阶段目标分享资源与实践经验。</p>
            <div class="group-stats">
              <span><AppIcon name="i-users" />成员数待接入</span>
              <span><AppIcon name="i-message" />讨论内容示例</span>
            </div>
            <div class="mt-15">
              <button class="open-card" data-item="group-1">
                了解小组 <AppIcon name="i-arrow" />
              </button>
            </div>
          </div>
        </article>

        <aside class="group-side">
          <div class="side-title">
            <h3>近期讨论</h3>
            <span class="demo-label">示例动态</span>
          </div>
          <div v-for="a in homeActivities" :key="a.title" class="activity-item">
            <span class="activity-icon" :style="a.style"><AppIcon :name="a.icon" /></span>
            <div class="activity-text">
              <strong>{{ a.title }}</strong>
              <span>{{ a.meta }}</span>
              <span class="activity-tag">{{ a.tag }}</span>
            </div>
          </div>
          <button class="text-link mt-10" data-route="forum">
            进入学习论坛 <AppIcon name="i-arrow" />
          </button>
        </aside>
      </div>
    </section>

    <!-- 反馈条 -->
    <section class="feedback-band">
      <div class="feedback-copy">
        <div class="feedback-symbol">
          <AppIcon name="i-message" class="icon-lg" />
        </div>
        <div>
          <h3>让平台更贴近真实的学习需求</h3>
          <p>遇到问题，或有值得尝试的新功能？可以通过反馈入口告诉平台维护者。</p>
        </div>
      </div>
      <div class="feedback-actions">
        <button class="outline-btn" data-modal="bug">提交 Bug 反馈</button>
        <button class="solid-btn" data-modal="suggestion">
          提出功能建议 <AppIcon name="i-arrow" />
        </button>
      </div>
    </section>
  </div>
</template>
