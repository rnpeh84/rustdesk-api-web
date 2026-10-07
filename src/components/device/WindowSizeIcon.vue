<template>
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path v-if="restore" d="M3 8h5V3M8 8 3 3m14 9h-5v5m0-5 5 5"/>
    <path v-else d="M8 3H3v5m0-5 6 6m3 8h5v-5m0 5-6-6"/>
  </svg>
</template>
<script setup>
defineProps({ restore: { type: Boolean, default: false } })
</script>