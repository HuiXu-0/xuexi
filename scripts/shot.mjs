/**
 * 视口级截图（不缩放），用于人工核对排版观感。
 * 用法：node scripts/shot.mjs <path> <out.png> [scrollY] [width] [height]
 */
import { chromium } from 'playwright-core'

const [, , path = '/teacher', out = 'tmp-shots/shot.png', scrollY = '0', w = '1440', h = '950'] =
  process.argv

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 2,
})
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
await page.waitForTimeout(800)
if (Number(scrollY)) {
  await page.evaluate((y) => window.scrollTo(0, y), Number(scrollY))
  await page.waitForTimeout(500)
}
await page.screenshot({ path: out })
console.log('saved', out)
await browser.close()
