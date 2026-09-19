<template>
  <section class="dashboard" v-loading="loading" :aria-busy="loading">
    <div class="dashboard-toolbar">
      <div class="dashboard-toolbar__summary">
        <span class="dashboard-toolbar__signal" aria-hidden="true"></span>
        <span>{{ T(isSystem ? 'OperationsSnapshot' : 'PersonalWorkspaceSummary') }}</span>
        <small v-if="lastUpdated">{{ T('UpdatedAtTime', { param: lastUpdated }) }}</small>
      </div>
      <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadDashboard">
        {{ T('Refresh') }}
      </el-button>
    </div>

    <el-alert
      v-if="partialFailure"
      class="dashboard-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="T('DashboardPartialLoad')"
    />

    <button
      v-if="isSystem && auditLagLevel !== 'healthy'"
      type="button"
      class="dashboard-attention"
      :class="`is-${auditLagLevel}`"
      @click="goTo('/operations')"
    >
      <span class="dashboard-attention__icon"><el-icon><WarningFilled/></el-icon></span>
      <span class="dashboard-attention__content">
        <strong>{{ T('AuditSignalNeedsReview') }}</strong>
        <small>{{ T('AuditSignalDescription', { param: formatDuration(operations.audit_lag_seconds) }) }}</small>
      </span>
      <span class="dashboard-attention__action">{{ T('OpenOperationsCenter') }} <el-icon><ArrowRight/></el-icon></span>
    </button>

    <div class="dashboard-metrics">
      <article v-for="metric in metrics" :key="metric.label" class="dashboard-metric">
        <div class="dashboard-metric__topline">
          <span class="dashboard-metric__icon" :class="`is-${metric.tone}`">
            <el-icon><component :is="metric.icon"/></el-icon>
          </span>
          <small>{{ metric.detail }}</small>
        </div>
        <strong>{{ formatNumber(metric.value) }}</strong>
        <span>{{ metric.label }}</span>
      </article>
    </div>

    <template v-if="isSystem">
	  <section class="operations-overview" :aria-label="T('OperationsOverview')">
	    <div class="service-strip">
		  <button v-for="serviceItem in serviceHealth" :key="serviceItem.name" type="button" @click="goTo('/operations')">
		    <i :class="`is-${serviceItem.status}`"></i>
            <span><strong>{{ serviceItem.name }}</strong><small>{{ serviceStatusLabel(serviceItem.status) }} · {{ serviceItem.detail }}</small></span>
		  </button>
	    </div>
	    <div class="ops-facts" aria-label="운영 지표">
		  <span><small>{{ T('Uptime') }}</small><strong>{{ formatDuration(operations.uptime_seconds) }}</strong></span>
		  <span><small>{{ T('ConnectionSuccessRate') }}</small><strong>{{ Math.round(operations.connection_success_rate || 0) }}%</strong></span>
		  <span><small>{{ T('DirectConnectionRate') }}</small><strong>{{ Math.round(operations.direct_rate || 0) }}%</strong></span>
		  <span :class="`is-${auditLagLevel}`"><small>{{ T('LastAuditEvent') }}</small><strong>{{ auditLagLabel }}</strong></span>
	    </div>
	  </section>
      <div class="dashboard-grid dashboard-grid--system">
        <el-card class="dashboard-panel dashboard-panel--status" shadow="never">
          <template #header>
            <panel-heading :title="T('DeviceVisibility')" :description="T('DeviceVisibilityDescription')"/>
          </template>
          <div class="status-feature">
            <div>
              <span>{{ T('RecentlyOnline') }}</span>
              <strong>{{ formatNumber(onlineDevices) }}</strong>
            </div>
            <el-progress
              type="dashboard"
              :percentage="onlineRate"
              :width="126"
              :stroke-width="10"
              :color="progressColors"
            >
              <template #default="{ percentage }">
                <strong>{{ percentage }}%</strong>
                <small>{{ T('OnlineRate') }}</small>
              </template>
            </el-progress>
          </div>
          <div class="status-lines">
            <div>
              <span><i class="is-success"></i>{{ T('RecentlyOnline') }}</span>
              <strong>{{ onlineDevices }}</strong>
            </div>
            <div>
              <span><i class="is-danger"></i>{{ T('NeedsAttention') }}</span>
              <strong>{{ attentionDevices }}</strong>
            </div>
            <div>
              <span><i class="is-neutral"></i>{{ T('NotRecentlySeen') }}</span>
              <strong>{{ Math.max(totals.devices - onlineDevices, 0) }}</strong>
            </div>
          </div>
          <p v-if="deviceSampleLimited" class="dashboard-note">{{ T('DeviceSampleNotice', { param: deviceRows.length }) }}</p>
        </el-card>

        <el-card class="dashboard-panel dashboard-panel--activity" shadow="never">
          <template #header>
            <panel-heading :title="T('ActivityOverview')" :description="T('ActivityOverviewDescription')"/>
          </template>
          <div class="activity-grid">
            <button v-for="item in systemActivity" :key="item.label" type="button" @click="goTo(item.route)">
              <span class="activity-grid__icon" :class="`is-${item.tone}`">
                <el-icon><component :is="item.icon"/></el-icon>
              </span>
              <span><strong>{{ formatNumber(item.value) }}</strong><small>{{ item.label }}</small></span>
              <el-icon class="activity-grid__arrow"><ArrowRight/></el-icon>
            </button>
          </div>
        </el-card>
      </div>

      <div class="dashboard-grid dashboard-grid--system-lower">
        <el-card class="dashboard-panel dashboard-panel--trend" shadow="never">
          <template #header>
            <panel-heading :title="T('SevenDayActivity')" :description="T('SevenDayActivityDescription')"/>
          </template>
          <div class="trend-legend" aria-hidden="true">
            <span><i class="is-connection"></i>{{ T('ConnectionEvents') }}</span>
            <span><i class="is-login"></i>{{ T('LoginActivity') }}</span>
          </div>
          <div class="trend-chart" role="img" :aria-label="T('SevenDayActivityDescription')">
            <div v-for="day in trendDays" :key="day.key" class="trend-day">
              <div class="trend-day__bars">
                <i class="is-connection" :style="{ height: `${barHeight(day.connections)}%` }" :title="`${day.label}: ${day.connections}`"></i>
                <i class="is-login" :style="{ height: `${barHeight(day.logins)}%` }" :title="`${day.label}: ${day.logins}`"></i>
              </div>
              <span>{{ day.label }}</span>
            </div>
          </div>
        </el-card>

        <el-card class="dashboard-panel dashboard-panel--events" shadow="never">
          <template #header>
            <div class="dashboard-panel__header">
              <panel-heading :title="T('RecentConnections')" :description="T('RecentConnectionsDescription')"/>
              <el-button text type="primary" @click="goTo('/auditConn')">{{ T('ViewAll') }}</el-button>
            </div>
          </template>
          <div v-if="recentConnections.length" class="event-list">
            <button v-for="event in recentConnections" :key="event.id" type="button" @click="goTo('/auditConn')">
              <span class="event-list__state" :class="event.action === 'close' ? 'is-muted' : 'is-active'">
                <el-icon><Connection/></el-icon>
              </span>
              <span class="event-list__content">
                <strong>{{ event.from_name || event.from_peer || '-' }} → {{ event.peer_id || '-' }}</strong>
                <small>{{ event.ip || T('NoIpInformation') }} · {{ relativeTime(event.created_at) }}</small>
              </span>
              <el-tag size="small" :type="event.action === 'close' ? 'info' : 'success'">
                {{ T(event.action === 'close' ? 'ConnectionClosed' : 'ConnectionStarted') }}
              </el-tag>
            </button>
          </div>
          <empty-state v-else :title="T('NoConnectionActivity')" :description="T('NoConnectionActivityDescription')"/>
        </el-card>
      </div>
    </template>

    <template v-else>
      <div class="dashboard-grid dashboard-grid--user">
        <el-card class="dashboard-panel dashboard-panel--devices" shadow="never">
          <template #header>
            <div class="dashboard-panel__header">
              <panel-heading :title="T('MyDeviceStatus')" :description="T('MyDeviceStatusDescription')"/>
              <el-button text type="primary" @click="goTo('/my/peer')">{{ T('ViewAll') }}</el-button>
            </div>
          </template>
          <div v-if="deviceRows.length" class="device-list">
            <button v-for="device in deviceRows.slice(0, 5)" :key="device.row_id || device.id" type="button" @click="goTo('/my/peer')">
              <span class="device-list__icon"><el-icon><Monitor/></el-icon></span>
              <span class="device-list__main">
                <strong>{{ device.alias || device.hostname || device.id }}</strong>
                <small>{{ device.id }} · {{ device.os || T('UnknownPlatform') }}</small>
              </span>
              <span class="dashboard-status" :class="{ 'is-online': isOnline(device.last_online_time) }">
                <i></i>{{ relativePeerTime(device.last_online_time) }}
              </span>
            </button>
          </div>
          <empty-state v-else :title="T('NoMyDevices')" :description="T('NoMyDevicesDescription')"/>
        </el-card>

        <el-card class="dashboard-panel dashboard-panel--logins" shadow="never">
          <template #header>
            <div class="dashboard-panel__header">
              <panel-heading :title="T('RecentSignIns')" :description="T('RecentSignInsDescription')"/>
              <el-button text type="primary" @click="goTo('/my/loginLog')">{{ T('ViewAll') }}</el-button>
            </div>
          </template>
          <div v-if="loginRows.length" class="signin-list">
            <div v-for="login in loginRows.slice(0, 5)" :key="login.id">
              <span class="signin-list__icon"><el-icon><Lock/></el-icon></span>
              <span>
                <strong>{{ login.platform || login.client || T('UnknownPlatform') }}</strong>
                <small>{{ login.ip || T('NoIpInformation') }} · {{ relativeTime(login.created_at) }}</small>
              </span>
              <el-tag size="small" type="info">{{ login.type === 'oauth' ? 'OAuth' : T('Account') }}</el-tag>
            </div>
          </div>
          <empty-state v-else :title="T('NoRecentSignIns')" :description="T('NoRecentSignInsDescription')"/>
        </el-card>
      </div>
    </template>

    <div class="dashboard-grid dashboard-grid--footer">
      <el-card v-if="!isSystem" class="dashboard-panel dashboard-panel--account" shadow="never">
        <template #header>
          <panel-heading :title="T('AccountReadiness')" :description="T('AccountReadinessDescription')"/>
        </template>
        <div class="account-readiness">
          <span class="account-readiness__avatar">{{ userInitial }}</span>
          <div>
            <strong>{{ userStore.nickname || userStore.username }}</strong>
            <small>{{ userStore.email || T('EmailNotRegistered') }}</small>
          </div>
          <el-tag :type="userStore.email ? 'success' : 'warning'">
            {{ T(userStore.email ? 'ProfileReady' : 'ProfileNeedsReview') }}
          </el-tag>
        </div>
        <el-button class="account-readiness__button" type="info" plain @click="goTo('/')">
          {{ T('ReviewAccountSecurity') }}
        </el-button>
      </el-card>

      <el-card class="dashboard-panel dashboard-panel--quick" shadow="never">
        <template #header>
          <panel-heading :title="T('QuickActions')" :description="T(isSystem ? 'SystemQuickActionsDescription' : 'UserQuickActionsDescription')"/>
        </template>
        <nav class="dashboard-actions" :aria-label="T('QuickActions')">
          <button v-for="action in quickActions" :key="action.route" type="button" @click="goTo(action.route)">
            <span class="dashboard-actions__icon"><el-icon><component :is="action.icon"/></el-icon></span>
            <span><strong>{{ action.title }}</strong><small>{{ action.description }}</small></span>
            <el-icon class="dashboard-actions__arrow"><ArrowRight/></el-icon>
          </button>
        </nav>
      </el-card>
    </div>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, markRaw, onActivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Connection,
  DataLine,
  Document,
  Lock,
  Monitor,
  Refresh,
  Share,
  Tickets,
  User,
  WarningFilled,
} from '@element-plus/icons'
import { list as listPeers } from '@/api/peer'
import { list as listUsers } from '@/api/user'
import { list as listLoginLogs } from '@/api/login_log'
import { list as listConnections, fileList as listFiles } from '@/api/audit'
import { list as listShares } from '@/api/share_record'
import { list as listMyPeers } from '@/api/my/peer'
import { list as listMyLoginLogs } from '@/api/my/login_log'
import { list as listMyShares } from '@/api/my/share_record'
import { useUserStore } from '@/store/user'
import { T } from '@/utils/i18n'
import { timeAgo } from '@/utils/time'
import { status as operationsStatus } from '@/api/operations'

const PanelHeading = defineComponent({
  props: { title: String, description: String },
  setup: props => () => h('div', { class: 'panel-heading' }, [h('h2', props.title), h('p', props.description)]),
})

const EmptyState = defineComponent({
  props: { title: String, description: String },
  setup: props => () => h('div', { class: 'dashboard-empty' }, [
    h('span', { class: 'dashboard-empty__icon', 'aria-hidden': 'true' }, [h(Monitor)]),
    h('strong', props.title),
    h('p', props.description),
  ]),
})

const props = defineProps({
  scope: { type: String, default: 'user', validator: value => ['user', 'system'].includes(value) },
})

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const partialFailure = ref(false)
const lastUpdated = ref('')
const totals = ref({ devices: 0, users: 0, logins: 0, connections: 0, files: 0, shares: 0 })
const deviceRows = ref([])
const loginRows = ref([])
const connectionRows = ref([])
const operations = ref({})
const isSystem = computed(() => props.scope === 'system')
let requestVersion = 0
let lastLoadedAt = 0
const progressColors = [
  { color: '#d64545', percentage: 20 },
  { color: '#b7791f', percentage: 60 },
  { color: '#159455', percentage: 100 },
]

const isOnline = timestamp => Boolean(timestamp && (Date.now() / 1000 - timestamp) < 180)
const onlineDevices = computed(() => deviceRows.value.filter(device => isOnline(device.last_online_time)).length)
const attentionDevices = computed(() => deviceRows.value.filter(device => !device.last_online_time || Date.now() / 1000 - device.last_online_time > 7 * 24 * 60 * 60).length)
const onlineRate = computed(() => totals.value.devices ? Math.round((onlineDevices.value / totals.value.devices) * 100) : 0)
const deviceSampleLimited = computed(() => totals.value.devices > deviceRows.value.length)
const userInitial = computed(() => (userStore.nickname || userStore.username || 'U').trim().slice(0, 1).toUpperCase())
const serviceHealth = computed(() => ['api', 'database', 'hbbs', 'hbbr'].map(key => { const item = operations.value[key] || { status: 'unknown' }; return { name: key.toUpperCase(), status: item.status, detail: item.reason || `${item.latency_ms || 0}ms` } }))
const auditLagLevel = computed(() => {
  const seconds = Number(operations.value.audit_lag_seconds || 0)
  if (seconds >= 24 * 60 * 60) return 'critical'
  if (seconds >= 60 * 60) return 'warning'
  return 'healthy'
})
const formatDuration = value => {
  const seconds = Math.max(0, Number(value || 0))
  if (seconds < 60) return T('SecondsDuration', { param: Math.floor(seconds) })
  if (seconds < 3600) return T('MinutesDuration', { param: Math.floor(seconds / 60) })
  if (seconds < 86400) return T('HoursDuration', { param: Math.floor(seconds / 3600) })
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours ? T('DaysHoursDuration', { days, hours }) : T('DaysDuration', { param: days })
}
const auditLagLabel = computed(() => T('TimeAgoValue', { param: formatDuration(operations.value.audit_lag_seconds) }))
const serviceStatusLabel = status => T(status === 'ok' ? 'ServiceHealthy' : status === 'error' ? 'ServiceUnavailable' : status === 'degraded' ? 'ServiceDegraded' : 'ServiceUnknown')

const metrics = computed(() => isSystem.value ? [
  { label: T('ManagedDevices'), detail: T('AllRegisteredResources'), value: totals.value.devices, icon: markRaw(Monitor), tone: 'blue' },
  { label: T('RecentlyOnline'), detail: T('WithinThreeMinutes'), value: onlineDevices.value, icon: markRaw(Connection), tone: 'green' },
  { label: T('RegisteredUsers'), detail: T('AllAccounts'), value: totals.value.users, icon: markRaw(User), tone: 'violet' },
  { label: T('ConnectionEvents'), detail: T('RecordedActivity'), value: totals.value.connections, icon: markRaw(DataLine), tone: 'amber' },
] : [
  { label: T('MyDevices'), detail: T('DevicesAssignedToMe'), value: totals.value.devices, icon: markRaw(Monitor), tone: 'blue' },
  { label: T('RecentlyOnline'), detail: T('WithinThreeMinutes'), value: onlineDevices.value, icon: markRaw(Connection), tone: 'green' },
  { label: T('MyLoginActivity'), detail: T('MyAccessHistory'), value: totals.value.logins, icon: markRaw(Lock), tone: 'violet' },
  { label: T('ActiveShares'), detail: T('SharedAccessLinks'), value: totals.value.shares, icon: markRaw(Share), tone: 'amber' },
])

const systemActivity = computed(() => [
  { label: T('ConnectionEvents'), value: totals.value.connections, route: '/auditConn', icon: markRaw(Connection), tone: 'blue' },
  { label: T('FileTransferEvents'), value: totals.value.files, route: '/auditFile', icon: markRaw(Document), tone: 'green' },
  { label: T('LoginActivity'), value: totals.value.logins, route: '/loginLog', icon: markRaw(Tickets), tone: 'violet' },
  { label: T('SharedAccessLinks'), value: totals.value.shares, route: '/shareRecord', icon: markRaw(Share), tone: 'amber' },
])

const quickActions = computed(() => isSystem.value ? [
  { title: T('PeerManage'), description: T('ManageDevicesDescription'), route: '/user/peer', icon: markRaw(Monitor) },
  { title: T('UserManage'), description: T('ManageUsersDescription'), route: '/user/index', icon: markRaw(User) },
  { title: T('AuditConnLog'), description: T('ReviewAuditDescription'), route: '/auditConn', icon: markRaw(DataLine) },
] : [
  { title: T('MyPeer'), description: T('MyDevicesDescription'), route: '/my/peer', icon: markRaw(Monitor) },
  { title: T('AddressBooks'), description: T('AddressBooksDescription'), route: '/my/address_book', icon: markRaw(User) },
  { title: T('ShareRecord'), description: T('SharesDescription'), route: '/my/shareRecord', icon: markRaw(Share) },
])

const recentConnections = computed(() => connectionRows.value.slice(0, 5))
const dateValue = value => {
  if (!value) return 0
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000
  const parsed = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}
const dateKey = value => {
  const timestamp = dateValue(value)
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const trendDays = computed(() => {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return { key: dateKey(date.getTime()), label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date), connections: 0, logins: 0 }
  })
  const byKey = Object.fromEntries(days.map(day => [day.key, day]))
  connectionRows.value.forEach(row => { const item = byKey[dateKey(row.created_at)]; if (item) item.connections += 1 })
  loginRows.value.forEach(row => { const item = byKey[dateKey(row.created_at)]; if (item) item.logins += 1 })
  return days
})
const trendMax = computed(() => Math.max(1, ...trendDays.value.flatMap(day => [day.connections, day.logins])))
const barHeight = value => value ? Math.max(12, Math.round((value / trendMax.value) * 100)) : 3
const normalize = result => result?.data || { list: [], total: 0 }
const resultValue = result => result.status === 'fulfilled' ? result.value : false

const loadDashboard = async () => {
  const currentVersion = ++requestVersion
  loading.value = true
  partialFailure.value = false
  const query = { page: 1, page_size: isSystem.value ? 500 : 20 }
  const requests = isSystem.value
	? [listPeers(query), listUsers(query), listLoginLogs(query), listConnections(query), listFiles(query), listShares(query), operationsStatus()]
    : [listMyPeers(query), listMyLoginLogs(query), listMyShares(query)]
  const results = (await Promise.allSettled(requests)).map(resultValue)
  if (currentVersion !== requestVersion) return
  partialFailure.value = results.some(result => !result)
  if (isSystem.value) {
	const [devices, users, logins, connections, files, shares] = results.slice(0, 6).map(normalize)
	operations.value = results[6]?.data || {}
    totals.value = { devices: devices.total || 0, users: users.total || 0, logins: logins.total || 0, connections: connections.total || 0, files: files.total || 0, shares: shares.total || 0 }
    deviceRows.value = devices.list || []
    loginRows.value = logins.list || []
    connectionRows.value = connections.list || []
  } else {
    const [devices, logins, shares] = results.map(normalize)
    totals.value = { devices: devices.total || 0, users: 0, logins: logins.total || 0, connections: 0, files: 0, shares: shares.total || 0 }
    deviceRows.value = devices.list || []
    loginRows.value = logins.list || []
    connectionRows.value = []
  }
  lastUpdated.value = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date())
  lastLoadedAt = Date.now()
  loading.value = false
}

const relativeTime = value => dateValue(value) ? timeAgo(dateValue(value)) : '-'
const relativePeerTime = timestamp => timestamp ? timeAgo(timestamp * 1000) : T('NeverConnected')
const formatNumber = value => new Intl.NumberFormat().format(value || 0)
const goTo = route => router.push(route)

watch(() => props.scope, loadDashboard, { immediate: true })
onActivated(() => {
  if (lastLoadedAt && Date.now() - lastLoadedAt > 30000) loadDashboard()
})
</script>

<style scoped lang="scss">
.dashboard { display: grid; gap: 14px; }
.dashboard-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 38px; }
.dashboard-toolbar__summary { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--console-text); font-weight: 650; }
.dashboard-toolbar__summary small { color: var(--console-muted); font-size: 12px; font-weight: 400; }
.dashboard-toolbar__signal { width: 8px; height: 8px; background: var(--console-success); border-radius: 50%; box-shadow: 0 0 0 4px var(--console-success-soft); }
.dashboard-alert { border: 1px solid color-mix(in srgb, var(--console-warning) 30%, var(--console-border)); }
.dashboard-attention { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 13px; width: 100%; padding: 13px 15px; color: var(--console-text); text-align: left; background: var(--console-warning-soft); border: 1px solid color-mix(in srgb, var(--console-warning) 38%, var(--console-border)); border-radius: 7px; cursor: pointer; }
.dashboard-attention.is-critical { background: color-mix(in srgb, var(--console-danger) 8%, var(--console-surface)); border-color: color-mix(in srgb, var(--console-danger) 38%, var(--console-border)); }
.dashboard-attention:hover, .dashboard-attention:focus-visible { border-color: var(--console-warning); box-shadow: 0 0 0 3px color-mix(in srgb, var(--console-warning) 13%, transparent); }
.dashboard-attention.is-critical:hover, .dashboard-attention.is-critical:focus-visible { border-color: var(--console-danger); box-shadow: 0 0 0 3px color-mix(in srgb, var(--console-danger) 12%, transparent); }
.dashboard-attention__icon { display: grid; place-items: center; width: 40px; height: 40px; color: var(--console-warning); background: var(--console-surface); border-radius: 50%; font-size: 19px; }
.dashboard-attention.is-critical .dashboard-attention__icon { color: var(--console-danger); }
.dashboard-attention__content strong, .dashboard-attention__content small { display: block; }
.dashboard-attention__content strong { color: var(--console-heading); font-size: 13px; }
.dashboard-attention__content small { margin-top: 3px; color: var(--console-text); font-size: 12px; }
.dashboard-attention__action { display: inline-flex; align-items: center; gap: 5px; color: var(--console-primary); font-size: 12px; font-weight: 650; white-space: nowrap; }
.dashboard-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.dashboard-metric { min-width: 0; padding: 16px 18px; background: var(--console-surface); border: 1px solid var(--console-border); border-radius: 7px; }
.dashboard-metric > strong, .dashboard-metric > span { display: block; }
.dashboard-metric > strong { margin-top: 12px; color: var(--console-heading); font-size: 27px; font-variant-numeric: tabular-nums; line-height: 1; }
.dashboard-metric > span { margin-top: 7px; color: var(--console-text); font-size: 13px; font-weight: 650; }
.dashboard-metric__topline { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dashboard-metric__topline small { min-width: 0; overflow: hidden; color: var(--console-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.dashboard-metric__icon, .dashboard-actions__icon, .activity-grid__icon, .device-list__icon, .signin-list__icon { display: grid; flex: 0 0 auto; place-items: center; width: 36px; height: 36px; color: var(--console-primary); background: var(--console-primary-soft); border-radius: 6px; font-size: 18px; }
.dashboard-metric__icon.is-green, .activity-grid__icon.is-green { color: var(--console-success); background: var(--console-success-soft); }
.dashboard-metric__icon.is-violet, .activity-grid__icon.is-violet { color: #7656bf; background: #f1edfb; }
.dashboard-metric__icon.is-amber, .activity-grid__icon.is-amber { color: var(--console-warning); background: var(--console-warning-soft); }
.dashboard-grid { display: grid; gap: 12px; }
.dashboard-grid--system { grid-template-columns: minmax(320px, .9fr) minmax(420px, 1.35fr); }
.dashboard-grid--system-lower { grid-template-columns: minmax(420px, 1.35fr) minmax(340px, 1fr); }
.dashboard-grid--user { grid-template-columns: minmax(480px, 1.45fr) minmax(320px, .85fr); }
.dashboard-grid--footer { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.dashboard-grid--footer > .dashboard-panel:only-child { grid-column: 1 / -1; }
.dashboard-panel--account + .dashboard-panel--quick .dashboard-actions { grid-template-columns: 1fr; }
.dashboard-panel { min-width: 0; }
.dashboard-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
:deep(.panel-heading) { min-width: 0; }
:deep(.panel-heading h2) { margin: 0; color: var(--console-heading); font-size: 14px; line-height: 1.4; }
:deep(.panel-heading p) { margin: 2px 0 0; color: var(--console-muted); font-size: 12px; font-weight: 400; }
.status-feature { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 2px 6px 15px; }
.status-feature > div span, .status-feature > div strong, .status-feature :deep(.el-progress__text strong), .status-feature :deep(.el-progress__text small) { display: block; }
.status-feature > div span { color: var(--console-muted); }
.status-feature > div strong { margin-top: 5px; color: var(--console-heading); font-size: 36px; font-variant-numeric: tabular-nums; }
.status-feature :deep(.el-progress__text strong) { color: var(--console-heading); font-size: 22px; }
.status-feature :deep(.el-progress__text small) { margin-top: 2px; color: var(--console-muted); font-size: 11px; }
.status-lines { border-top: 1px solid var(--console-border); }
.status-lines > div { display: flex; align-items: center; justify-content: space-between; min-height: 40px; border-bottom: 1px solid var(--console-border); }
.status-lines span { display: flex; align-items: center; gap: 8px; color: var(--console-text); }
.status-lines strong { color: var(--console-heading); font-variant-numeric: tabular-nums; }
.status-lines i { width: 7px; height: 7px; background: var(--console-muted); border-radius: 50%; }
.status-lines i.is-success { background: var(--console-success); }
.status-lines i.is-danger { background: var(--console-danger); }
.dashboard-note { margin: 12px 0 0; color: var(--console-muted); font-size: 11px; }
.activity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.activity-grid button { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 11px; min-height: 70px; padding: 12px; color: var(--console-text); text-align: left; background: var(--console-canvas); border: 1px solid transparent; border-radius: 6px; cursor: pointer; }
.activity-grid button:hover, .activity-grid button:focus-visible { background: var(--console-primary-soft); border-color: var(--console-primary-border); }
.activity-grid strong, .activity-grid small { display: block; }
.activity-grid strong { color: var(--console-heading); font-size: 19px; font-variant-numeric: tabular-nums; }
.activity-grid small { margin-top: 2px; color: var(--console-muted); }
.activity-grid__arrow, .dashboard-actions__arrow { color: var(--console-muted); }
.trend-legend { display: flex; gap: 16px; color: var(--console-muted); font-size: 12px; }
.trend-legend span { display: flex; align-items: center; gap: 6px; }
.trend-legend i { width: 9px; height: 9px; border-radius: 2px; }
.trend-chart { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; min-height: 190px; margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--console-border); border-bottom: 1px solid var(--console-border); background: var(--console-canvas); }
.trend-day { display: grid; grid-template-rows: 1fr 26px; min-width: 0; text-align: center; }
.trend-day > span { align-self: end; color: var(--console-muted); font-size: 11px; }
.trend-day__bars { display: flex; align-items: flex-end; justify-content: center; gap: 4px; min-height: 150px; }
.trend-day__bars i { width: min(16px, 34%); min-height: 3px; border-radius: 3px 3px 0 0; }
.is-connection { background: var(--console-primary); }
.is-login { background: #50c5c8; }
.event-list, .device-list, .signin-list { display: grid; }
.event-list button, .device-list button, .signin-list > div { display: grid; align-items: center; gap: 11px; min-width: 0; min-height: 57px; padding: 8px 4px; border-bottom: 1px solid var(--console-border); }
.event-list button, .device-list button { width: 100%; color: var(--console-text); text-align: left; background: transparent; border-top: 0; border-right: 0; border-left: 0; cursor: pointer; }
.event-list button:hover, .event-list button:focus-visible, .device-list button:hover, .device-list button:focus-visible { background: var(--console-canvas); }
.event-list button { grid-template-columns: 34px minmax(0, 1fr) auto; }
.event-list__state { display: grid; place-items: center; width: 32px; height: 32px; color: var(--console-success); background: var(--console-success-soft); border-radius: 50%; }
.event-list__state.is-muted { color: var(--console-muted); background: var(--console-neutral-soft); }
.event-list__content, .device-list__main, .signin-list > div > span:nth-child(2) { min-width: 0; }
.event-list__content strong, .event-list__content small, .device-list__main strong, .device-list__main small, .signin-list > div > span:nth-child(2) strong, .signin-list > div > span:nth-child(2) small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.event-list__content strong, .device-list__main strong, .signin-list > div > span:nth-child(2) strong { color: var(--console-heading); font-size: 13px; }
.event-list__content small, .device-list__main small, .signin-list > div > span:nth-child(2) small { margin-top: 3px; color: var(--console-muted); font-size: 11px; }
.device-list button { grid-template-columns: 36px minmax(0, 1fr) auto; }
.dashboard-status { display: inline-flex; align-items: center; gap: 6px; color: var(--console-muted); font-size: 12px; }
.dashboard-status i { width: 7px; height: 7px; background: #98a2b3; border-radius: 50%; }
.dashboard-status.is-online { color: var(--console-success); }
.dashboard-status.is-online i { background: var(--console-success); }
.signin-list > div { grid-template-columns: 36px minmax(0, 1fr) auto; }
:deep(.dashboard-empty) { display: grid; justify-items: center; min-height: 170px; align-content: center; padding: 24px; color: var(--console-muted); text-align: center; }
:deep(.dashboard-empty strong) { margin-top: 10px; color: var(--console-heading); }
:deep(.dashboard-empty p) { max-width: 360px; margin: 4px 0 0; font-size: 12px; }
:deep(.dashboard-empty__icon) { display: grid; place-items: center; width: 42px; height: 42px; color: var(--console-muted); background: var(--console-neutral-soft); border-radius: 50%; font-size: 20px; }
.account-readiness { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 12px; }
.account-readiness strong, .account-readiness small { display: block; }
.account-readiness strong { color: var(--console-heading); }
.account-readiness small { margin-top: 3px; color: var(--console-muted); }
.account-readiness__avatar { display: grid; place-items: center; width: 48px; height: 48px; color: #fff; background: #153b5b; border-radius: 8px; font-size: 18px; font-weight: 700; }
.account-readiness__button { width: 100%; margin-top: 16px; }
.dashboard-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.dashboard-actions button { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-width: 0; padding: 11px; color: var(--console-text); text-align: left; background: var(--console-canvas); border: 1px solid transparent; border-radius: 6px; cursor: pointer; }
.dashboard-actions button:hover, .dashboard-actions button:focus-visible { background: var(--console-primary-soft); border-color: var(--console-primary-border); }
.dashboard-actions strong, .dashboard-actions small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.operations-overview { display: grid; gap: 8px; }
.service-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.service-strip button{display:grid;grid-template-columns:10px 1fr;align-items:center;gap:9px;padding:10px 12px;text-align:left;background:var(--console-surface);border:1px solid var(--console-border);border-radius:6px;cursor:pointer}.service-strip button:hover,.service-strip button:focus-visible{border-color:var(--console-primary-border);background:var(--console-primary-soft)}.service-strip i{width:9px;height:9px;border-radius:50%;background:#98a2b3}.service-strip i.is-ok{background:var(--console-success)}.service-strip i.is-error{background:var(--console-danger)}.service-strip i.is-degraded{background:var(--console-warning)}.service-strip strong,.service-strip small{display:block}.service-strip small{margin-top:2px;color:var(--console-muted);font-size:11px}
.ops-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;overflow:hidden;background:var(--console-border);border:1px solid var(--console-border);border-radius:6px}.ops-facts span{padding:10px 14px;background:var(--console-surface)}.ops-facts span.is-warning{box-shadow:inset 3px 0 var(--console-warning)}.ops-facts span.is-critical{background:color-mix(in srgb,var(--console-danger) 7%,var(--console-surface));box-shadow:inset 3px 0 var(--console-danger)}.ops-facts small,.ops-facts strong{display:block}.ops-facts small{color:var(--console-muted);font-size:11px}.ops-facts strong{margin-top:3px;color:var(--console-heading);font-variant-numeric:tabular-nums}
.dashboard-actions small { margin-top: 2px; color: var(--console-muted); font-size: 11px; }
@media (max-width: 1100px) {
  .dashboard-metrics, .dashboard-grid--system, .dashboard-grid--system-lower, .dashboard-grid--user { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-grid--system > *, .dashboard-grid--system-lower > *, .dashboard-grid--user > * { grid-column: 1 / -1; }
  .dashboard-actions { grid-template-columns: 1fr; }
}
@media (max-width: 700px) {
  .dashboard-toolbar { align-items: flex-start; }
  .dashboard-toolbar__summary { display: grid; grid-template-columns: auto 1fr; }
  .dashboard-toolbar__summary small { grid-column: 2; }
  .dashboard-metrics, .dashboard-grid--system, .dashboard-grid--system-lower, .dashboard-grid--user, .dashboard-grid--footer, .activity-grid { grid-template-columns: 1fr; }
  .dashboard-metric { padding: 14px 16px; }
  .status-feature { padding-right: 0; padding-left: 0; }
  .event-list button { grid-template-columns: 32px minmax(0, 1fr); }
  .event-list button .el-tag { display: none; }
  .device-list button, .signin-list > div { grid-template-columns: 36px minmax(0, 1fr); }
  .dashboard-status, .signin-list > div > .el-tag { grid-column: 2; justify-self: start; }
  .account-readiness { grid-template-columns: 44px minmax(0, 1fr); }
  .account-readiness .el-tag { grid-column: 2; justify-self: start; }
	.service-strip,.ops-facts{grid-template-columns:repeat(2,minmax(0,1fr))}
  .dashboard-attention { grid-template-columns: 38px minmax(0, 1fr); }
  .dashboard-attention__action { grid-column: 2; }
}
</style>
