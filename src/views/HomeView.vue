<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import HeroCanvas from '../components/HeroCanvas.vue'
import {
  homeCompetitions,
  homeDiscover,
  homeActivities,
  discoverFilters,
  heroSuggestions,
} from '../data/content.js'
import { useSearch, runSearch, clearSearch } from '../composables/useSearch.js'
import { showToast } from '../composables/useToast.js'

const router = useRouter()
const search = useSearch()

const query = ref('')
const discoverFilter = ref('all')

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
}

function applySuggestion(q) {
  query.value = q
  runSearch(q)
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
    <!-- 官方通知 -->
    <section class="notice-strip" aria-label="官方通知">
      <div class="notice-label"><AppIcon name="i-bellring" />官方通知</div>
      <div class="notice-text">
        <span class="tiny-status">演示公告</span>
        <strong>校园学习平台试运行说明（示例公告）</strong>
        <span style="color: var(--text-faint); font-size: 10px; white-space: nowrap">平台示例数据</span>
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

          <form class="search-shell" @submit.prevent="submitSearch">
            <div class="search-icon">
              <AppIcon name="i-search" style="width: 21px; height: 21px" />
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

    <!-- 搜索结果 -->
    <section class="search-results" :class="{ open: search.active }" aria-live="polite">
      <div class="results-head">
        <strong>{{ search.title }}</strong>
        <span>{{ search.active ? `${search.count} 条演示匹配` : '演示结果' }}</span>
      </div>

      <div v-if="search.active && search.results.length">
        <div v-for="(r, i) in search.results" :key="i" class="result-item">
          <span class="result-type">{{ r.typeLabel }}</span>
          <div class="result-main">
            <strong>{{ r.heading }}</strong>
            <small>{{ r.desc.slice(0, 100) }}</small>
          </div>
          <button class="open-card" @click="openResult(r)">打开</button>
          <span class="demo-label">演示</span>
        </div>
      </div>

      <div v-if="search.active && !search.results.length" class="empty-state">
        当前演示内容中没有匹配条目。你可以尝试更短的关键词或选择相近方向。正式平台应基于用户有权限访问的真实内容返回结果。
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
            <div style="margin-top: 15px">
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
          <button class="text-link" data-route="forum" style="margin-top: 10px">
            进入学习论坛 <AppIcon name="i-arrow" />
          </button>
        </aside>
      </div>
    </section>

    <!-- 反馈条 -->
    <section class="feedback-band">
      <div class="feedback-copy">
        <div class="feedback-symbol">
          <AppIcon name="i-message" style="width: 21px; height: 21px" />
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
