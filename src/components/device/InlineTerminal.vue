<template>
  <section v-show="modelValue" class="terminal-inline">
    <header class="el-dialog__header"><slot name="header" :title-id="titleId"/></header>
    <div class="el-dialog__body"><slot/></div>
    <footer class="el-dialog__footer"><slot name="footer"/></footer>
  </section>
</template>
<script setup>
import { nextTick, useId, watch } from 'vue'
const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['opened', 'closed'])
const titleId = useId()
watch(() => props.modelValue, async value => { await nextTick(); emit(value ? 'opened' : 'closed') })
</script>
<style>
.terminal-inline {position:relative;display:flex;flex-direction:column;width:100%;height:100dvh;min-height:0;background:var(--el-bg-color);box-sizing:border-box}
.terminal-inline>.el-dialog__body{flex:1;min-height:0}
.terminal-inline.terminal-dialog>.el-dialog__header{display:none!important}
.terminal-inline>.el-dialog__footer{position:absolute;left:12px;right:12px;bottom:10px;z-index:10;pointer-events:none;padding:0!important;background:transparent!important;border:0!important}
.terminal-inline .terminal-footer .terminal-footer-actions{display:none!important}
.terminal-inline .terminal-notification-host{min-height:0}
.terminal-inline .notification-dock{display:none}
.terminal-inline .notification-dock.has-new{display:flex;pointer-events:auto}
.terminal-inline .notification-history{pointer-events:auto;max-height:min(400px,65dvh)}
.terminal-inline .terminal-session-status.is-connected,.terminal-inline .terminal-session-status.is-pending{display:none}
</style>
