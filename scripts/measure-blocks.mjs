/**
 * 量活页面上各内容区块的实际宽度，找出不一致的地方。
 * 用法：node scripts/measure-blocks.mjs <path> [viewportWidth]
 */
import { chromium } from 'playwright-core'

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'
const path = process.argv[2] || '/teacher/groups'
const vw = Number(process.argv[3] || 1440)

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 } })
const page = await ctx.newPage()

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.evaluate(() => {
  localStorage.setItem('campus-auth', JSON.stringify({
    role: 'teacher',
    displayName: '教师演示账号',
    contentAdmin: true,
    canReview: true,
  }))
})

await page.goto(BASE + path, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

const info = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      sel,
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      pct: +((r.width / vw) * 100).toFixed(1),
      leftPct: +((r.left / vw) * 100).toFixed(1),
      rightPct: +(((vw - r.right) / vw) * 100).toFixed(1),
    }
  }
  const all = [...document.querySelectorAll('.subpage > *, .page-panel, .group-card, .page-section')]
    .map((el) => {
      const r = el.getBoundingClientRect()
      const cls = typeof el.className === 'string' ? el.className.split(/\s+/)[0] : ''
      const head = el.querySelector('h2, h3, strong')?.textContent?.trim().slice(0, 14) || ''
      return {
        cls,
        head,
        left: Math.round(r.left),
        width: Math.round(r.width),
        pct: +((r.width / vw) * 100).toFixed(1),
        leftPct: +((r.left / vw) * 100).toFixed(1),
        rightPct: +(((vw - r.right) / vw) * 100).toFixed(1),
      }
    })
    .filter((x) => x.width > 0)

  return {
    vw,
    container: pick('.main.container'),
    blocks: all,
  }
})

console.log(`视口 ${info.vw}px\n`)
console.log('容器 .main.container：')
console.log(
  `  宽 ${info.container.width}px  占屏 ${info.container.pct}%  ` +
  `左留白 ${info.container.leftPct}%  右留白 ${info.container.rightPct}%\n`
)

console.log('各区块实际宽度：')
const seen = new Set()
for (const b of info.blocks) {
  const key = b.cls + '|' + b.left + '|' + b.width
  if (seen.has(key)) continue
  seen.add(key)
  console.log(
    `  ${b.cls.padEnd(20)} ${b.head.padEnd(16)} 宽=${String(b.width).padStart(5)} (${String(b.pct).padStart(5)}%)  ` +
    `左${String(b.leftPct).padStart(5)}%  右${String(b.rightPct).padStart(5)}%`
  )
}

await browser.close()
