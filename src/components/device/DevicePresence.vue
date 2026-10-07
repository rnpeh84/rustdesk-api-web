<template>
  <el-tooltip :content="T(online ? 'Online' : 'Offline')">
    <span class="device-presence-icon" :class="{ 'is-online': online }" role="img" :aria-label="T(online ? 'Online' : 'Offline')" :tabindex="focusable ? 0 : undefined">
      <el-icon aria-hidden="true"><CircleCheck v-if="online"/><CircleClose v-else/></el-icon>
    </span>
  </el-tooltip>
</template>

<script setup>
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
defineProps({ online: { type: Boolean, default: false }, focusable: { type: Boolean, default: true } })
</script>

<style scoped>
.device-presence-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; flex-shrink: 0; font-size: 18px; color: var(--console-muted); }
.device-presence-icon.is-online { color: var(--console-success); }
.device-presence-icon:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 3px; border-radius: 50%; }
</style>
