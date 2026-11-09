/**
 * 全站回归验证：所有路由逐页截图 + 横向溢出检查 + 控制台错误收集。
 * 用途：改动共享样式后确认没有把别的页面挤坏。
 * 用法：node scripts/verify-all.mjs [outDir]
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const outDir = process.argv[2] || 'tmp-shots/all'
fs.mkdirSync(outDir, { recursive: true })

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

async function setRole(role) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.evaluate((r) => {
    localStorage.setItem('campus-auth', JSON.stringify({
      role: r,
      displayName: r === 'admin' ? '管理员演示账号' : r === 'teacher' ? '教师演示账号' : '学生演示账号',
      contentAdmin: r === 'admin',
      canReview: r === 'admin',
    }))
  }, role)
}

const groups = [
  {
    role: 'student',
    routes: [
      ['welcome', '/welcome'],
      ['login', '/login'],
      ['home', '/'],
      ['forum', '/forum'],
      ['notes', '/notes'],
      ['competitions', '/competitions'],
      ['resources', '/resources'],
      ['cases', '/cases'],
      ['planner', '/planner'],
      ['profile', '/profile'],
    ],
  },
  {
    role: 'teacher',
    routes: [
      ['teacher', '/teacher'],
      ['teacher-groups', '/teacher/groups'],
      ['teacher-reviews', '/teacher/reviews'],
      ['teacher-authorizations', '/teacher/authorizations'],
      ['teacher-tasks', '/teacher/tasks'],
      ['teacher-content', '/teacher/content'],
    ],
  },
  {
    role: 'admin',
    routes: [
      ['admin', '/admin'],
      ['admin-accounts', '/admin/accounts'],
      ['admin-reports', '/admin/reports'],
      ['admin-notices', '/admin/notices'],
      ['admin-feedback', '/admin/feedback'],
      ['admin-rules', '/admin/rules'],
      ['admin-agents', '/admin/agents'],
      ['admin-audit', '/admin/audit'],
      ['admin-config', '/admin/config'],
    ],
  },
]

let bad = 0
for (const g of groups) {
  await setRole(g.role)
  console.log(`\n--- ${g.role} ---`)
  for (const [name, path] of g.routes) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(450)
    const o = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      h1: document.querySelector('h1')?.textContent?.trim() || '(无 h1)',
    }))
    const overflow = o.scroll > o.client + 1
    if (overflow) bad++
    console.log(`${overflow ? '✗' : '✓'} ${name.padEnd(22)} ${path.padEnd(24)} ${o.h1}`)
    await page.screenshot({ path: `${outDir}/${g.role}-${name}.png`, fullPage: false })
  }
}

/* ---------- 手机端抽查 ---------- */
console.log('\n--- 手机端（390x844，模拟触摸） ---')
const mctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
})
const mpage = await mctx.newPage()
await mpage.goto(BASE + '/login', { waitUntil: 'networkidle' })
await mpage.evaluate(() => {
  localStorage.setItem('campus-auth', JSON.stringify({
    role: 'admin',
    displayName: '管理员演示账号',
    contentAdmin: true,
    canReview: true,
  }))
})
for (const [name, path] of [['teacher', '/teacher'], ['groups', '/teacher/groups'], ['admin', '/admin']]) {
  await mpage.goto(BASE + path, { waitUntil: 'networkidle' })
  await mpage.waitForTimeout(600)
  const o = await mpage.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    device: document.documentElement.dataset.device,
  }))
  const overflow = o.scroll > o.client + 1
  if (overflow) bad++
  console.log(`${overflow ? '✗' : '✓'} ${name.padEnd(10)} ${path.padEnd(18)} device=${o.device} scroll=${o.scroll} client=${o.client}`)
  await mpage.screenshot({ path: `${outDir}/mobile-${name}.png`, fullPage: false })
}

console.log(`\n横向溢出的页面：${bad} 个`)
console.log(`控制台错误：${errors.length ? errors.join('\n') : '无'}`)
await browser.close()
