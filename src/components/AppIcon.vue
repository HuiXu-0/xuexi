<script setup>
defineProps({
  /** 符号 id，例如 'i-search' */
  name: { type: String, required: true },
})
</script>

<template>
  <svg class="icon" aria-hidden="true"><use :href="`#${name}`" /></svg>
</template>
