import { ref, computed } from 'vue'

/**
 * 设备识别。
 *
 * CSS 媒体查询只能按「视口有多宽」分档，无法区分
 * 「用户拿手机打开」和「用户在桌面上把窗口拖窄」这两种情况。
 * 这里用 JS 额外判定设备类型，作为全局样式钩子：
 *   document.documentElement.dataset.device = 'mobile' | 'desktop'
 *
 * 平板（iPad 等）按桌面处理，不单独做适配。
 */

/** 设备类型：只有手机与桌面两档，平板归入桌面 */
const device = ref('desktop')

/** 视口实际高度（CSS 的 100vh 在移动端浏览器会被地址栏算错，这里用 JS 实测） */
const viewportHeight = ref(0)

/**
 * 判断 UA 是否为手机。
 * 平板一律排除 —— iPad（含 iPadOS 13+ 伪装成 Macintosh 的）
 * 都按桌面处理。
 */
function isMobileUA(ua, maxTouchPoints) {
  if (!ua) return false

  /* iPad：显式 iPad，以及 iPadOS 13+ 伪装成 Macintosh（靠触摸点数区分） */
  if (/iPad/i.test(ua)) return false
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return false

  /* 明确的手机 */
  if (/Android.*Mobile/i.test(ua)) return true
  if (/iPhone|iPod/i.test(ua)) return true
  if (/Windows Phone|IEMobile|BlackBerry|BB10|Opera Mini|webOS|BlackBerry/i.test(ua)) return true

  /* 其余带 Mobile 关键字的（部分安卓浏览器、Kindle 等） */
  if (/Mobile/i.test(ua)) return true

  return false
}

/**
 * 读取 URL 上的强制参数：?device=mobile / ?device=desktop
 * 用于在电脑浏览器上直接预览手机版，不必真机反复测试。
 */
function forcedDevice() {
  if (typeof window === 'undefined') return ''
  try {
    const v = new URLSearchParams(window.location.search).get('device')
    return v === 'mobile' || v === 'desktop' ? v : ''
  } catch (_) {
    return ''
  }
}

/** 综合 UA 与调试参数得出设备类型 */
export function detectDevice() {
  const forced = forcedDevice()
  if (forced) return forced

  if (typeof navigator === 'undefined') return 'desktop'

  const ua = navigator.userAgent || ''
  const maxTouchPoints = navigator.maxTouchPoints || 0

  return isMobileUA(ua, maxTouchPoints) ? 'mobile' : 'desktop'
}

/** 把设备类型写到 html 上，供 CSS 选择器使用 */
function applyDevice(next) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.device = next
  device.value = next
}

/** 写入视口高度，规避移动端 100vh 被地址栏算错的问题 */
function applyViewportHeight() {
  if (typeof window === 'undefined') return
  viewportHeight.value = window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}

/**
 * 初始化。main.js 在挂载前调用。
 * 内联脚本（index.html）已经先做过一次判定避免首屏闪烁，
 * 这里再做一次保证与运行时状态一致。
 */
export function initDevice() {
  applyDevice(detectDevice())
  applyViewportHeight()

  if (typeof window === 'undefined') return

  /* 转屏、折叠屏展开、拖动窗口都可能改变设备判定 */
  let resizeTimer = 0
  const onResize = () => {
    applyViewportHeight()
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      /* 强制参数存在时始终保持用户指定的设备 */
      const forced = forcedDevice()
      if (!forced) applyDevice(detectDevice())
    }, 150)
  }

  window.addEventListener('resize', onResize, { passive: true })
  window.addEventListener('orientationchange', onResize, { passive: true })
}

/**
 * 当前是否为移动端。
 * 优先读 html 上的 data-device（首屏内联脚本已写入，最准），
 * 没有时回退到实时判定。非响应式，供 useModal 这类命令式代码使用。
 */
export function isMobileDevice() {
  if (typeof document !== 'undefined' && document.documentElement.dataset.device) {
    return document.documentElement.dataset.device === 'mobile'
  }
  return detectDevice() === 'mobile'
}

export function useDevice() {
  return {
    device,
    isMobile: computed(() => device.value === 'mobile'),
    isDesktop: computed(() => device.value === 'desktop'),
    viewportHeight,
    detectDevice,
  }
}
