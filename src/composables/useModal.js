import { reactive, nextTick } from 'vue'
import { isMobileDevice } from './useDevice.js'

/**
 * 弹窗状态 + FLIP 展开/收起动画。
 *
 * ModalHost 组件挂载时把 DOM 引用注册进来（registerModalElements），
 * 之后 openModal / closeModal 直接驱动 Web Animations API，
 * 行为与原 HTML 原型一致：从来源卡片位置放大成弹窗，关闭时缩回。
 *
 * 移动端例外：改为从底部滑出的抽屉（见 open / closeModal 中的分支）。
 */

const modal = reactive({
  open: false,
  closing: false,
  kind: null, // 'detail' | 'form' | 'policy' | 'pageItem'
  title: '',
  subtitle: '',
  /** detail / policy 用 */
  body: '',
  fields: [],
  note: '',
  /** form 用 */
  schema: null,
  isCreate: false,
  createKind: '',
  /** pageItem 用 */
  pageTitle: '',
})

let modalEl = null
let backdropEl = null
let closeBtnEl = null

let closeTimer = 0
let modalSeq = 0
let sourceEl = null
let modalAnim = null
let backdropAnim = null
let ignoreBackdropUntil = 0
let lastPointerEvent = null

export function registerModalElements({ modal: m, backdrop, closeBtn }) {
  modalEl = m
  backdropEl = backdrop
  closeBtnEl = closeBtn
}

/* 记录最近一次点击，作为 FLIP 的起始元素来源 */
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      lastPointerEvent = e
    },
    true
  )
}

function clearModalFx() {
  for (const el of [modalEl, backdropEl]) {
    try {
      if (el && el.getAnimations) el.getAnimations().forEach((a) => a.cancel())
    } catch (_) {}
  }
  if (modalEl) {
    modalEl.style.transform = ''
    modalEl.style.opacity = ''
    modalEl.style.borderRadius = ''
    modalEl.style.boxShadow = ''
  }
}

/** 找到用于动画起点的来源元素 */
function getSourceEl(ev) {
  const e = ev || lastPointerEvent
  if (!e || !e.target) return null
  const el = e.target instanceof Element ? e.target : null
  if (!el) return null
  return (
    el.closest(
      '.competition-card, .discover-card, .page-content-card, .group-feature, .group-side, .activity-item, .feedback-band, .notice-strip, .page-list-row, .page-panel, .role-card, .admin-task'
    ) ||
    el.closest(
      '.profile-btn, .icon-btn, [data-item], [data-modal], [data-create], [data-page-item], .footer-links button, .suggestions button, .mini-btn, .outline-btn, .solid-btn'
    ) ||
    el
  )
}

/** 取不受 transform 影响的稳定 rect */
function getStableRect(el) {
  if (!el || !document.contains(el)) return null
  const prevTransform = el.style.transform
  const prevTransition = el.style.transition
  el.style.transition = 'none'
  el.style.transform = 'none'
  void el.offsetWidth
  const rect = el.getBoundingClientRect()
  el.style.transform = prevTransform
  el.style.transition = prevTransition
  void el.offsetWidth
  return rect
}

function flipTransform(fromRect, toRect) {
  const dx = fromRect.left + fromRect.width / 2 - (toRect.left + toRect.width / 2)
  const dy = fromRect.top + fromRect.height / 2 - (toRect.top + toRect.height / 2)
  const sx = fromRect.width / Math.max(toRect.width, 1)
  const sy = fromRect.height / Math.max(toRect.height, 1)
  return { dx, dy, sx, sy }
}

async function open(payload, ev) {
  const seq = ++modalSeq
  clearTimeout(closeTimer)
  Object.assign(modal, {
    open: true,
    closing: false,
    kind: payload.kind,
    title: payload.title || '',
    subtitle: payload.subtitle || '',
    body: payload.body || '',
    fields: payload.fields || [],
    note: payload.note || '',
    schema: payload.schema || null,
    isCreate: !!payload.isCreate,
    createKind: payload.createKind || '',
    pageTitle: payload.pageTitle || '',
  })

  if (!modalEl || !backdropEl) return

  clearModalFx()
  modalAnim = null
  backdropAnim = null
  sourceEl = getSourceEl(ev)
  document.body.classList.add('modal-open')

  const first = sourceEl ? getStableRect(sourceEl) : null
  backdropEl.classList.remove('closing')
  backdropEl.classList.add('open')

  /*
   * 关键：必须等 Vue 把弹窗正文渲染进 DOM 再测量。
   * 原版 openModal 是同步 innerHTML，测到的 last 就是成品尺寸；
   * Vue 的重渲染走 nextTick，若在这里直接 getBoundingClientRect，
   * 拿到的是空壳高度，FLIP 的 scale / translate 全错 ——
   * 弹窗就不会从卡片原位置放大了。
   */
  await nextTick()

  /* await 期间若又发生 open / close，这次测量与动画作废 */
  if (seq !== modalSeq) return

  clearModalFx()
  void modalEl.offsetWidth
  const last = modalEl.getBoundingClientRect()

  backdropAnim = backdropEl.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 300,
    easing: 'ease-out',
    fill: 'both',
  })

  /*
   * 移动端走底部抽屉：从下方滑入，不做 FLIP 缩放。
   * FLIP 是「从来源卡片放大」的横屏逻辑，
   * 在窄屏上既对不上卡片位置，也不符合拇指操作习惯。
   */
  if (isMobileDevice()) {
    modalAnim = modalEl.animate(
      [
        { transform: 'translateY(100%)', opacity: 0.6, borderRadius: '22px 22px 0 0' },
        { transform: 'translateY(0px)', opacity: 1, borderRadius: '22px 22px 0 0' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
    )
    ignoreBackdropUntil = performance.now() + 340
    if (closeBtnEl) closeBtnEl.focus({ preventScroll: true })
    return
  }

  if (first && first.width > 1 && first.height > 1 && last.width > 1 && last.height > 1) {
    const { dx, dy, sx, sy } = flipTransform(first, last)
    modalAnim = modalEl.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          opacity: 0.55,
          borderRadius: '18px',
          boxShadow: '0 10px 28px rgba(0,0,0,.14)',
        },
        {
          transform: 'translate(0px, 0px) scale(1, 1)',
          opacity: 1,
          borderRadius: '22px',
          boxShadow: '0 30px 90px rgba(0,0,0,.22)',
        },
      ],
      { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
    )
  }

  ignoreBackdropUntil = performance.now() + 420
  if (closeBtnEl) closeBtnEl.focus({ preventScroll: true })
}

export function closeModal() {
  modalSeq++
  if (!modal.open || modal.closing) return
  modal.closing = true
  clearTimeout(closeTimer)
  if (modalAnim) {
    modalAnim.cancel()
    modalAnim = null
  }
  if (backdropAnim) {
    backdropAnim.cancel()
    backdropAnim = null
  }
  if (!modalEl || !backdropEl) {
    modal.open = false
    modal.closing = false
    document.body.classList.remove('modal-open')
    return
  }

  const source = sourceEl && document.contains(sourceEl) ? sourceEl : null
  const sourceRect = source ? getStableRect(source) : null
  const modalRect = modalEl.getBoundingClientRect()
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    clearTimeout(closeTimer)
    backdropEl.classList.remove('open', 'closing')
    document.body.classList.remove('modal-open')
    clearModalFx()
    sourceEl = null
    modalAnim = null
    backdropAnim = null
    modal.open = false
    modal.closing = false
    modal.kind = null
    modal.schema = null
    modal.isCreate = false
    modal.createKind = ''
  }

  backdropAnim = backdropEl.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 300,
    easing: 'ease-in',
    fill: 'both',
  })

  /* 移动端抽屉：向下滑出，与开启动画对称 */
  if (isMobileDevice()) {
    modalAnim = modalEl.animate(
      [
        { transform: 'translateY(0px)', opacity: 1, borderRadius: '22px 22px 0 0' },
        { transform: 'translateY(100%)', opacity: 0.4, borderRadius: '22px 22px 0 0' },
      ],
      { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
    )
    modalAnim.finished.then(finish).catch(finish)
    closeTimer = setTimeout(finish, 340)
    return
  }

  if (sourceRect && modalRect.width > 1 && modalRect.height > 1) {
    const { dx, dy, sx, sy } = flipTransform(sourceRect, modalRect)
    modalAnim = modalEl.animate(
      [
        {
          transform: 'translate(0px, 0px) scale(1, 1)',
          opacity: 1,
          borderRadius: '22px',
          boxShadow: '0 30px 90px rgba(0,0,0,.22)',
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          opacity: 0.45,
          borderRadius: '18px',
          boxShadow: '0 10px 28px rgba(0,0,0,.14)',
        },
      ],
      { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
    )
    modalAnim.finished.then(finish).catch(finish)
    closeTimer = setTimeout(finish, 420)
    return
  }

  modalAnim = modalEl.animate(
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.92)' },
    ],
    { duration: 220, easing: 'ease-in', fill: 'both' }
  )
  modalAnim.finished.then(finish).catch(finish)
  closeTimer = setTimeout(finish, 280)
}

/** 点遮罩：动画刚结束的一小段时间内忽略，避免误关 */
export function onBackdropClick() {
  if (performance.now() < ignoreBackdropUntil) return
  closeModal()
}

/* ---------- 各类打开入口 ---------- */

export function openDetail(key, ev, contentMap) {
  const item = contentMap[key]
  if (!item) return
  open({ kind: 'detail', title: item.title, subtitle: item.subtitle, body: item.body, fields: item.fields }, ev)
}

export function openPolicy(kind, ev, policyMap) {
  const data = policyMap[kind]
  if (!data) return
  open({ kind: 'policy', title: data.title, subtitle: data.subtitle, body: data.body, note: data.note }, ev)
}

export function openFeedbackForm(kind, ev, schemaMap) {
  const schema = schemaMap[kind]
  if (!schema) return
  open({ kind: 'form', title: schema.title, subtitle: schema.subtitle, schema, createKind: kind }, ev)
}

export function openCreateForm(kind, schemaMap, ev) {
  const schema = schemaMap[kind]
  if (!schema) return
  open({ kind: 'form', title: schema.title, subtitle: schema.subtitle, schema, isCreate: true, createKind: kind }, ev)
}

export function openPageItem(title) {
  open({
    kind: 'pageItem',
    title,
    subtitle: '模块内容示例',
    body: `这是“${title}”的本地详情演示。正式平台应展示作者或来源、更新时间、可见范围、关联内容和必要的使用许可信息。`,
  })
}

export function useModal() {
  return { modal, closeModal, onBackdropClick }
}
