/**
 * 资源引用 ↔ git 索引 一致性自检。
 *
 * ## 为什么需要这个
 *
 * 站点里用 `/assets/xxx.png` 这种**绝对路径**引图片（Vite 会把它处理成
 * 带 hash 的 `/static/*.png`）。这个写法有个隐蔽的坑：
 *
 *   **本地磁盘上有这个文件 → 构建通过；文件没进 git → CI 上构建失败。**
 *
 * 2026-11-28 就踩过：`src/components/SiteFooter.vue` 引用
 * `/assets/haojing-logo.png` 和 `/assets/iflytek-logo.png`，
 * 但这两个文件在某次清理未跟踪文件时被误从索引里删掉了。
 * 本地构建一直是绿的，CI 连续 3 次部署全挂，报
 * `Rollup failed to resolve import "/assets/haojing-logo.png"`。
 *
 * 这个脚本在提交前就能发现它。
 *
 * 用法：node scripts/check-assets.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(process.cwd())

/** 递归列出 src 下的所有文件 */
function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/** 收集源码里对 /assets/xxx 的引用 */
const referenced = new Map() // 资源路径 → 引用它的文件列表
for (const file of walk(path.join(root, 'src'))) {
  if (!/\.(vue|js|css|html)$/.test(file)) continue
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(/["'(](\/assets\/[A-Za-z0-9._-]+)["')]/g)) {
    const asset = m[1]
    if (!referenced.has(asset)) referenced.set(asset, [])
    referenced.get(asset).push(path.relative(root, file))
  }
}

/* git 已跟踪的文件 */
let tracked = new Set()
try {
  const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  tracked = new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))
} catch {
  console.log('  （不在 git 仓库里，跳过跟踪状态检查）')
}

console.log('=== 资源引用 ↔ git 索引 一致性自检 ===\n')

let bad = 0
for (const [asset, files] of [...referenced.entries()].sort()) {
  const rel = asset.replace(/^\//, '')
  const onDisk = fs.existsSync(path.join(root, rel))
  const inGit = tracked.has(rel)

  if (!onDisk) {
    console.log(`  ✗ ${asset} —— 磁盘上不存在，被 ${files[0]} 引用`)
    bad++
  } else if (!inGit) {
    console.log(
      `  ✗ ${asset} —— 磁盘上有但**没有进 git**，CI 上会构建失败（被 ${files[0]} 引用）`,
    )
    bad++
  } else {
    console.log(`  ✓ ${asset}`)
  }
}

/* 反向：assets/ 下有文件但从没被引用 —— 只是提示，不是错误 */
if (tracked.size) {
  const assetFiles = [...tracked].filter((f) => f.startsWith('assets/'))
  const unused = assetFiles.filter((f) => !referenced.has(`/${f}`))
  if (unused.length) {
    console.log(`\n  提示：以下资源已入库但没有被引用：${unused.join('、')}`)
  }
}

console.log(bad ? `\n${bad} 处问题 —— 提交前请先 git add 对应文件` : '\n全部一致 ✓')
process.exit(bad ? 1 : 0)
