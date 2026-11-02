<script setup>
import { useToast } from '../composables/useToast.js'

const toast = useToast()
</script>

<template>
  <div class="toast" :class="{ show: toast.visible }" role="status">{{ toast.message }}</div>
</template>
