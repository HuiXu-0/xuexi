/**
 * GitHub Pages 的 SPA 兜底页。
 *
 * GitHub Pages 是纯静态托管，没有服务端 rewrite：
 * 直接访问 /forum 这类子路由时会返回 404。
 *
 * 解决办法是让 404.html 的内容与 index.html 完全一致 ——
 * 浏览器拿到 404.html 后，Vue Router 会接管并渲染正确的页面，
 * 地址栏也保持用户请求的路径。
 *
 * 注意：这里不做相对路径改写。
 * Vite 构建出的资源引用已带 base（形如 /xuexi/static/xxx.js），
 * 绝对路径在任何深度的 URL 下都能正确解析；
 * 改成相对路径反而会在 /forum/ 这类带尾斜杠的地址下失效。
 *
 * 本脚本在 vite build 之后执行。
 */
import { copyFile, access } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

async function main() {
  const indexPath = resolve(dist, 'index.html')
  const notFoundPath = resolve(dist, '404.html')

  try {
    await access(indexPath)
  } catch {
    console.error('[404] 找不到 dist/index.html，请先执行 vite build')
    process.exit(1)
  }

  await copyFile(indexPath, notFoundPath)
  console.log('[404] 已生成 dist/404.html（SPA 兜底）')
}

main().catch((err) => {
  console.error('[404] 生成失败：', err)
  process.exit(1)
})
