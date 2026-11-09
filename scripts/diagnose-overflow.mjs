/**
 * 横向溢出诊断：找出把 body 撑宽的元素。
 *
 * 症状：页面内容右侧被截断、左右留白不对称。
 * 常见根因：grid 的 `1fr` 没写 `minmax(0, 1fr)`（min-content 撑破）、
 *           flex 子项没写 `min-width: 0`、固定 min-width 的表格。
 *
 * 用法：node scripts/diagnose-overflow.mjs [宽1 宽2 ...]
 */
import { chromium } from 'playwright-core'

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'
const widths = process.argv.slice(2).map(Number)
const viewports = widths.length ? widths : [2549, 1920, 1440, 1280, 1100, 1024, 960, 820, 780, 640, 414, 390]

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})

const routes = [
  ['teacher', '/teacher'],
  ['groups', '/teacher/groups'],
  ['reviews', '/teacher/reviews'],
  ['tasks', '/teacher/tasks'],
  ['content', '/teacher/content'],
  ['auth', '/teacher/authorizations'],
  ['admin', '/admin'],
  ['admin-accounts', '/admin/accounts'],
  ['admin-reports', '/admin/reports'],
  ['admin-notices', '/admin/notices'],
  ['admin-feedback', '/admin/feedback'],
  ['admin-rules', '/admin/rules'],
  ['admin-agents', '/admin/agents'],
  ['admin-audit', '/admin/audit'],
  ['admin-config', '/admin/config'],
  ['home', '/'],
  ['forum', '/forum'],
  ['notes', '/notes'],
  ['cases', '/cases'],
  ['resources', '/resources'],
  ['competitions', '/competitions'],
  ['planner', '/planner'],
  ['profile', '/profile'],
]

let totalBad = 0

for (const w of viewports) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 1000 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.evaluate(() => {
    localStorage.setItem('campus-auth', JSON.stringify({
      role: 'admin',
      displayName: '管理员演示账号',
      contentAdmin: true,
      canReview: true,
    }))
  })

  const bad = []
  for (const [name, path] of routes) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(350)
    const info = await page.evaluate(() => {
      const de = document.documentElement
      const over = de.scrollWidth - de.clientWidth
      if (over <= 1) return null
      /* 找出右边界超出视口的元素 */
      const limit = de.clientWidth
      const culprits = []
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) return
        if (r.right > limit + 1) {
          const cs = getComputedStyle(el)
          culprits.push({
            sel:
              el.tagName.toLowerCase() +
              (el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                : ''),
            right: Math.round(r.right),
            width: Math.round(r.width),
            overflowX: cs.overflowX,
            minWidth: cs.minWidth,
          })
        }
      })
      /* 只保留"最外层"的元凶：自身溢出但父元素没溢出的 */
      return { over, culprits: culprits.slice(0, 6) }
    })
    if (info) bad.push({ name, path, ...info })
  }

  if (bad.length) {
    totalBad += bad.length
    console.log(`\n✗ ${w}px —— ${bad.length} 个页面溢出`)
    for (const b of bad) {
      console.log(`   ${b.name.padEnd(16)} 溢出 ${b.over}px`)
      for (const c of b.culprits) {
        console.log(
          `      ${c.sel.slice(0, 58).padEnd(58)} right=${c.right} w=${c.width} overflowX=${c.overflowX} minWidth=${c.minWidth}`
        )
      }
    }
  } else {
    console.log(`✓ ${w}px —— 全部页面无溢出`)
  }
  await ctx.close()
}

console.log(`\n总计 ${totalBad} 处溢出`)
await browser.close()
