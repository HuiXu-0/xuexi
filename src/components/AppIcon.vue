<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  /** 符号 id，例如 'i-search' */
  name: { type: String, required: true },
})
</script>

<template>
  <!--
    透传外部 class / style：此前组件写死了 class="icon"，
    调用方无法单独调整尺寸，只能在标签上写内联 style。
    改为 inheritAttrs: false 后手动绑定，才能让 .icon-lg 之类的工具类生效。
  -->
  <svg class="icon" aria-hidden="true" v-bind="$attrs"><use :href="`#${name}`" /></svg>
</template>
