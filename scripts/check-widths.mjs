/**
 * 内容块宽度一致性检查。
 *
 * 背景：用户反馈「宽的宽窄的窄」—— 同一页里出现通栏 1180px、
 * 并排左栏 667px、并排右栏 493px 三种宽度，边缘对不齐。
 *
 * 规则：
 *   1. 同一页里所有 `.page-panel` / `.group-card` 的宽度，
 *      要么都等于容器宽（通栏），要么都等于容器宽的一半（成对并排）。
 *   2. 并排的两栏必须等宽。
 *   3. 所有块的左右边缘必须落在容器的边界上（不允许超出）。
 *
 * 用法：node scripts/check-widths.mjs [视口宽...]
 */
import { chromium } from 'playwright-core'

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'
const viewports = process.argv.slice(2).map(Number)
const widths = viewports.length ? viewports : [1920, 1440, 1280, 1100, 1024]

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

let bad = 0

for (const vw of widths) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: 1000 } })
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

  console.log(`\n=== ${vw}px ===`)

  for (const [name, path] of routes) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(350)

    const r = await page.evaluate(() => {
      const cont = document.querySelector('.main.container')
      if (!cont) return null
      const cr = cont.getBoundingClientRect()
      const cw = Math.round(cr.width)
      const gap = 20 /* --gap-block */
      /* 半栏宽度 = (容器宽 - gap) / 2 */
      const half = Math.round((cw - gap) / 2)

      /* 收集直接子级内容块 */
      const blocks = []
      document.querySelectorAll('.subpage .page-panel, .subpage .group-card, .subpage .page-card-grid, .subpage .page-list').forEach((el) => {
        const b = el.getBoundingClientRect()
        if (b.width < 40) return
        blocks.push({
          w: Math.round(b.width),
          left: Math.round(b.left),
          right: Math.round(b.right),
          title:
            el.querySelector('h2, h3')?.textContent?.trim().slice(0, 12) ||
            el.className.split(/\s+/)[0],
        })
      })
      if (!blocks.length) return null

      /* 去重（同一宽度的块只留一份，但记录数量） */
      const uniq = new Map()
      for (const b of blocks) {
        const k = b.w + '|' + b.left + '|' + b.right
        uniq.set(k, b)
      }
      const list = [...uniq.values()]

      const problems = []
      const isFull = (w) => Math.abs(w - cw) <= 2
      const isHalf = (w) => Math.abs(w - half) <= 2

      for (const b of list) {
        if (isFull(b.w)) {
          /* 通栏：左右都要贴容器边缘 */
          if (Math.abs(b.left - cr.left) > 2) {
            problems.push(`「${b.title}」左边缘 ${b.left} 未对齐容器左缘 ${Math.round(cr.left)}`)
          }
          if (Math.abs(b.right - cr.right) > 2) {
            problems.push(`「${b.title}」右边缘 ${b.right} 未对齐容器右缘 ${Math.round(cr.right)}`)
          }
        } else if (isHalf(b.w)) {
          /* 半栏：必须是并排的左栏或右栏 —— 左栏贴左缘，右栏贴右缘 */
          const isLeft = Math.abs(b.left - cr.left) <= 2
          const isRight = Math.abs(b.right - cr.right) <= 2
          if (!isLeft && !isRight) {
            problems.push(
              `「${b.title}」宽 ${b.w}px 居中摆放（left=${b.left} right=${b.right}），` +
              `既不贴左缘 ${Math.round(cr.left)} 也不贴右缘 ${Math.round(cr.right)}`
            )
          }
        } else {
          problems.push(`「${b.title}」宽 ${b.w}px，不是通栏 ${cw}px 也不是半栏 ${half}px`)
        }
      }

      /* 并排两栏必须成对出现（不能只剩一个半栏） */
      const halfBlocks = list.filter((b) => isHalf(b.w))
      if (halfBlocks.length === 1) {
        problems.push(`存在单个半栏块（${halfBlocks[0].w}px），另一栏缺失或宽度不一致`)
      }

      return { cw, half, problems: [...new Set(problems)] }
    })

    if (!r) continue
    if (r.problems.length) {
      bad++
      console.log(`  ✗ ${name.padEnd(16)} ${path}`)
      for (const p of r.problems) console.log(`      ${p}`)
    }
  }

  await ctx.close()
}

console.log(bad ? `\n${bad} 处宽度不一致` : '\n所有页面宽度一致 ✓')
process.exit(bad ? 1 : 0)
