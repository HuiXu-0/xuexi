<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { isMobileDevice } from '../composables/useDevice.js'

/**
 * 首页 Hero 的圆点粒子网络动画。
 * 原型里是 IIFE + 手动清理；这里用组件生命周期管理 ResizeObserver /
 * IntersectionObserver / requestAnimationFrame，离开路由时正确释放。
 */
const canvasRef = ref(null)

let observer = null
let io = null
let raf = 0
let w = 0
let h = 0
let dpr = 1
let dots = []
let palette = null
let hostEl = null
let ctx = null

const LINK_DIST = 118
const LINK_DIST_SQ = LINK_DIST * LINK_DIST

function getCtx() {
  if (!ctx) ctx = canvasRef.value?.getContext('2d')
  return ctx
}

function spawnDot(anywhere) {
  return {
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : Math.random() < 0.5 ? -8 : h + 8,
    r: 1.2 + Math.random() * 2.4,
    vx: (Math.random() - 0.5) * 0.38,
    vy: (Math.random() - 0.5) * 0.38,
    pulse: Math.random() * Math.PI * 2,
    hue: Math.random(),
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas || !hostEl) return
  const rect = hostEl.getBoundingClientRect()
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = rect.width
  h = rect.height
  canvas.width = Math.max(1, Math.floor(w * dpr))
  canvas.height = Math.max(1, Math.floor(h * dpr))
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const context = getCtx()
  if (!context) return
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  const count = Math.round(Math.min(64, Math.max(28, (w * h) / 14000)))
  if (dots.length !== count) {
    dots = Array.from({ length: count }, () => spawnDot(true))
  }
}

function readPalette() {
  const styles = getComputedStyle(hostEl)
  return {
    green: styles.getPropertyValue('--green').trim() || '#2f6348',
    blue: styles.getPropertyValue('--blue').trim() || '#4f6e92',
  }
}

function tick() {
  const context = getCtx()
  if (!context) return
  context.clearRect(0, 0, w, h)
  const { green, blue } = palette

  for (let i = 0; i < dots.length; i++) {
    const a = dots[i]
    for (let j = i + 1; j < dots.length; j++) {
      const b = dots[j]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const distSq = dx * dx + dy * dy
      if (distSq < LINK_DIST_SQ) {
        context.beginPath()
        context.strokeStyle = green
        context.globalAlpha = (1 - Math.sqrt(distSq) / LINK_DIST) * 0.22
        context.lineWidth = 1
        context.moveTo(a.x, a.y)
        context.lineTo(b.x, b.y)
        context.stroke()
      }
    }
  }

  for (const d of dots) {
    d.x += d.vx
    d.y += d.vy
    d.pulse += 0.022
    if (d.x < -12 || d.x > w + 12 || d.y < -12 || d.y > h + 12) {
      Object.assign(d, spawnDot(false))
    }
    const glow = 1 + Math.sin(d.pulse) * 0.35
    const radius = d.r * glow
    context.globalAlpha = 0.38 + Math.sin(d.pulse) * 0.16
    context.beginPath()
    context.fillStyle = d.hue > 0.72 ? blue : green
    context.arc(d.x, d.y, radius, 0, Math.PI * 2)
    context.fill()
    context.globalAlpha = 0.1
    context.beginPath()
    context.arc(d.x, d.y, radius * 3.2, 0, Math.PI * 2)
    context.fill()
  }

  context.globalAlpha = 1
  raf = requestAnimationFrame(tick)
}

function start() {
  if (!raf) tick()
}

function stop() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

onMounted(() => {
  const canvas = canvasRef.value
  hostEl = canvas?.closest('.hero')
  if (!canvas || !hostEl) return

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    canvas.style.display = 'none'
    return
  }

  /*
   * 移动端不跑粒子动画。
   * 手机上持续 requestAnimationFrame 会抢占主线程，
   * 拖动页面时明显掉帧，且额外耗电；窄屏上粒子效果本身也看不清。
   */
  if (isMobileDevice()) {
    canvas.style.display = 'none'
    return
  }

  palette = readPalette()

  try {
    observer = new ResizeObserver(() => resize())
    observer.observe(hostEl)
  } catch (_) {
    window.addEventListener('resize', resize)
  }

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener?.('change', () => {
      setTimeout(() => {
        palette = readPalette()
      }, 30)
    })

  resize()
  tick()

  try {
    io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start()
        else stop()
      },
      { threshold: 0 }
    )
    io.observe(hostEl)
  } catch (_) {}
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  io?.disconnect()
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <canvas ref="canvasRef" class="hero-canvas" aria-hidden="true"></canvas>
</template>
