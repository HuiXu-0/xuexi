/**
 * 路由 ↔ 权限白名单 ↔ 导航 三方一致性自检。
 *
 * 背景：加了新路由但忘了加进 canAccess 白名单，页面会被路由守卫
 * 拦回首页，看起来像「点了没反应」。这个脚本能在提交前发现这类不一致。
 *
 * 用法：node scripts/check-routes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const router = read('src/router/index.js')
const auth = read('src/stores/auth.js')
const dict = read('src/data/dict.js')

/* 1. 路由里定义的所有 name */
const routeNames = [...router.matchAll(/name:\s*'([a-zA-Z]+)'/g)].map((m) => m[1])

/* 2. canAccess 里的三组白名单 */
const grab = (re) => {
  const m = auth.match(re)
  return m ? [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map((y) => y[1]) : []
}
const studentRoutes = grab(/const studentRoutes = \[([^\]]+)\]/)
const teacherRoutes = grab(/const teacherRoutes = \[([^\]]+)\]/)
const adminRoutes = grab(/const adminRoutes = \[([^\]]+)\]/)
const allowed = new Set([...studentRoutes, ...teacherRoutes, ...adminRoutes])

/* 3. 导航里引用的 route */
const navRoutes = [...dict.matchAll(/route:\s*'([a-zA-Z]+)'/g)].map((x) => x[1])

const PUBLIC = ['login', 'welcome']
let bad = 0

console.log('=== 路由 ↔ 权限白名单 ↔ 导航 一致性自检 ===\n')

for (const r of routeNames) {
  if (PUBLIC.includes(r)) continue
  if (!allowed.has(r)) {
    console.log(`  ✗ 路由 ${r} 未加入 canAccess 白名单 —— 访问会被守卫拦回首页`)
    bad++
  }
}

for (const r of new Set(navRoutes)) {
  if (!routeNames.includes(r)) {
    console.log(`  ✗ 导航引用了不存在的路由 ${r}`)
    bad++
  }
}

for (const r of routeNames) {
  if (PUBLIC.includes(r)) continue
  if (allowed.has(r) && !navRoutes.includes(r)) {
    console.log(`  ⚠ 路由 ${r} 可访问，但导航里没有入口`)
  }
}

/* 4. 同一路由被多个导航子项引用 → 下拉菜单会同时高亮多项 */
const navChildren = [...dict.matchAll(/children:\s*\[([^\]]+)\]/g)].flatMap((m) =>
  [...m[1].matchAll(/route:\s*'([a-zA-Z]+)'/g)].map((x) => x[1])
)
const counts = {}
for (const r of navChildren) counts[r] = (counts[r] || 0) + 1
for (const [r, n] of Object.entries(counts)) {
  if (n > 1) {
    console.log(`  ✗ 导航子项里有 ${n} 项指向同一路由 ${r} —— 下拉菜单会同时高亮`)
    bad++
  }
}

console.log(bad ? `\n${bad} 处不一致` : '\n全部一致 ✓')
process.exit(bad ? 1 : 0)
