<template>
  <Teleport :to="notificationPortal || 'body'">
    <section v-if="notificationPortal" class="notification-center" :class="{ 'is-embedded': notificationPortal }" :aria-label="T('NotificationCenter')" @keydown.esc.stop="closeHistory">
      <div :key="notifications.revision" class="notification-dock" :class="{ 'has-new': recent, [`is-${latest?.type || 'info'}`]: true }">
        <span class="notification-summary" role="status" aria-live="polite" aria-atomic="true"><el-icon aria-hidden="true"><component :is="icons[latest?.type || 'info']"/></el-icon><span>{{ latest?.message || T('NotificationsQuiet') }}</span></span>
        <time v-if="latest" class="notification-age" :datetime="new Date(latest.time).toISOString()" :title="time(latest.time)">{{ age(latest.time) }}</time>
        <button ref="trigger" class="notification-trigger" :aria-label="T('NotificationCenter')" :aria-expanded="notifications.opened" @click="toggle"><el-icon aria-hidden="true"><Bell/></el-icon><span>{{ T('Notifications') }}</span><span v-if="unread" class="notification-count">{{ unread }}</span></button>
      </div>
      <section v-if="notifications.opened" ref="history" class="notification-history" :aria-label="T('NotificationHistory')" tabindex="-1">
        <header><strong>{{ T('NotificationHistory') }}</strong><button :disabled="!visibleNotifications.length" @click="clear">{{ T('NotificationsClear') }}</button><button :aria-label="T('Close')" @click="closeHistory"><el-icon><Close/></el-icon></button></header>
        <ol v-if="visibleNotifications.length"><li v-for="item in visibleNotifications" :key="item.id" :class="`is-${item.type}`"><el-icon aria-hidden="true"><component :is="icons[item.type]"/></el-icon><div><p>{{ item.message }}<span v-if="item.count > 1"> ×{{ item.count }}</span></p><time :datetime="new Date(item.time).toISOString()" :title="time(item.time)">{{ age(item.time) }}</time></div></li></ol>
        <p v-else class="notification-empty">{{ T('NotificationsQuiet') }}</p>
      </section>
    </section>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, ref, watch, onBeforeUnmount, onMounted } from 'vue'
import { Bell, CircleCheck, CircleClose, InfoFilled, WarningFilled, Close } from '@element-plus/icons-vue'
import { notifications, notificationPortal, visibleNotifications, readNotifications } from '@/utils/notifications'
import { T } from '@/utils/i18n'
import { notificationAge, isRecentNotification } from '@/utils/notificationTime'
import { useAppStore } from '@/store/app'
const icons = { success: CircleCheck, error: CircleClose, warning: WarningFilled, info: InfoFilled }
const latest = computed(() => visibleNotifications.value[0])
const unread = computed(() => visibleNotifications.value.filter(item => !item.read).length)
const now = ref(Date.now())
const recent = computed(() => isRecentNotification(latest.value, now.value))
const age = value => notificationAge(value, now.value, app.setting.lang)
let clockTimer, highlightTimer
const stopClock = () => { clearInterval(clockTimer); clearTimeout(highlightTimer) }
watch(notificationPortal, host => {
  stopClock(); now.value = Date.now()
  if (host) clockTimer = setInterval(() => { now.value = Date.now() }, 5000)
}, { immediate: true })
watch(() => [latest.value?.time, notificationPortal.value], () => {
  clearTimeout(highlightTimer); now.value = Date.now()
  const remaining = (latest.value?.time || 0) + 5000 - now.value
  if (notificationPortal.value && remaining > 0) highlightTimer = setTimeout(() => { now.value = Date.now() }, remaining)
}, { immediate: true })
const trigger = ref(null), history = ref(null), app = useAppStore()
const time = value => new Intl.DateTimeFormat(app.setting.lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value)
const closeHistory = () => { notifications.opened = false; trigger.value?.focus() }
const toggle = () => { notifications.opened = !notifications.opened }
watch(() => notifications.opened, async opened => { if (opened) { readNotifications(); await nextTick(); history.value?.focus() } })
const clear = () => { const ids=new Set(visibleNotifications.value.map(item=>item.id));notifications.items.splice(0,notifications.items.length,...notifications.items.filter(item=>!ids.has(item.id))) }
const outside = event => { if (notifications.opened && !event.target.closest('.notification-center')) notifications.opened = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => { stopClock(); document.removeEventListener('pointerdown', outside) })
</script>

<style scoped>
.notification-center{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:20010;width:min(420px,calc(100vw - 24px));color:var(--console-text,var(--el-text-color-primary));font-size:12px}
.notification-center.is-embedded{position:relative;inset:auto;z-index:4;width:100%;min-width:0}
.notification-dock{position:relative;display:flex;align-items:center;gap:8px;min-height:36px;padding:6px 8px;background:var(--console-surface,var(--el-bg-color));border:1px solid var(--console-border,var(--el-border-color));border-radius:6px;box-sizing:border-box}
.is-success{--notice-color:#1c7954}.is-error{--notice-color:#b94343}.is-warning{--notice-color:#997016}.is-info{--notice-color:#55738d}
.notification-dock.has-new{border-color:var(--notice-color)}.notification-age{flex:none;color:var(--el-text-color-secondary);font-size:11px;font-variant-numeric:tabular-nums}.notification-dock.has-new:after{content:'';position:absolute;inset:-2px;pointer-events:none;border:2px solid var(--notice-color);border-radius:7px;animation:notification-attention 1.1s ease-out 2}
@keyframes notification-attention{0%,100%{opacity:0}40%{opacity:.65}}
.notification-summary{display:flex;align-items:center;gap:6px;flex:1;min-width:0;line-height:1.4}.notification-summary>.el-icon{flex:none;color:var(--notice-color)}.notification-summary>span{overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.notification-trigger{display:flex;align-items:center;gap:4px;flex:none;padding:5px 6px;white-space:nowrap}.notification-count{min-width:17px;padding:0 4px;border-radius:8px;background:var(--notice-color);color:#fff;line-height:17px;text-align:center;font-variant-numeric:tabular-nums}
button{color:inherit;font:inherit;background:none;border:0;border-radius:4px;cursor:pointer}button:hover{background:var(--el-fill-color-light)}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}button:disabled{opacity:.5;cursor:default}
.notification-history{position:absolute;right:0;bottom:calc(100% + 8px);width:min(420px,calc(100vw - 24px));max-height:min(360px,60dvh);background:var(--console-surface,var(--el-bg-color));border:1px solid var(--console-border,var(--el-border-color));border-radius:8px;box-shadow:0 8px 30px #17202e25;overflow:hidden;display:flex;flex-direction:column}
.notification-history header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--el-border-color)}.notification-history header strong{flex:1}.notification-history ol{list-style:none;padding:0;margin:0;overflow-y:auto;overscroll-behavior:contain}.notification-history li{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--el-border-color-lighter);line-height:1.5}.notification-history li>.el-icon{flex:none;margin-top:3px;color:var(--notice-color)}.notification-history li>div{min-width:0}.notification-history p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.notification-history time{color:var(--el-text-color-secondary);font-size:11px}.notification-empty{padding:16px}
@media(prefers-reduced-motion:reduce){.notification-dock.has-new:after{animation:none;opacity:.5}}
@media(max-width:600px){.notification-dock{min-height:32px}.notification-trigger>span:not(.notification-count){display:none}.notification-history{max-height:50dvh}}
</style>
