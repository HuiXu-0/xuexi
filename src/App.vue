<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import IconSprite from './components/IconSprite.vue'
import SiteHeader from './components/SiteHeader.vue'
import SiteFooter from './components/SiteFooter.vue'
import ModalHost from './components/ModalHost.vue'
import ToastHost from './components/ToastHost.vue'
import { detailContent, policyContent, feedbackSchemas } from './data/details.js'
import { createSchemas } from './data/createSchemas.js'
import {
  openDetail,
  openPolicy,
  openFeedbackForm,
  openCreateForm,
  openPageItem,
  closeModal,
} from './composables/useModal.js'

const router = useRouter()

/**
 * 跨页面复用的动作统一用事件委托处理：
 *   data-item / data-modal / data-modal-close / data-route / data-page-item / data-create
 * 带本地状态的交互（筛选、加入、收藏、审核、Agent 开关等）留在各组件内部。
 */
function onDocumentClick(event) {
  const detail = event.target.closest?.('[data-item]')
  if (detail) {
    event.preventDefault()
    openDetail(detail.dataset.item, event, detailContent)
    return
  }

  const modalBtn = event.target.closest?.('[data-modal]')
  if (modalBtn) {
    event.preventDefault()
    const kind = modalBtn.dataset.modal
    if (kind === 'bug' || kind === 'suggestion') openFeedbackForm(kind, event, feedbackSchemas)
    else if (kind === 'rules' || kind === 'privacy') openPolicy(kind, event, policyContent)
    else if (kind === 'notifications') openDetail('notifications', event, detailContent)
    return
  }

  if (event.target.closest?.('[data-modal-close]')) {
    closeModal()
    return
  }

  const routeBtn = event.target.closest?.('[data-route]')
  if (routeBtn) {
    event.preventDefault()
    router.push({ name: routeBtn.dataset.route })
    return
  }

  const pageItem = event.target.closest?.('[data-page-item]')
  if (pageItem) {
    event.preventDefault()
    openPageItem(pageItem.dataset.pageItem)
    return
  }

  const createBtn = event.target.closest?.('[data-create]')
  if (createBtn) {
    event.preventDefault()
    openCreateForm(createBtn.dataset.create, createSchemas, event)
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <IconSprite />

  <div id="app">
    <SiteHeader />

    <main class="main container" id="top">
      <router-view v-slot="{ Component }">
        <transition enter-active-class="page-enter" leave-active-class="page-exit" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <SiteFooter />
  </div>

  <!-- 弹窗与 Toast 挂到 body，与原页面结构一致（都在 #app 之外） -->
  <Teleport to="body">
    <ModalHost />
    <ToastHost />
  </Teleport>
</template>
