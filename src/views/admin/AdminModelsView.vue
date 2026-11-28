<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import AdminShell from '../../components/AdminShell.vue'
import AppIcon from '../../components/AppIcon.vue'
import AdminReasonForm from '../../components/AdminReasonForm.vue'
import { apiFetch, pingBackend } from '../../services/api.js'
import { showToast } from '../../composables/useToast.js'

/**
 * 模型服务管理（管理端第 10 个模块）。
 *
 * 界面上是四张卡片：内置 / DeepSeek / MiniMax / 自定义。
 * 管理员可以切换平台当前生效的模型服务、填写密钥、测试连通性。
 *
 * ## 三条硬约束
 *
 * 1. **密钥只写不读**：后端加密存库，接口只回掩码（`sk-cz…xsm0`）。
 *    编辑时留空表示「不修改现有密钥」，不会把明文带回来。
 * 2. **切换是高影响操作**：会立刻改变审核/搜索/规划三个 Agent 的行为，
 *    所以必须填理由，并写入审计日志。
 * 3. **协议是一等属性**：DeepSeek/MiniMax 是 OpenAI 兼容（/v1/chat/completions），
 *    内置服务是 Anthropic 兼容（/v1/messages）。同一地址协议不同则请求体完全不同，
 *    所以卡片上要能选协议，不能只有「地址 + 密钥」。
 */

/** 四张卡片的固定结构（自定义卡片的地址与密钥由管理员填） */
const CARD_DEFS = [
  {
    code: 'builtin',
    name: '内置服务',
    icon: 'i-spark',
    desc: '平台自带的模型服务，由平台方承担调用成本。切换到它不需要自备密钥。',
    protocol: 'anthropic',
    editable: true,
  },
  {
    code: 'deepseek',
    name: 'DeepSeek',
    icon: 'i-search',
    desc: 'DeepSeek 官方服务，OpenAI 兼容协议。使用需自行填写 API Key。',
    protocol: 'openai',
    editable: true,
  },
  {
    code: 'minimax',
    name: 'MiniMax',
    icon: 'i-file',
    desc: 'MiniMax 官方服务，OpenAI 兼容协议。使用需自行填写 API Key。',
    protocol: 'openai',
    editable: true,
  },
  {
    code: 'custom',
    name: '自定义服务',
    icon: 'i-grid',
    desc: '自建服务或第三方代理。需填写 API 地址、API Key、模型名与协议类型。',
    protocol: 'openai',
    editable: true,
  },
]

const providers = ref([])
const activeId = ref('')
const loading = ref(false)
const loadError = ref('')
const backend = reactive({ ok: false, message: '未检测' })

/** 自定义表单 */
const form = reactive({
  open: false,
  code: 'custom',
  name: '自定义服务',
  protocol: 'openai',
  base_url: '',
  api_key: '',
  default_model: '',
  reason: '',
})

/** 正在填写理由的动作：{ type, code } */
const pending = ref({ type: '', code: '' })

const PROVIDER_PROTOCOL_LABEL = {
  anthropic: 'Anthropic 兼容（/v1/messages）',
  openai: 'OpenAI 兼容（/v1/chat/completions）',
}

/** 把后端返回的 provider 列表拼上卡片定义 */
const cards = computed(() =>
  CARD_DEFS.map((def) => {
    const p = providers.value.find((x) => x.code === def.code)
    return {
      ...def,
      provider: p || null,
      id: p?.id || '',
      protocol: p?.protocol || def.protocol,
      baseUrl: p?.base_url || '',
      model: p?.default_model || '',
      masked: p?.api_key_masked || '',
      hasKey: !!p?.has_api_key,
      enabled: p?.enabled ?? true,
      isActive: p?.id ? p.id === activeId.value : false,
      exists: !!p,
    }
  })
)

async function load() {
  loading.value = true
  loadError.value = ''
  const ping = await pingBackend()
  backend.ok = ping.ok
  backend.message = ping.ok
    ? `后端已连接${ping.llm_enabled ? '' : '（未启用模型服务）'}`
    : ping.message
  if (!ping.ok) {
    loadError.value = ping.message
    loading.value = false
    return
  }
  try {
    const data = await apiFetch('/api/admin/llm-providers')
    providers.value = data.items || []
    activeId.value = data.active_id || ''
  } catch (err) {
    loadError.value = err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)

/** 打开配置表单（自定义卡片首次是「新建」，其余是「修改」） */
function openForm(card) {
  form.open = true
  form.code = card.code
  form.name = card.provider?.name || card.name
  form.protocol = card.protocol || 'openai'
  form.base_url = card.baseUrl || (card.code === 'custom' ? '' : card.baseUrl)
  form.api_key = ''
  form.default_model = card.model || ''
  form.reason = ''
}

function closeForm() {
  form.open = false
}

async function saveForm() {
  if (!form.reason.trim()) {
    showToast('请填写变更理由（会写入审计记录）。')
    return
  }
  if (!form.base_url.trim()) {
    showToast('请填写 API 地址。')
    return
  }
  try {
    await apiFetch('/api/admin/llm-providers', {
      method: 'POST',
      body: {
        code: form.code,
        name: form.name || form.code,
        protocol: form.protocol,
        base_url: form.base_url.trim(),
        api_key: form.api_key.trim(),
        default_model: form.default_model.trim(),
        enabled: true,
        sort_order: 40,
        reason: form.reason.trim(),
      },
    })
    showToast('已保存模型服务配置。')
    form.open = false
    form.api_key = ''
    await load()
  } catch (err) {
    showToast(err?.message || '保存失败。')
  }
}

/** 设为当前生效（高影响，走理由表单） */
function askActivate(card) {
  pending.value = { type: 'activate', code: card.code }
}

function cancel() {
  pending.value = { type: '', code: '' }
}

async function confirm({ reason }) {
  const card = cards.value.find((c) => c.code === pending.value.code)
  if (!card) return
  if (!reason?.trim()) {
    showToast('请填写切换理由。')
    return
  }
  try {
    const data = await apiFetch(`/api/admin/llm-providers/${card.id}/activate`, {
      method: 'POST',
      body: { reason: reason.trim() },
    })
    showToast(data.message || '已切换。')
    await load()
  } catch (err) {
    showToast(err?.message || '切换失败。')
  } finally {
    cancel()
  }
}

/** 连通性测试 */
async function test(card) {
  if (!card.id) {
    showToast('该卡片还没有保存过配置。')
    return
  }
  showToast('正在测试连接…')
  try {
    const data = await apiFetch(`/api/admin/llm-providers/${card.id}/test`, { method: 'POST' })
    showToast(data.ok ? data.message : data.message || '连接失败。')
  } catch (err) {
    showToast(err?.message || '测试失败。')
  }
}
</script>

<template>
  <AdminShell
    module="models"
    title="模型服务管理"
    desc="选择平台当前生效的大模型服务。切换会立刻改变搜索、审核与学习规划三个 Agent 的行为。"
  >
    <template #actions>
      <span class="page-badge" :class="backend.ok ? 'green' : 'amber'">
        {{ backend.ok ? '后端已连接' : '后端未连接' }}
      </span>
      <button class="mini-btn" :disabled="loading" @click="load">
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </template>

    <div class="page-callout">
      <AppIcon name="i-info" />
      <div>
        API Key 只写不读 —— 平台加密保存，界面只显示掩码（形如 <code>sk-cz…xsm0</code>），
        编辑时留空表示「不修改现有密钥」。切换模型服务属于高影响操作，必须写明理由并留审计记录。
        自定义地址不允许指向内网或云元数据地址。
      </div>
    </div>

    <div v-if="loadError" class="page-callout warn">
      <AppIcon name="i-warning" />
      <div>无法读取后端配置：{{ loadError }}。请确认后端服务已启动（默认 http://127.0.0.1:8000）。</div>
    </div>

    <div class="model-card-grid">
      <article
        v-for="card in cards"
        :key="card.code"
        class="model-card"
        :class="{ active: card.isActive, dim: !card.hasKey && card.code !== 'custom' }"
      >
        <header class="model-card-head">
          <span class="model-card-icon"><AppIcon :name="card.icon" /></span>
          <div class="model-card-title">
            <h3>{{ card.provider?.name || card.name }}</h3>
            <span class="admin-item-chip">{{ card.code }}</span>
          </div>
          <span class="page-badge" :class="card.isActive ? 'green' : 'gray'">
            {{ card.isActive ? '当前生效' : card.exists ? '可切换' : '未配置' }}
          </span>
        </header>

        <p class="model-card-desc">{{ card.desc }}</p>

        <dl class="model-card-meta">
          <div><dt>协议</dt><dd>{{ PROVIDER_PROTOCOL_LABEL[card.protocol] || card.protocol }}</dd></div>
          <div><dt>模型</dt><dd>{{ card.model || '（未填写）' }}</dd></div>
          <div><dt>API 地址</dt><dd class="mono">{{ card.baseUrl || '（未填写）' }}</dd></div>
          <div><dt>API Key</dt><dd class="mono">{{ card.masked || '（未配置）' }}</dd></div>
        </dl>

        <div class="page-actions mt-12">
          <button
            class="mini-btn"
            :disabled="!card.id || card.isActive || !card.hasKey"
            @click="askActivate(card)"
          >
            {{ card.isActive ? '生效中' : '设为当前生效' }}
          </button>
          <button class="mini-btn" :disabled="!card.id" @click="test(card)">测试连通</button>
          <button class="mini-btn" @click="openForm(card)">配置</button>
        </div>

        <AdminReasonForm
          :open="pending.type === 'activate' && pending.code === card.code"
          action="切换当前生效的模型服务"
          hint="请说明切换原因与影响范围。切换会立即改变审核、搜索与学习规划的判定行为。"
          :case-no="card.code"
          danger
          confirm-text="确认切换（高影响）"
          @cancel="cancel"
          @confirm="confirm"
        />
      </article>
    </div>

    <!-- 自定义配置表单（内联展开，不用 ModalHost） -->
    <section v-if="form.open" class="model-form">
      <h3>配置「{{ form.code === 'custom' ? '自定义服务' : form.name }}」</h3>
      <p class="page-lead">
        API Key 留空表示不修改现有密钥。保存会写入审计记录。
      </p>

      <div class="page-layout-two">
        <label class="field">
          <span>名称</span>
          <input v-model="form.name" type="text" placeholder="显示在卡片上的名字" />
        </label>
        <label class="field">
          <span>协议类型</span>
          <select v-model="form.protocol">
            <option value="openai">OpenAI 兼容（/v1/chat/completions）</option>
            <option value="anthropic">Anthropic 兼容（/v1/messages）</option>
          </select>
        </label>
        <label class="field">
          <span>API 地址</span>
          <input
            v-model="form.base_url"
            type="text"
            placeholder="如 https://api.deepseek.com/v1"
          />
        </label>
        <label class="field">
          <span>模型名</span>
          <input v-model="form.default_model" type="text" placeholder="如 deepseek-chat" />
        </label>
        <label class="field">
          <span>API Key</span>
          <input
            v-model="form.api_key"
            type="password"
            placeholder="留空表示不修改"
            autocomplete="new-password"
          />
        </label>
        <label class="field">
          <span>变更理由（必填）</span>
          <input v-model="form.reason" type="text" placeholder="会写入审计记录" />
        </label>
      </div>

      <div class="page-actions mt-12">
        <button class="mini-btn" @click="saveForm">保存配置</button>
        <button class="mini-btn" @click="closeForm">取消</button>
      </div>
    </section>
  </AdminShell>
</template>

<style scoped>
.model-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}
.model-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.model-card.active {
  border-color: var(--green);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--green) 35%, transparent);
}
.model-card.dim { opacity: 0.82; }
.model-card-head { display: flex; align-items: center; gap: 10px; }
.model-card-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--surface-tint);
  color: var(--green);
  flex: 0 0 auto;
}
.model-card-title { display: flex; align-items: center; gap: 8px; flex: 1 1 auto; min-width: 0; }
.model-card-title h3 { margin: 0; font-size: var(--fs-list-title, 13.5px); }
.model-card-desc { margin: 0; color: var(--text-soft); font-size: var(--fs-list-body, 12.5px); line-height: 1.6; }
.model-card-meta { display: flex; flex-direction: column; gap: 6px; margin: 0; }
.model-card-meta > div { display: flex; gap: 10px; align-items: baseline; }
.model-card-meta dt { flex: 0 0 64px; margin: 0; color: var(--text-faint); font-size: var(--fs-list-meta, 11.5px); }
.model-card-meta dd { margin: 0; color: var(--text-soft); font-size: var(--fs-list-meta, 11.5px); word-break: break-all; }
.model-card-meta dd.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.model-form {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
}
.model-form h3 { margin: 0 0 6px; font-size: var(--fs-list-title, 13.5px); }
@media (max-width: 780px) {
  .model-card-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
