import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 部署到 GitHub Pages 时，站点挂在仓库子路径下：
 *   https://<user>.github.io/<repo>/
 * 所有资源路径与路由前缀都要带上 /<repo>/，
 * 否则刷新页面或直接访问子路由会 404。
 *
 * 本地开发默认用 '/'，部署时由构建脚本注入 BASE_PATH。
 */
function resolveBase() {
  const raw = process.env.BASE_PATH || '/'
  /*
   * 归一化：必须是 /xxx 形式的绝对路径，且不能以 / 结尾（除根路径外）。
   *
   * 这里还做一道白名单校验：base 的第一段必须等于仓库名。
   * 原因是 Git Bash（MSYS）会把形如 /xuexi/ 的参数当成 Windows 路径
   * 转成 /workbuddy/... 这种绝对路径 —— 格式合法但完全指错地方，
   * 产出的资源地址会指向不存在的目录，线上直接白屏。
   * 校验后一旦被污染就退回 '/'，宁可路径不对也不能悄悄写坏产物。
   */
  if (!raw.startsWith('/')) return '/'
  const trimmed = raw.replace(/\/+$/, '')
  if (trimmed === '' || trimmed === '/') return '/'

  const repoName = 'xuexi'
  const firstSegment = trimmed.split('/').filter(Boolean)[0]
  if (firstSegment !== repoName) {
    console.warn(
      `[vite] BASE_PATH="${raw}" 与仓库名 "${repoName}" 不符，已退回 "/"（可能是 MSYS 路径转换导致）`
    )
    return '/'
  }
  return trimmed
}

const base = resolveBase()

export default defineConfig({
  base,
  plugins: [vue()],
  build: {
    // assetsDir 设为 static：站点静态图片目录，
    // 避免与 Vite 打包产物目录重名。
    assetsDir: 'static',
  },
})
