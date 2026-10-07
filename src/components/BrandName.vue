<template>
  <span v-if="title === 'Re;De'" class="brand-name" aria-label="Re;De">Re<span class="brand-name__separator">;</span>De</span>
  <span v-else>{{ title }}</span>
</template>

<script setup>
defineProps({ title: { type: String, default: 'Re;De' } })
</script>

<style scoped>
.brand-name {
  display: inline-block;
  font-family: 'Segoe UI', Arial, sans-serif;
  font-weight: 650;
  letter-spacing: -0.055em;
  line-height: 1;
  white-space: nowrap;
}
.brand-name__separator { color: #126d85; }
:global(html.dark) .brand-name__separator { color: #7adcf5; }
</style>
