/**
 * 管理员端验证：逐页截图 + 横向溢出检查 + 关键交互（填理由 → 执行 → 审计留痕）。
 * 用法：node scripts/verify-admin.mjs [outDir]
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = process.argv[2] || 'tmp-shots'
fs.mkdirSync(outDir, { recursive: true })

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('campus-auth', JSON.stringify({
    role: 'admin',
    displayName: '管理员演示账号',
    contentAdmin: true,
    canReview: true,
  }))
})

const routes = [
  ['admin-dashboard', '/admin'],
  ['admin-accounts', '/admin/accounts'],
  ['admin-reports', '/admin/reports'],
  ['admin-notices', '/admin/notices'],
  ['admin-feedback', '/admin/feedback'],
  ['admin-rules', '/admin/rules'],
  ['admin-agents', '/admin/agents'],
  ['admin-audit', '/admin/audit'],
  ['admin-config', '/admin/config'],
]

for (const [name, path] of routes) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  const o = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    h1: document.querySelector('h1')?.textContent?.trim(),
    modules: document.querySelectorAll('.admin-module-btn').length,
    rows: document.querySelectorAll('.page-list-row, .review-card, .notice-card, .agent-card').length,
  }))
  const bad = o.scroll > o.client + 1
  console.log(
    `${bad ? '✗' : '✓'} ${name.padEnd(18)} ${path.padEnd(18)} ` +
    `overflow=${bad ? 'YES' : 'no '} 模块=${o.modules} 列表项=${o.rows} h1="${o.h1}"`
  )
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false })
}

/* ---------- 交互验证：高影响操作必须填理由 ---------- */
console.log('\n=== 交互验证 ===')
await page.goto(BASE + '/admin/accounts', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)

// 点「暂时封禁」展开理由面板
const banBtn = page.locator('button', { hasText: '暂时封禁' }).first()
await banBtn.click()
await page.waitForTimeout(400)

const panelVisible = await page.locator('.admin-reason').first().isVisible()
console.log(`${panelVisible ? '✓' : '✗'} 点击「暂时封禁」后理由面板展开`)

// 提交按钮应处于 disabled（理由必填）
const submitBtn = page.locator('.admin-reason button', { hasText: '确认执行' }).first()
const disabled = await submitBtn.isDisabled()
console.log(`${disabled ? '✓' : '✗'} 未填理由时提交按钮禁用`)

// 填理由后应可提交
await page.locator('#adminReason').fill('多次发布无关推广内容，按规则限制发布。')
await page.waitForTimeout(300)
const enabled = await submitBtn.isEnabled()
console.log(`${enabled ? '✓' : '✗'} 填写理由后提交按钮可用`)

await submitBtn.click()
await page.waitForTimeout(600)

/*
 * 审计页要用**站内导航**跳转，不能 page.goto ——
 * 演示态数据全在内存，goto 会重新加载页面导致内存态清空，
 * 刚写入的审计记录也就没了。
 */
await page.click('.admin-module-btn:has-text("操作审计")')
await page.waitForTimeout(700)
const auditText = await page.locator('.page-list-row').first().innerText()
const hasRecord = auditText.includes('暂时封禁')
console.log(`${hasRecord ? '✓' : '✗'} 审计页记录了本次操作：${auditText.split('\n').slice(0, 2).join(' / ')}`)

/* ---------- 权限验证：学生角色访问管理员端应被拦截 ---------- */
await page.evaluate(() => {
  localStorage.setItem('campus-auth', JSON.stringify({
    role: 'student',
    displayName: '学生演示账号',
    contentAdmin: false,
    canReview: false,
  }))
})
await page.goto(BASE + '/admin/accounts', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const finalUrl = page.url()
const blocked = !finalUrl.includes('/admin/accounts')
console.log(`${blocked ? '✓' : '✗'} 学生角色访问 /admin/accounts 被拦截（当前 ${finalUrl}）`)

console.log(`\n控制台错误：${errors.length ? errors.join('\n') : '无'}`)
await browser.close()
