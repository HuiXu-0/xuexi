/**
 * 本地联调验证：前端真的能调到后端吗。
 *
 * 覆盖三件事：
 *  1. 搜索走的是**后端**（不是本地静态索引兜底）
 *  2. 管理员端「模型服务」页能读到四张卡片
 *  3. 学生访问模型服务页会被路由守卫拦下
 *
 * 用法：node scripts/verify-local.mjs
 */
import { chromium } from 'playwright-core'

const BASE = process.env.LOCAL_BASE || 'http://127.0.0.1:5173'
const API = process.env.API_BASE || 'http://127.0.0.1:8000'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--no-proxy-server'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

let bad = 0
const check = (ok, label, extra = '') => {
  if (!ok) bad++
  console.log(`  ${ok ? '✓' : '✗'} ${label}${extra ? '  ' + extra : ''}`)
}

async function setRole(role) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.login-screen', { timeout: 20000 })
  await page.evaluate((r) => {
    localStorage.setItem('campus-auth', JSON.stringify({
      role: r,
      displayName: r,
      contentAdmin: r === 'admin',
      canReview: r === 'admin',
    }))
  }, role)
}

/* ── 1. 搜索走真后端 ───────────────────────────────── */
console.log('\n--- 搜索（学生身份）---')
await setRole('student')
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#globalSearch', { timeout: 20000 })

/* 记录与后端的交互，确认真的发出去了 */
const apiCalls = []
page.on('request', (r) => {
  if (r.url().includes('/api/')) apiCalls.push(`${r.method()} ${r.url().replace(API, '')}`)
})
page.on('response', (r) => {
  if (r.url().includes('/api/')) apiCalls.push(`  -> ${r.status()}`)
})

await page.fill('#globalSearch', '线性代数')
await page.click('.search-btn')
await page.waitForTimeout(4000)

const searchState = await page.evaluate(() => {
  const bar = document.querySelector('.search-agent-bar')
  const items = [...document.querySelectorAll('.search-dropdown-item')]
  return {
    bar: bar?.textContent?.trim() || '',
    itemCount: items.length,
    firstTitle: items[0]?.querySelector('strong')?.textContent?.trim() || '',
  }
})
console.log('  后端调用:', apiCalls.length ? apiCalls.join(' | ') : '（无）')
check(searchState.bar.includes('平台真实条目'), '搜索结果显示来自后端', `→ "${searchState.bar}"`)
check(searchState.itemCount > 0, '有搜索结果', `→ ${searchState.itemCount} 条，首条「${searchState.firstTitle}」`)

/* ── 2. 管理员端模型服务页 ─────────────────────────── */
console.log('\n--- 管理员端 · 模型服务 ---')
await setRole('admin')
await page.goto(`${BASE}/admin/models`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('.model-card', { timeout: 20000 })
await page.waitForTimeout(1500)

const modelState = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.model-card')]
  return {
    count: cards.length,
    names: cards.map((c) => c.querySelector('h3')?.textContent?.trim() || ''),
    badges: cards.map((c) => c.querySelector('.page-badge')?.textContent?.trim() || ''),
    masked: cards.map((c) => {
      const dds = [...c.querySelectorAll('.model-card-meta dd')].map((d) => d.textContent.trim())
      return dds[3] || ''
    }),
    hasSecretInPage: document.body.innerText.includes('sk-czw86m7nmr62s9mjb6xz3zlgq1qvnwssue8zu5xrosudxsm0'),
  }
})
check(modelState.count === 4, '渲染出 4 张卡片', `→ ${modelState.count} 张：${modelState.names.join(' / ')}`)
check(modelState.badges.some((b) => b.includes('当前生效')), '有卡片标记为当前生效', `→ ${modelState.badges.join(' / ')}`)
check(modelState.masked.some((m) => m.includes('…')), '密钥显示为掩码', `→ ${modelState.masked.join(' / ')}`)
check(!modelState.hasSecretInPage, '★ 页面里没有明文密钥')

/* ── 3. 学生访问被拦 ───────────────────────────────── */
console.log('\n--- 学生访问模型服务页 ---')
await setRole('student')
await page.goto(`${BASE}/admin/models`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)
const studentUrl = page.url()
check(!studentUrl.includes('/admin/models'), '学生被路由守卫拦下', `→ ${studentUrl}`)

console.log(`\n问题：${bad} 处`)
console.log(`控制台错误：${errors.length ? errors.slice(0, 5).join('\n') : '无'}`)
await browser.close()
process.exit(bad ? 1 : 0)
