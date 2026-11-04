import { ref } from 'vue'

/**
 * 主题切换。
 * 项目全部颜色走 CSS light-dark()，所以只要改 html 的 colorScheme，
 * 整站配色就会跟着翻转 —— 与参考文件 applyTheme 的做法一致。
 */
const theme = ref('light')

const STORAGE_KEY = 'campus-theme'

function resolveInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch (_) {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function initTheme() {
  apply(resolveInitial())
}

function apply(next) {
  theme.value = next
  document.documentElement.style.colorScheme = next
  document.documentElement.dataset.theme = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch (_) {}
}

export function toggleTheme() {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  apply(next)
  return next
}

export function useTheme() {
  return theme
}
