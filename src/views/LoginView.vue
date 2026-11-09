<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import { userRoles, roleMeta } from '../data/dict.js'
import { signIn, authStore } from '../stores/auth.js'
import { showToast } from '../composables/useToast.js'

const router = useRouter()

const mode = ref('login')
const isRegister = computed(() => mode.value === 'register')

/**
 * 角色选择：设计书 §3.1 定义了学生 / 教师 / 平台管理员三类角色，
 * 各自可见的导航与可执行的操作不同。角色在登录界面选定，登录后即固定。
 */
const selectedRole = ref('student')
const roleOptions = userRoles

/**
 * 校级内容管理授权（设计书 §4.2）。
 * 只有教师角色才可能获得该授权；没有它时教师端展示的是申请说明，
 * 而不是可误触的虚假操作按钮。
 */
const contentAdminGranted = ref(false)
/** 是否申请「内容审核职责」（§6.4，与校级内容管理授权相互独立） */
const reviewGranted = ref(false)

const identifier = ref('')
const displayName = ref('')
const school = ref('')
const password = ref('')
const confirmPassword = ref('')
const remember = ref(false)
const agreement = ref(false)
const showPassword = ref(false)
const showConfirm = ref(false)

const identifierRef = ref(null)
const displayNameRef = ref(null)
const schoolRef = ref(null)
const passwordRef = ref(null)
const confirmRef = ref(null)
const demoEnterRef = ref(null)

/** 字段级错误：直接在输入框下方提示，不依赖页面底部的提示条 */
const errors = reactive({
  identifier: '',
  displayName: '',
  school: '',
  password: '',
  confirm: '',
  agreement: '',
})

const notice = reactive({ visible: false, isError: false, title: '', message: '' })

/**
 * 左侧文案必须随登录 / 注册切换。
 * 之前这里是写死的「欢迎回来」，切到注册标签后右侧表单变成「创建账号」，
 * 左侧却还在说「欢迎回来」，属于前后不一致的逻辑错误。
 */
const intro = computed(() =>
  isRegister.value
    ? {
        kicker: 'JOIN THE CAMPUS',
        lead: '欢迎加入，',
        accent: '开启你的学习旅程。',
        desc: '注册一个账号，把课程笔记、项目案例和小组讨论沉淀成可持续积累的个人学习空间。',
        benefits: [
          { icon: 'i-grid', title: '建立你的学习档案', desc: '展示名称、所在院系与学习方向，让同行者更容易找到你。' },
          { icon: 'i-spark', title: '从第一天就开始沉淀', desc: '发布的笔记与案例会被整理、检索，成为别人可复用的经验。' },
          { icon: 'i-shield', title: '自主管理可见范围', desc: '自己决定哪些内容公开、哪些仅自己可见，权限逐项校验。' },
        ],
      }
    : {
        kicker: 'YOUR LEARNING SPACE',
        lead: '欢迎回来，',
        accent: '继续你的学习旅程。',
        desc: '登录后可在正式版本中管理学习笔记、收藏内容、加入学习小组，并跟进自己的学习计划与实践成果。',
        benefits: [
          { icon: 'i-bookmark', title: '积累个人学习空间', desc: '整理收藏、笔记和持续更新的学习记录。' },
          { icon: 'i-users', title: '参与校园知识协作', desc: '发现学习小组、问题讨论和实践伙伴。' },
          { icon: 'i-shield', title: '尊重内容与隐私边界', desc: '账号角色、内容可见范围和操作权限应分别校验。' },
        ],
      }
)

const title = computed(() => (isRegister.value ? '创建你的学习账号' : '登录校园学习平台'))

const subtitle = computed(() =>
  isRegister.value
    ? '填写基础信息，先体验注册表单。正式版需完成校园身份验证。'
    : '使用校园邮箱、学号或用户名继续。'
)
const submitLabel = computed(() => (isRegister.value ? '创建演示账号' : '登录并继续'))
const demoEnterLabel = ref('暂不登录，先体验平台')

/** 密码强度：长度 + 字母数字组合 + 符号 */
const strength = computed(() => {
  const p = password.value
  if (!p) return { tone: '', percent: 0, label: '未输入' }
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  return [
    { tone: 'weak', percent: 18, label: '偏弱' },
    { tone: 'weak', percent: 34, label: '偏弱' },
    { tone: 'mid', percent: 58, label: '一般' },
    { tone: 'strong', percent: 80, label: '较强' },
    { tone: 'strong', percent: 100, label: '很强' },
  ][score]
})

const hasMinLength = computed(() => password.value.length >= 6)
const hasMixed = computed(() => /[A-Za-z]/.test(password.value) && /\d/.test(password.value))

function setMode(next) {
  const target = next === 'register' ? 'register' : 'login'
  if (mode.value === target) return
  mode.value = target
  notice.visible = false
  clearErrors()
  /* 两种模式的字段不同，密码类输入不应带过去 */
  password.value = ''
  confirmPassword.value = ''
  agreement.value = false
  demoEnterLabel.value = isRegister.value ? '先跳过注册，体验平台' : '暂不登录，先体验平台'
  /*
   * 这里**不自动聚焦**输入框。
   * 之前切换后 40ms 就把焦点交给首个输入框，而此时切换动画（260ms）还没结束 ——
   * 输入框在动画中途突然获得焦点、边框高亮突变，视觉上就是一次明显的闪屏。
   * 焦点留在用户刚点的标签上更自然，也顺带避免了滚动跳动。
   */
}

function clearErrors() {
  for (const key of Object.keys(errors)) errors[key] = ''
}

function setNotice(t, m, isError = false) {
  notice.title = t
  notice.message = m
  notice.isError = isError
  notice.visible = true
}

function focusField(name) {
  const map = {
    identifier: identifierRef,
    displayName: displayNameRef,
    school: schoolRef,
    password: passwordRef,
    confirm: confirmRef,
  }
  const el = map[name]?.value
  if (!el) return
  el.focus({ preventScroll: true })
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function onSubmit() {
  notice.visible = false
  clearErrors()

  if (!identifier.value.trim()) {
    errors.identifier = '请输入校园邮箱、学号或用户名。'
    focusField('identifier')
    return
  }
  if (password.value.length < 6) {
    errors.password = '密码至少需要 6 位字符。'
    focusField('password')
    return
  }
  if (isRegister.value) {
    if (!displayName.value.trim()) {
      errors.displayName = '请填写平台显示名称。'
      focusField('displayName')
      return
    }
    if (!school.value.trim()) {
      errors.school = '请填写学校或院系名称。'
      focusField('school')
      return
    }
    if (confirmPassword.value !== password.value) {
      errors.confirm = '两次输入的密码不一致。'
      focusField('confirm')
      return
    }
    if (!agreement.value) {
      errors.agreement = '请先确认已阅读内容规则与隐私说明。'
      return
    }
  }

  if (remember.value && !isRegister.value) {
    try {
      localStorage.setItem('campus-auth-identifier', identifier.value.trim())
    } catch (_) {}
  }

  /* 记录角色，登录后按角色驱动导航与权限 */
  const name = displayName.value.trim() || identifier.value.trim()
  signIn({
    role: selectedRole.value,
    displayName: name,
    contentAdmin: contentAdminGranted.value,
    canReview: reviewGranted.value,
  })

  setNotice(
    isRegister.value ? '注册表单校验完成' : '登录表单校验完成',
    `这只是前端交互演示，未创建或验证真实账号。已按「${roleMeta(selectedRole.value).label}」身份进入，导航与权限会随之变化。`
  )
  demoEnterLabel.value = isRegister.value ? '进入平台开始体验' : '继续体验平台'
  demoEnterRef.value?.focus({ preventScroll: true })
}

function onHelp() {
  setNotice(
    '账号帮助',
    '当前原型没有连接学校统一身份认证或密码重置服务。正式版需通过学校指定的账号支持流程处理。'
  )
}

function enterPlatform() {
  /*
   * 始终以登录页当前选定的角色建立会话。
   * 之前只在「未登录」时才写角色，导致已登录教师后再来选学生，
   * 导航与权限仍停留在教师身份 —— 角色选择形同虚设。
   */
  signIn({
    role: selectedRole.value,
    displayName: displayName.value.trim() || identifier.value.trim(),
    contentAdmin: contentAdminGranted.value,
    canReview: reviewGranted.value,
  })
  router.push({ name: 'home' })
}

onMounted(() => {
  try {
    const saved = localStorage.getItem('campus-auth-identifier')
    if (saved) {
      identifier.value = saved
      remember.value = true
    }
  } catch (_) {}
  setTimeout(() => identifierRef.value?.focus({ preventScroll: true }), 40)
})
</script>

<template>
  <section class="login-screen" id="loginPage">
    <!--
      左侧介绍区：登录/注册文案不同，切换时用淡入淡出过渡。
      容器固定高度且内容叠放（position:absolute），避免切换时把整页撑高、顶边位移。
    -->
    <div class="login-intro">
      <Transition name="swap">
        <div :key="mode" class="login-intro-swap">
          <div class="welcome-kicker"><span class="demo-dot"></span> {{ intro.kicker }}</div>
          <h1>
            {{ intro.lead }}<br /><span class="highlight">{{ intro.accent }}</span>
          </h1>
          <p>{{ intro.desc }}</p>

          <div class="login-benefits">
            <div v-for="b in intro.benefits" :key="b.title" class="login-benefit">
              <span class="icon-wrap"><AppIcon :name="b.icon" /></span>
              <div>
                <strong>{{ b.title }}</strong>{{ b.desc }}
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="auth-card">
      <div class="auth-card-head">
        <h2>{{ title }}</h2>
        <p>{{ subtitle }}</p>
      </div>

      <div class="auth-tabs" role="tablist" aria-label="登录或注册">
        <!-- 滑动指示器：切换时用位移过渡，比直接变色更有方向感 -->
        <span class="auth-tabs-indicator" :class="{ 'on-register': isRegister }" aria-hidden="true"></span>
        <button
          :class="{ active: !isRegister }"
          type="button"
          role="tab"
          :aria-selected="String(!isRegister)"
          @click="setMode('login')"
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          :class="{ active: isRegister }"
          :aria-selected="String(isRegister)"
          @click="setMode('register')"
        >
          注册账号
        </button>
      </div>

      <!-- 提示条放在表单上方：底部提示在长表单下会被滚出视口 -->
      <div
        v-if="notice.visible"
        class="auth-notice visible"
        :class="{ error: notice.isError }"
        role="status"
        aria-live="polite"
      >
        <strong>{{ notice.title }}</strong><span>{{ notice.message }}</span>
      </div>

      <!--
        表单区：登录与注册字段不同，切换时整块淡入淡出。

        容器用 grid 叠放（两份表单占同一格），**不要用 position:absolute 叠放**：
        absolute 的包含块是最近的有定位的祖先，而 .auth-card 原本没有
        position:relative，包含块会一路向上找到 .welcome-gate，
        结果切换瞬间整份表单被拉到视口左上角 (0,0) 并撑成 100vw，
        压住左侧介绍区 —— 表现为「切一下就整页闪白 / 按钮横跨全屏」。

        min-height 固定为两模式中较高者，切换时容器高度恒定。
      -->
      <div class="auth-form-stack">
      <Transition name="swap">
        <form :key="mode" novalidate class="auth-form" @submit.prevent="onSubmit">
        <!-- 角色选择：决定登录后的导航与可操作范围 -->
        <div class="auth-role">
          <div class="auth-role-head">
            <label>选择身份</label>
            <span>不同身份的可见导航与操作权限不同</span>
          </div>
          <div class="auth-role-list" role="radiogroup" aria-label="选择身份">
            <button
              v-for="r in roleOptions"
              :key="r.key"
              class="auth-role-item"
              :class="{ active: selectedRole === r.key }"
              type="button"
              role="radio"
              :aria-checked="String(selectedRole === r.key)"
              @click="selectedRole = r.key"
            >
              <span class="auth-role-icon"><AppIcon :name="r.icon" /></span>
              <span class="auth-role-text">
                <strong>{{ r.label }}</strong>
                <small>{{ r.desc }}</small>
              </span>
            </button>
          </div>

          <!--
            教师可额外申请两项**相互独立**的授权。
            设计书 §3.3 权限矩阵里「教师」这一档内部还要再分：
            有没有内容审核职责、有没有校级内容管理权 —— 两项互不包含。
          -->
          <div v-if="selectedRole === 'teacher'" class="auth-grant-list">
            <label class="auth-extra-grant">
              <input v-model="contentAdminGranted" type="checkbox" />
              <span>
                <strong>同时申请「校级内容管理」授权</strong>
                <small>普通教师默认没有该权限；勾选后可在教师端维护校级通知。</small>
              </span>
            </label>
            <label class="auth-extra-grant">
              <input v-model="reviewGranted" type="checkbox" />
              <span>
                <strong>同时申请「内容审核职责」</strong>
                <small>用于处理被分配的审核任务；未获授权时不会显示审核队列。</small>
              </span>
            </label>
          </div>
        </div>

        <!--
          浮动标签（floating label）。
          label 初始落在输入框内当占位符用，聚焦或已有内容时上浮成小标签，
          这样输入框聚焦时不会把提示文字清空 —— 用 placeholder 做不到这一点。
          placeholder 保留一个空格，是为了让 :not(:placeholder-shown) 能判断「有没有值」。
        -->
        <div class="auth-field" :class="{ filled: !!identifier }">
          <label for="authIdentifier">校园邮箱 / 学号 / 用户名</label>
          <div class="auth-input-wrap" :class="{ 'is-error': errors.identifier }">
            <AppIcon name="i-users" />
            <input
              id="authIdentifier"
              ref="identifierRef"
              v-model="identifier"
              autocomplete="username"
              placeholder=" "
              :aria-invalid="!!errors.identifier"
              aria-describedby="errIdentifier"
              required
            />
          </div>
          <p v-if="errors.identifier" id="errIdentifier" class="auth-error">{{ errors.identifier }}</p>
        </div>

        <!-- 注册的次要字段并排，避免表单过高 -->
        <div v-if="isRegister" class="auth-grid">
          <div class="auth-field" :class="{ filled: !!displayName }">
            <label for="authDisplayName">平台显示名称</label>
            <div class="auth-input-wrap" :class="{ 'is-error': errors.displayName }">
              <AppIcon name="i-grid" />
              <input
                id="authDisplayName"
                ref="displayNameRef"
                v-model="displayName"
                autocomplete="nickname"
                placeholder=" "
                :aria-invalid="!!errors.displayName"
                required
              />
            </div>
            <p v-if="errors.displayName" class="auth-error">{{ errors.displayName }}</p>
          </div>

          <div class="auth-field" :class="{ filled: !!school }">
            <label for="authSchool">学校 / 院系</label>
            <div class="auth-input-wrap" :class="{ 'is-error': errors.school }">
              <AppIcon name="i-book" />
              <input
                id="authSchool"
                ref="schoolRef"
                v-model="school"
                autocomplete="organization"
                placeholder=" "
                :aria-invalid="!!errors.school"
                required
              />
            </div>
            <p v-if="errors.school" class="auth-error">{{ errors.school }}</p>
          </div>
        </div>

        <div class="auth-field" :class="{ filled: !!password }">
          <label for="authPassword">密码</label>
          <div class="auth-input-wrap" :class="{ 'is-error': errors.password }">
            <AppIcon name="i-shield" />
            <input
              id="authPassword"
              ref="passwordRef"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              minlength="6"
              placeholder=" "
              :aria-invalid="!!errors.password"
              required
            />
            <button
              class="auth-show-password"
              type="button"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <p v-if="errors.password" class="auth-error">{{ errors.password }}</p>
        </div>

        <!-- 注册时给出密码规则与强度，避免用户填完才被拒 -->
        <div v-if="isRegister" class="auth-strength">
          <div class="auth-strength-bar" :class="strength.tone">
            <span :style="{ width: strength.percent + '%' }"></span>
          </div>
          <div class="auth-strength-meta">
            <span class="auth-strength-label">密码强度：{{ strength.label }}</span>
            <span class="auth-rule" :class="{ ok: hasMinLength }"><i></i>至少 6 位</span>
            <span class="auth-rule" :class="{ ok: hasMixed }"><i></i>字母与数字</span>
          </div>
        </div>

        <div v-if="isRegister" class="auth-field" :class="{ filled: !!confirmPassword }">
          <label for="authConfirmPassword">确认密码</label>
          <div class="auth-input-wrap" :class="{ 'is-error': errors.confirm }">
            <AppIcon name="i-shield" />
            <input
              id="authConfirmPassword"
              ref="confirmRef"
              v-model="confirmPassword"
              :type="showConfirm ? 'text' : 'password'"
              autocomplete="new-password"
              minlength="6"
              placeholder=" "
              :aria-invalid="!!errors.confirm"
              required
            />
            <button
              class="auth-show-password"
              type="button"
              @click="showConfirm = !showConfirm"
            >
              {{ showConfirm ? '隐藏' : '显示' }}
            </button>
          </div>
          <p v-if="errors.confirm" class="auth-error">{{ errors.confirm }}</p>
        </div>

        <div v-if="!isRegister" class="auth-options">
          <label class="auth-check">
            <input id="authRemember" v-model="remember" type="checkbox" /> 记住本次输入的账号
          </label>
          <button class="welcome-link" type="button" @click="onHelp">登录遇到问题？</button>
        </div>

        <label v-else class="auth-check auth-agreement" :class="{ 'is-error': errors.agreement }">
          <input
            id="authAgreement"
            v-model="agreement"
            type="checkbox"
            :aria-invalid="!!errors.agreement"
            aria-describedby="errAgreement"
          />
          <span>我已阅读平台的内容规则与隐私说明（演示选项）</span>
        </label>
        <p v-if="errors.agreement" id="errAgreement" class="auth-error">{{ errors.agreement }}</p>

        <button class="solid-btn auth-submit" type="submit">
          {{ submitLabel }} <AppIcon name="i-arrow" />
        </button>
        </form>
      </Transition>
      </div>

      <div class="auth-divider">前端演示版本</div>

      <button
        ref="demoEnterRef"
        class="outline-btn auth-demo-enter"
        type="button"
        @click="enterPlatform"
      >
        {{ demoEnterLabel }}
      </button>

      <div class="auth-demo-note">
        <AppIcon name="i-info" />
        <span>当前未接入真实账号系统。此表单仅演示界面与基本输入校验，不会创建真实账号、验证校园身份或向服务器发送密码。</span>
      </div>

      <div class="auth-back">
        <button type="button" class="welcome-link" @click="router.push({ name: 'welcome' })">
          ← 返回平台介绍
        </button>
      </div>
    </div>
  </section>
</template>
