/**
 * 分析截图里的白色卡片边界，量出各区块的实际宽度比例。
 * 用法：node scripts/measure-shot.mjs <png1> [png2 ...]
 */
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('用法: node scripts/measure-shot.mjs <png...>')
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

    /* 找出每一行里"非背景色"的左右边界。
       背景是浅灰 #f6f7f4，卡片是纯白 #ffffff。
       这里只找纯白卡片块的边界 —— 更贴近用户关心的"内容块宽度"。 */
    const isWhite = (i) => px[i] >= 250 && px[i + 1] >= 250 && px[i + 2] >= 250
    const rows = []
    for (let y = 0; y < h; y += 4) {
      let left = -1
      let right = -1
      for (let x = 0; x < w; x++) {
        if (isWhite((y * w + x) * 4)) {
          if (left < 0) left = x
          right = x
        }
      }
      /* 连续白色跨度超过 40% 宽度才算卡片行 */
      if (left >= 0 && right - left > w * 0.4) {
        rows.push({ y, left, right, width: right - left })
      }
    }
    /* 合并相邻行 */
    const blocks = []
    for (const row of rows) {
      const last = blocks[blocks.length - 1]
      if (last && row.y - last.yEnd <= 8 && Math.abs(row.left - last.left) < 12) {
        last.yEnd = row.y
        last.right = Math.max(last.right, row.right)
        last.width = last.right - last.left
      } else {
        blocks.push({ yStart: row.y, yEnd: row.y, left: row.left, right: row.right, width: row.width })
      }
    }
    return { w, h, blocks }
  }, 'data:image/png;base64,' + b64)

  console.log(`\n=== ${f.split(/[\\/]/).pop()} (${r.w}x${r.h}) ===`)
  for (const b of r.blocks) {
    console.log(
      `  y=${String(b.yStart).padStart(4)}  left=${String(b.left).padStart(4)}  ` +
      `right=${String(b.right).padStart(4)}  宽=${String(b.width).padStart(4)}  ` +
      `占屏宽 ${((b.width / r.w) * 100).toFixed(1)}%  ` +
      `左留白 ${((b.left / r.w) * 100).toFixed(1)}%  右留白 ${(((r.w - b.right) / r.w) * 100).toFixed(1)}%`
    )
  }
}

await browser.close()
