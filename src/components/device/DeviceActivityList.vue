<template>
  <ol class="device-activity-list">
    <li v-for="item in items" :key="`${item.resource || 'desktop'}-${item.id}`">
      <div class="activity-description" :title="description(item)">
        <strong>{{ label(item) }}</strong>
        <span v-if="item.resource" class="activity-state" :class="state(item)">( <span>{{ T(stateKey(item)) }}</span> )</span>
        <span v-else class="activity-ip">{{ item.ip || T('NoIpInformation') }}</span>
      </div>
      <time :datetime="date(item.created_at)?.toISOString() || ''" :title="fullDate(item.created_at)">{{ format(item.created_at) }}</time>
    </li>
  </ol>
</template>

<script setup>
import { T } from '@/utils/i18n'
import { useAppStore } from '@/store/app'
defineProps({ items: { type: Array, default: () => [] } })
const app = useAppStore()
const label = item => item.resource ? T(item.resource === 'web_terminal' ? 'ActivityTerminal' : 'ActivityFiles') : item.from_name || item.from_peer || T('Unknown')
const state = item => item.action === 'disconnect' ? 'ended' : item.result === 'connected' ? 'connected' : 'started'
const stateKey = item => ({ ended: 'ActivityEnded', connected: 'ActivityConnected', started: 'ActivityStarted' })[state(item)]
const description = item => `${label(item)} ${item.resource ? `( ${T(stateKey(item))} )` : item.ip || T('NoIpInformation')}`
const date = value => {
  if (!value) return null
  const parsed = new Date(typeof value === 'number' ? value * 1000 : String(value).replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
const format = value => {
  const parsed = date(value)
  return parsed ? new Intl.DateTimeFormat(app.setting.lang, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(parsed) : '-'
}
const fullDate = value => {
  const parsed = date(value)
  return parsed ? new Intl.DateTimeFormat(app.setting.lang, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed) : '-'
}
</script>

<style scoped>
.device-activity-list { margin: 0; padding: 0; list-style: none; }
li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--console-border); }
li:last-child { border-bottom: 0; }
.activity-description { display: flex; align-items: center; gap: 4px; min-width: 0; white-space: nowrap; color: var(--console-text); font-size: 13px; }
strong { overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.activity-state { flex: none; font-size: 12px; font-weight: 600; }
.started { color: #946000; }
.connected { color: var(--console-success-hover); }
.ended { color: var(--console-danger-hover); }
:global(html.dark .device-activity-list .started) { color: #e4b056; }
.activity-ip { overflow: hidden; text-overflow: ellipsis; color: var(--console-muted); font-size: 12px; }
time { flex: none; font-size: 11px; color: var(--console-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
@media (max-width: 420px) { li { gap: 6px; } .activity-description { font-size: 12px; } .activity-state, time { font-size: 10px; } }
</style>
