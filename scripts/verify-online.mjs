/**
 * 线上验证：直接跑线上地址，确认部署后的实际表现。
 * 用法：PREVIEW_BASE=https://huixu-0.github.io/xuexi node scripts/verify-online.mjs
 */
import { chromium } from 'playwright-core'

const BASE = process.env.PREVIEW_BASE || 'https://huixu-0.github.io/xuexi'

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
  ['teacher', [['teacher', '/teacher'], ['groups', '/teacher/groups'], ['reviews', '/teacher/reviews']]],
  [
    'admin',
    [
      ['admin', '/admin'],
      ['accounts', '/admin/accounts'],
      ['reports', '/admin/reports'],
      ['notices', '/admin/notices'],
      ['feedback', '/admin/feedback'],
      ['rules', '/admin/rules'],
      ['agents', '/admin/agents'],
      ['audit', '/admin/audit'],
      ['config', '/admin/config'],
    ],
  ],
]

let bad = 0
for (const [role, routes] of groups) {
  await setRole(role)
  console.log(`\n--- 线上 ${role} ---`)
  for (const [name, path] of routes) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    const o = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      h1: document.querySelector('h1')?.textContent?.trim() || '(无)',
      modules: document.querySelectorAll('.admin-module-btn').length,
    }))
    const overflow = o.scroll > o.client + 1
    if (overflow) bad++
    console.log(`${overflow ? '✗' : '✓'} ${name.padEnd(12)} ${path.padEnd(18)} ${o.h1}`)
  }
}

/* 字号实测（确认线上加载的是新样式） */
await setRole('teacher')
await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const m = await page.evaluate(() => {
  const pick = (s) => {
    const el = document.querySelector(s)
    return el ? getComputedStyle(el).fontSize : null
  }
  return {
    列表标题: pick('.page-list-content strong'),
    列表正文: pick('.page-list-content p'),
    标签: pick('.admin-item-chip'),
  }
})
console.log('\n线上字号实测：', JSON.stringify(m, null, 0))

console.log(`\n横向溢出：${bad} 个`)
console.log(`控制台错误：${errors.length ? errors.join('\n') : '无'}`)
await browser.close()
