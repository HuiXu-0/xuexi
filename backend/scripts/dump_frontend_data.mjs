/**
 * 把前端的静态数据模块导出成 JSON，供 Python 的 migrate_seed.py 使用。
 *
 * 为什么需要这一步：
 * 前端数据在 `src/data/*.js` 里，是 ES 模块。**Python 无法执行 .js**
 * （`importlib.util.spec_from_file_location` 对 .js 返回 None，
 *  因为 Python 没有 JS 加载器）。而 Node 原生支持 ESM
 * （package.json 里已有 "type": "module"），所以由 Node 导出、Python 读取。
 *
 * 用法：
 *   node backend/scripts/dump_frontend_data.mjs [输出路径]
 *   默认输出到 backend/scripts/_frontend_data.json
 */

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const OUT = resolve(process.argv[2] || resolve(HERE, '_frontend_data.json'))

/* Windows 上 import() 必须传 file:// URL —— 直接给 'A:\...' 会被当成
   协议 'a:' 报 ERR_UNSUPPORTED_ESM_URL_SCHEME。 */
const fe = (rel) => pathToFileURL(resolve(REPO_ROOT, rel)).href

/* 前端数据模块。teacher.js 内部 import 了 ./dict.js，Node 会自动解析。 */
const modules = {
  pages: await import(fe('src/data/pages.js')),
  content: await import(fe('src/data/content.js')),
  dict: await import(fe('src/data/dict.js')),
  teacher: await import(fe('src/data/teacher.js')),
}

/* 模块命名空间对象转成普通对象（丢掉 Symbol 键） */
function plain(ns) {
  const out = {}
  for (const key of Object.keys(ns)) out[key] = ns[key]
  return out
}

const payload = {}
for (const [name, ns] of Object.entries(modules)) payload[name] = plain(ns)

/* 统计一下导出了什么，方便对不上时排查 */
const summary = {}
for (const [name, mod] of Object.entries(payload)) {
  summary[name] = Object.entries(mod).map(([k, v]) => {
    const kind = Array.isArray(v) ? `array(${v.length})` : typeof v
    return `${k}:${kind}`
  })
}

writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8')

console.log(`已导出前端数据 → ${OUT}`)
for (const [name, items] of Object.entries(summary)) {
  console.log(`  ${name}: ${items.length} 个导出`)
  for (const it of items) console.log(`     - ${it}`)
}
