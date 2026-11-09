/**
 * 精确测量截图里卡片块的左右边界。
 *
 * 之前用「白色像素」判断边界不准 —— 卡片圆角外的背景、滚动条区域、
 * 卡片内的大片留白都会被算进去。这里改成**检测卡片边框线**
 * （1px 的浅灰线，#dfe6dd 附近），它才是卡片真正的几何边界。
 *
 * 用法：node scripts/measure-edges.mjs <png...>
 */
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法: node scripts/measure-edges.mjs <png...>')
  process.exit(1)
}

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox'],
})
const page = await browser.newPage()

for (const f of files) {
  const b64 = fs.readFileSync(f).toString('base64')
  const r = await page.evaluate(async (dataUrl) => {
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    const w = img.naturalWidth
    const h = img.naturalHeight
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const px = ctx.getImageData(0, 0, w, h).data

    /* 边框线：灰度接近但不白（180~240），且饱和度低 */
    const isBorder = (i) => {
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      return max >= 170 && max <= 245 && max - min <= 18
    }
    /* 背景是 #f6f7f4 附近，卡片内是纯白 #fff。
       找每行里「连续非背景像素」的最左最右 —— 用饱和度+亮度差来区分。 */
    const isBg = (i) => {
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      /* 背景 #f6f7f4 / 浅灰，都接近白且极低饱和 */
      return r >= 243 && g >= 243 && b >= 240
    }
    const isInk = (i) => !isBg(i) && !isBorder(i)

    const rows = []
    for (let y = 0; y < h; y += 3) {
      let left = -1
      let right = -1
      for (let x = 0; x < w; x++) {
        if (isInk((y * w + x) * 4)) {
          if (left < 0) left = x
          right = x
        }
      }
      if (left >= 0) rows.push({ y, left, right })
    }
    return { w, h, rows }
  }, 'data:image/png;base64,' + b64)

  console.log(`\n=== ${f.split(/[\\/]/).pop()} (${r.w}x${r.h}) ===`)

  /* 取若干采样行，打印该行 ink 的左右边界 */
  const samples = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]
  for (const s of samples) {
    const y = Math.round(r.h * s)
    let best = null
    for (const row of r.rows) {
      if (Math.abs(row.y - y) < 6) {
        best = row
        break
      }
    }
    if (!best) continue
    console.log(
      `  y=${String(best.y).padStart(4)}  墨迹 left=${String(best.left).padStart(4)}  right=${String(best.right).padStart(4)}  ` +
      `宽=${String(best.right - best.left).padStart(4)} (${(((best.right - best.left) / r.w) * 100).toFixed(1)}%)  ` +
      `左留白 ${((best.left / r.w) * 100).toFixed(1)}%  右留白 ${(((r.w - best.right) / r.w) * 100).toFixed(1)}%`
    )
  }
}

await browser.close()
