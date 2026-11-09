/**
 * 教师端排版验证：登录教师角色后逐页截图，并检查横向溢出。
 * 用法：node scripts/verify-teacher.mjs [outDir]
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

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()

async function overflow() {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
}

/* 登录：选教师角色 */
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('campus-auth', JSON.stringify({
    role: 'teacher',
    displayName: '教师演示账号',
    contentAdmin: true,
    canReview: true,
  }))
})

const routes = [
  ['teacher', '/teacher'],
  ['teacher-groups', '/teacher/groups'],
  ['teacher-reviews', '/teacher/reviews'],
  ['teacher-tasks', '/teacher/tasks'],
  ['teacher-content', '/teacher/content'],
  ['teacher-auth', '/teacher/authorizations'],
]

for (const [name, path] of routes) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  const o = await overflow()
  const bad = o.scroll > o.client + 1
  console.log(`${bad ? '✗' : '✓'} ${name.padEnd(16)} ${path.padEnd(24)} scroll=${o.scroll} client=${o.client}`)
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true })
}

/* 关键字号实测 */
await page.goto(BASE + '/teacher', { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const metrics = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const cs = getComputedStyle(el)
    return { fontSize: cs.fontSize, lineHeight: cs.lineHeight }
  }
  return {
    listTitle: pick('.page-list-content strong'),
    listBody: pick('.page-list-content p'),
    chip: pick('.admin-item-chip'),
    badge: pick('.page-badge'),
    panel: pick('.page-panel'),
  }
})
console.log('\n字号实测:', JSON.stringify(metrics, null, 2))

await browser.close()
