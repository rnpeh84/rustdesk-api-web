<template>
  <section class="ops-page" v-loading="loading" :aria-busy="loading">
    <header class="ops-toolbar">
      <div>
        <span class="ops-toolbar__eyebrow"><i></i>{{ T('OperationsLiveStatus') }}</span>
        <small v-if="lastUpdated">{{ T('UpdatedAtTime', { param: lastUpdated }) }}</small>
      </div>
      <el-button type="primary" :icon="Refresh" :loading="loading" @click="load">{{ T('Refresh') }}</el-button>
    </header>

    <section v-if="auditLagLevel !== 'healthy'" class="ops-incident" :class="`is-${auditLagLevel}`" aria-live="polite">
      <span class="ops-incident__icon"><el-icon><WarningFilled/></el-icon></span>
      <div class="ops-incident__copy">
        <small>{{ T('CollectionSignal') }}</small>
        <strong>{{ T('AuditEventLastSeen', { param: auditLagLabel }) }}</strong>
        <p>{{ T('AuditLagContext') }}</p>
      </div>
      <el-button class="ops-incident__action" plain @click="goToAudit">
        {{ T('ReviewConnectionLogs') }} <el-icon><ArrowRight/></el-icon>
      </el-button>
    </section>

    <div class="ops-metrics">
      <article v-for="metric in metrics" :key="metric.label" :class="metric.tone ? `is-${metric.tone}` : ''">
        <span class="ops-metrics__icon"><el-icon><component :is="metric.icon"/></el-icon></span>
        <span><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong><em>{{ metric.detail }}</em></span>
      </article>
    </div>

    <el-card shadow="never" class="ops-services">
      <template #header>
        <div class="panel-head">
          <div><strong>{{ T('CoreServiceStatus') }}</strong><small>{{ T('CoreServiceStatusDescription') }}</small></div>
          <span class="ops-services__summary" :class="allServicesHealthy ? 'is-healthy' : 'is-warning'">
            {{ T(allServicesHealthy ? 'AllSystemsOperational' : 'ServiceReviewNeeded') }}
          </span>
        </div>
      </template>
      <div class="ops-summary">
        <div v-for="item in services" :key="item.name" class="ops-status">
          <span class="ops-dot" :class="`is-${item.value.status}`"></span>
          <span><strong>{{ item.name }}</strong><small>{{ serviceDetail(item.value) }}</small></span>
          <span class="ops-status__label" :class="`is-${item.value.status}`">{{ serviceStatusLabel(item.value.status) }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="ops-alarms">
      <template #header>
        <div class="panel-head ops-alarms__head">
          <div><strong>{{ T('OperationsAlarmCenter') }}</strong><small>{{ T('OperationsAlarmDescription') }}</small></div>
          <div class="ops-alarms__counts">
            <span><b>{{ openAlarmCount }}</b>{{ T('OpenAlarmCount') }}</span>
            <span class="is-critical"><b>{{ criticalAlarmCount }}</b>{{ T('CriticalAlarmCount') }}</span>
          </div>
        </div>
      </template>

      <div v-if="alarmRows.length" class="alarm-list">
        <article v-for="row in alarmRows" :key="row.id" class="alarm-item" :class="`is-${row.severity}`">
          <div class="alarm-item__severity">
            <el-icon><WarningFilled/></el-icon>
            <span>{{ severityLabel(row.severity) }}</span>
          </div>
          <div class="alarm-item__content">
            <div class="alarm-item__title">
              <strong>{{ row.title }}</strong>
              <span>{{ categoryLabel(row.category) }}</span>
            </div>
            <p>{{ row.description }}</p>
            <div class="alarm-item__meta">
              <span>{{ T('LastDetected') }} <b>{{ relativeFromUnix(row.last_seen_at) }}</b></span>
              <span>{{ T('Occurrences') }} <b>{{ row.occurrence }}</b></span>
              <span>{{ T('Assignee') }} <b>{{ row.assignee || T('Unassigned') }}</b></span>
            </div>
          </div>
          <div class="alarm-item__action">
            <small>{{ T('Status') }}</small>
            <el-select :model-value="row.status" size="small" :aria-label="T('Status')" @change="value => changeStatus(row, value)">
              <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value"/>
            </el-select>
          </div>
        </article>
      </div>
      <el-empty v-else :description="T('NoOperationsAlarms')">
        <template #image><el-icon class="ops-empty-icon"><CircleCheckFilled/></el-icon></template>
      </el-empty>
    </el-card>
  </section>
</template>

<script setup>
import { computed, markRaw, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, CircleCheckFilled, Clock, Connection, DataLine, Refresh, WarningFilled } from '@element-plus/icons'
import { alarms, status, updateAlarm } from '@/api/operations'
import { T } from '@/utils/i18n'

const router = useRouter()
const loading = ref(false)
const snapshot = ref({})
const alarmRows = ref([])
const lastUpdated = ref('')

const services = computed(() => ['api', 'database', 'hbbs', 'hbbr'].map(key => ({
  name: key.toUpperCase(),
  value: snapshot.value[key] || { status: 'unknown' },
})))
const allServicesHealthy = computed(() => services.value.every(item => item.value.status === 'ok'))
const auditLagSeconds = computed(() => Math.max(0, Number(snapshot.value.audit_lag_seconds || 0)))
const auditLagLevel = computed(() => auditLagSeconds.value >= 86400 ? 'critical' : auditLagSeconds.value >= 3600 ? 'warning' : 'healthy')
const formatDuration = value => {
  const seconds = Math.max(0, Number(value || 0))
  if (seconds < 60) return T('SecondsDuration', { param: Math.floor(seconds) })
  if (seconds < 3600) return T('MinutesDuration', { param: Math.floor(seconds / 60) })
  if (seconds < 86400) return T('HoursDuration', { param: Math.floor(seconds / 3600) })
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours ? T('DaysHoursDuration', { days, hours }) : T('DaysDuration', { param: days })
}
const auditLagLabel = computed(() => formatDuration(auditLagSeconds.value))
const percent = value => `${Math.round(Number(value || 0))}%`
const metrics = computed(() => [
  { label: T('Uptime'), value: formatDuration(snapshot.value.uptime_seconds), detail: T('CurrentProcessUptime'), icon: markRaw(Clock) },
  { label: T('ConnectionSuccessRate'), value: percent(snapshot.value.connection_success_rate), detail: T('CompletedConnectionRatio'), icon: markRaw(DataLine) },
  { label: T('DirectConnectionRate'), value: percent(snapshot.value.direct_rate), detail: T('DirectSessionRatio'), icon: markRaw(Connection) },
  { label: T('LastAuditEvent'), value: T('TimeAgoValue', { param: auditLagLabel.value }), detail: T('CollectionFreshness'), icon: markRaw(WarningFilled), tone: auditLagLevel.value },
])
const openAlarmCount = computed(() => alarmRows.value.filter(row => row.status !== 'resolved').length)
const criticalAlarmCount = computed(() => alarmRows.value.filter(row => row.status !== 'resolved' && row.severity === 'critical').length)
const statusOptions = computed(() => [
  { value: 'open', label: T('AlarmOpen') },
  { value: 'acknowledged', label: T('AlarmAcknowledged') },
  { value: 'resolved', label: T('AlarmResolved') },
])

const serviceStatusLabel = value => T(value === 'ok' ? 'ServiceHealthy' : value === 'error' ? 'ServiceUnavailable' : value === 'degraded' ? 'ServiceDegraded' : 'ServiceUnknown')
const serviceDetail = item => item.reason ? T('ServiceReason', { param: item.reason }) : T('ResponseLatency', { param: item.latency_ms || 0 })
const severityLabel = value => T(value === 'critical' ? 'SeverityCritical' : value === 'warning' ? 'SeverityWarning' : 'SeverityInfo')
const categoryLabel = value => T(value === 'collection' ? 'CategoryCollection' : value === 'security' ? 'CategorySecurity' : value === 'device' ? 'CategoryDevice' : 'CategorySystem')
const relativeFromUnix = value => {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(value || 0))
  return value ? T('TimeAgoValue', { param: formatDuration(seconds) }) : T('NoData')
}
const goToAudit = () => router.push('/auditConn')
const load = async () => {
  loading.value = true
  const [statusResult, alarmResult] = await Promise.all([
    status().catch(() => false),
    alarms({ page: 1, page_size: 50 }).catch(() => false),
  ])
  snapshot.value = statusResult?.data || {}
  alarmRows.value = alarmResult?.data?.list || []
  lastUpdated.value = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date())
  loading.value = false
}
const changeStatus = async (row, value) => {
  if (await updateAlarm({ id: row.id, status: value, assignee: row.assignee || '', audit_log_id: row.audit_log_id || 0 }).catch(() => false)) load()
}

onMounted(load)
</script>

<style scoped lang="scss">
.ops-page { display: grid; gap: 14px; }
.ops-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 38px; }
.ops-toolbar > div { display: flex; align-items: center; gap: 9px; }
.ops-toolbar small { color: var(--console-muted); font-size: 12px; }
.ops-toolbar__eyebrow { display: inline-flex; align-items: center; gap: 8px; color: var(--console-heading); font-weight: 650; }
.ops-toolbar__eyebrow i { width: 8px; height: 8px; background: var(--console-success); border-radius: 50%; box-shadow: 0 0 0 4px var(--console-success-soft); }
.ops-incident { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 16px 18px; background: var(--console-warning-soft); border: 1px solid color-mix(in srgb, var(--console-warning) 40%, var(--console-border)); border-radius: 8px; }
.ops-incident.is-critical { background: color-mix(in srgb, var(--console-danger) 8%, var(--console-surface)); border-color: color-mix(in srgb, var(--console-danger) 42%, var(--console-border)); }
.ops-incident__icon { display: grid; place-items: center; width: 46px; height: 46px; color: var(--console-warning); background: var(--console-surface); border-radius: 50%; font-size: 22px; }
.ops-incident.is-critical .ops-incident__icon { color: var(--console-danger); }
.ops-incident__copy small, .ops-incident__copy strong { display: block; }
.ops-incident__copy small { color: var(--console-muted); font-size: 11px; font-weight: 650; text-transform: uppercase; }
.ops-incident__copy strong { margin-top: 3px; color: var(--console-heading); font-size: 17px; }
.ops-incident__copy p { margin: 4px 0 0; color: var(--console-text); font-size: 12px; }
.ops-incident__action { background: var(--console-surface); }
.ops-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.ops-metrics article { display: grid; grid-template-columns: 38px minmax(0, 1fr); align-items: center; gap: 11px; min-width: 0; padding: 14px; background: var(--console-surface); border: 1px solid var(--console-border); border-radius: 7px; }
.ops-metrics article.is-warning { border-color: color-mix(in srgb, var(--console-warning) 40%, var(--console-border)); }
.ops-metrics article.is-critical { background: color-mix(in srgb, var(--console-danger) 5%, var(--console-surface)); border-color: color-mix(in srgb, var(--console-danger) 40%, var(--console-border)); }
.ops-metrics__icon { display: grid; place-items: center; width: 38px; height: 38px; color: var(--console-primary); background: var(--console-primary-soft); border-radius: 7px; font-size: 18px; }
.ops-metrics article.is-warning .ops-metrics__icon { color: var(--console-warning); background: var(--console-warning-soft); }
.ops-metrics article.is-critical .ops-metrics__icon { color: var(--console-danger); background: color-mix(in srgb, var(--console-danger) 10%, white); }
.ops-metrics small, .ops-metrics strong, .ops-metrics em { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-metrics small { color: var(--console-muted); font-size: 11px; }
.ops-metrics strong { margin-top: 2px; color: var(--console-heading); font-size: 18px; font-style: normal; font-variant-numeric: tabular-nums; }
.ops-metrics em { margin-top: 2px; color: var(--console-muted); font-size: 10px; font-style: normal; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.panel-head strong, .panel-head small { display: block; }
.panel-head small { margin-top: 3px; color: var(--console-muted); }
.ops-services__summary { padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 650; }
.ops-services__summary.is-healthy { color: var(--console-success); background: var(--console-success-soft); }
.ops-services__summary.is-warning { color: var(--console-warning); background: var(--console-warning-soft); }
.ops-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.ops-status { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; padding: 11px 12px; color: var(--console-text); background: var(--console-canvas); border: 1px solid transparent; border-radius: 6px; }
.ops-status strong, .ops-status small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ops-status small { margin-top: 2px; color: var(--console-muted); font-size: 11px; }
.ops-dot { width: 9px; height: 9px; border-radius: 50%; background: #98a2b3; }
.ops-dot.is-ok { background: var(--console-success); }
.ops-dot.is-error { background: var(--console-danger); }
.ops-dot.is-degraded { background: var(--console-warning); }
.ops-status__label { padding: 3px 7px; color: var(--console-muted); background: var(--console-neutral-soft); border-radius: 999px; font-size: 10px; }
.ops-status__label.is-ok { color: var(--console-success); background: var(--console-success-soft); }
.ops-status__label.is-error { color: var(--console-danger); background: color-mix(in srgb, var(--console-danger) 9%, white); }
.ops-alarms__counts { display: flex; gap: 8px; }
.ops-alarms__counts span { display: inline-flex; align-items: center; gap: 5px; padding: 5px 8px; color: var(--console-text); background: var(--console-neutral-soft); border-radius: 999px; font-size: 11px; }
.ops-alarms__counts span.is-critical { color: var(--console-danger); background: color-mix(in srgb, var(--console-danger) 9%, white); }
.alarm-list { display: grid; gap: 8px; }
.alarm-item { display: grid; grid-template-columns: 92px minmax(0, 1fr) 150px; gap: 15px; align-items: center; padding: 14px; background: var(--console-canvas); border: 1px solid var(--console-border); border-left: 3px solid var(--console-warning); border-radius: 6px; }
.alarm-item.is-critical { border-left-color: var(--console-danger); }
.alarm-item__severity { display: flex; align-items: center; gap: 6px; color: var(--console-warning); font-size: 12px; font-weight: 650; }
.alarm-item.is-critical .alarm-item__severity { color: var(--console-danger); }
.alarm-item__content { min-width: 0; }
.alarm-item__title { display: flex; align-items: center; gap: 8px; }
.alarm-item__title strong { color: var(--console-heading); font-size: 13px; }
.alarm-item__title span { padding: 2px 6px; color: var(--console-muted); background: var(--console-neutral-soft); border-radius: 4px; font-size: 10px; }
.alarm-item__content p { margin: 5px 0 0; color: var(--console-text); font-size: 12px; line-height: 1.5; }
.alarm-item__meta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 7px; color: var(--console-muted); font-size: 10px; }
.alarm-item__meta b { color: var(--console-text); font-weight: 600; }
.alarm-item__action small { display: block; margin-bottom: 5px; color: var(--console-muted); font-size: 10px; }
.alarm-item__action :deep(.el-select) { width: 100%; }
.ops-empty-icon { color: var(--console-success); font-size: 54px; }
@media (max-width: 1100px) {
  .ops-metrics, .ops-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .ops-toolbar { align-items: flex-start; }
  .ops-toolbar > div { display: grid; gap: 3px; }
  .ops-incident { grid-template-columns: 42px minmax(0, 1fr); padding: 14px; }
  .ops-incident__icon { width: 42px; height: 42px; }
  .ops-incident__action { grid-column: 2; justify-self: start; }
  .ops-metrics, .ops-summary { grid-template-columns: 1fr; }
  .panel-head { align-items: flex-start; }
  .ops-alarms__head { display: grid; }
  .alarm-item { grid-template-columns: 1fr; gap: 9px; }
  .alarm-item__action { max-width: 180px; }
}
</style>
