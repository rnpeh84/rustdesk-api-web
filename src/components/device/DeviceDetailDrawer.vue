<template>
  <el-drawer
      :model-value="modelValue"
      class="device-detail-drawer"
      :title="T('DeviceDetails')"
      size="min(640px, 100vw)"
      append-to-body
      destroy-on-close
      @open="openDetails"
      @close="emit('update:modelValue', false)"
  >
    <template #header>
      <div class="device-detail-heading">
        <PeerOs :os="device.os"/>
        <div>
          <strong>{{ device.hostname || peer?.alias || peer?.id || T('Unknown') }}</strong>
          <span>{{ peer?.id || '-' }}</span>
        </div>
      </div>
    </template>

    <div v-if="peer" class="device-detail-content">
      <section class="device-detail-status" :class="isOnline ? 'is-online' : 'is-offline'">
        <div class="device-presence">
          <DevicePresence :online="isOnline"/>
          <strong>{{ onlineTime ? timeAgo(onlineTime * 1000) : T('NeverConnected') }}</strong>
        </div>
        <slot name="connect"><el-button type="primary" :icon="Connection" @click="emit('connect', peer.id)">
          {{ T('ConnectNow') }}
        </el-button></slot>
      </section>

      <slot name="terminal"/>

      <section class="device-detail-section">
        <h3>{{ T('DeviceIdentity') }}</h3>
        <dl class="device-detail-grid">
          <div><dt>ID</dt><dd>{{ peer.id || '-' }}</dd></div>
          <div><dt>{{ T('Hostname') }}</dt><dd>{{ device.hostname || '-' }}</dd></div>
          <div><dt>{{ T('Alias') }}</dt><dd>{{ peer.alias || '-' }}</dd></div>
          <div><dt>{{ T('Uuid') }}</dt><dd class="is-breakable">{{ peer.uuid || '-' }}</dd></div>
        </dl>
      </section>

      <section class="device-detail-section">
        <h3>{{ T('Assignment') }}</h3>
        <dl class="device-detail-grid">
          <div><dt>{{ T('Username') }}</dt><dd>{{ device.username || reported.shell_user || '-' }}</dd></div>
          <div><dt>{{ T('Group') }}</dt><dd>{{ groupName || T('NotSet') }}</dd></div>
          <div><dt>{{ T('AppliedPolicy') }}</dt><dd>{{ T('NotCollected') }}</dd></div>
          <div><dt>{{ T('DeviceNote') }}</dt><dd>{{ T('NotCollected') }}</dd></div>
        </dl>
      </section>

      <section class="device-detail-section">
        <div class="device-detail-section-title"><h3>{{ T('SystemInformation') }}</h3><el-tooltip :content="T('Refresh')"><el-button circle :icon="Refresh" :aria-label="T('Refresh')" :loading="infoLoading" @click="loadInformation(true)"/></el-tooltip></div>
        <el-alert v-if="infoError" :title="infoError" type="warning" :closable="false"/>
        <dl class="device-detail-grid">
          <div><dt>{{ T('Os') }}</dt><dd class="is-breakable">{{ device.os || T('NotCollected') }}</dd></div>
          <div><dt>{{ T('Version') }}</dt><dd>{{ device.version || T('NotCollected') }}</dd></div>
          <div><dt>CPU</dt><dd class="is-breakable">{{ device.cpu || T('NotCollected') }}</dd></div>
          <div><dt>{{ T('Memory') }}</dt><dd>{{ device.memory || T('NotCollected') }}</dd></div>
          <div><dt>{{ T('LastOnlineIp') }}</dt><dd>{{ peer.last_online_ip || '-' }}</dd></div>
          <div><dt>{{ T('PublicKeyFingerprint') }}</dt><dd>{{ T('NotCollected') }}</dd></div>
        </dl>
      </section>

      <section class="device-detail-section">
        <div class="device-detail-section-title">
          <h3>{{ T('RecentActivity') }}</h3>
          <div class="activity-actions">
            <el-button link @click="openHistory">{{ T('HistoryDetails') }}</el-button>
            <el-tooltip :content="T('Refresh')"><el-button circle :icon="Refresh" :aria-label="T('Refresh')" :loading="activity.loading" @click="loadActivity"/></el-tooltip>
          </div>
        </div>
        <el-skeleton v-if="activity.loading" :rows="3" animated/>
        <el-alert
            v-if="!activity.loading && activity.error"
            type="warning"
            :closable="false"
            :title="T('ActivityLoadFailed')"
        />
        <DeviceActivityList v-if="!activity.loading && activity.list.length" :items="activity.list"/>
        <el-empty v-if="!activity.loading && !activity.error && !activity.list.length" :image-size="64" :description="T('NoConnectionActivity')"/>
      </section>
    </div>
    <el-dialog v-model="history.visible" :title="T('ConnectionHistory')" width="min(760px, calc(100vw - 24px))" class="connection-history-dialog" append-to-body destroy-on-close @closed="closeHistory">
      <template #header="{ titleId, titleClass }">
        <div class="history-heading">
          <span :id="titleId" :class="titleClass">{{ T('ConnectionHistory') }}</span>
          <el-button class="history-refresh" link :icon="Refresh" :aria-label="T('Refresh')" :title="T('Refresh')" :loading="history.loading" @click="resetHistory"/>
        </div>
      </template>
      <div v-if="allowAudit" class="history-tools">
        <el-radio-group v-if="allowAudit" v-model="history.source" size="small" @change="resetHistory">
          <el-radio-button value="web">{{ T('ActivityWebConnections') }}</el-radio-button>
          <el-radio-button value="desktop">{{ T('DeviceConnectionDesktop') }}</el-radio-button>
        </el-radio-group>

      </div>
      <div class="history-records" v-loading="history.loading" :aria-busy="history.loading">
        <el-alert v-if="history.error" :title="T('ActivityLoadFailed')" type="warning" :closable="false"/>
        <DeviceActivityList v-else-if="history.list.length" :items="history.list"/>
        <el-empty v-else-if="!history.loading" :image-size="64" :description="T('NoConnectionActivity')"/>
      </div>
      <template #footer>
        <el-pagination v-if="history.total > 0" v-model:current-page="history.page" :page-size="20" :total="history.total" :disabled="history.loading" layout="total, prev, pager, next" :pager-count="5" small @current-change="loadHistory"/>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup>
import { computed, reactive, ref, watch, onBeforeUnmount, onDeactivated } from 'vue'
import DevicePresence from './DevicePresence.vue'
import { Connection, Refresh } from '@element-plus/icons-vue'
import { list as auditList } from '@/api/audit'
import DeviceActivityList from './DeviceActivityList.vue'
import PeerOs from '@/components/icons/peerOs.vue'
import { T } from '@/utils/i18n'
import { timeAgo } from '@/utils/time'
import { terminalStatus, terminalHistory } from '@/api/terminal'
import { DeviceFilesClient, fileErrorKey } from '@/utils/deviceFiles'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  peer: { type: Object, default: null },
  groupName: { type: String, default: '' },
  allowAudit: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'connect'])


const history = reactive({ visible: false, list: [], loading: false, error: false, source: 'web', page: 1, total: 0, anchor: 0 })
let historyRequest = 0
const activity = reactive({ list: [], loading: false, error: false })
const reported = ref({}), infoLoading = ref(false), infoError = ref(''), now = ref(Date.now())
const device = computed(() => ({ ...props.peer, ...reported.value.device }))
const onlineTime = computed(() => reported.value.service_running && now.value / 1000 - reported.value.reported_at <= 90 ? Math.max(Number(device.value.last_online_time) || 0, reported.value.reported_at) : Number(device.value.last_online_time) || 0)
const isOnline = computed(() => {
  if (reported.value.reported_at && now.value / 1000 - reported.value.reported_at <= 90) return !!reported.value.service_running
  if (!onlineTime.value) return false
  return now.value - onlineTime.value * 1000 < 90 * 1000
})
let timer, probe, generation = 0, probed = false, activeRow
const stop = () => { closeHistory(); generation++; clearInterval(timer); timer = undefined; activeRow = undefined; probe?.close(); probe = null; infoLoading.value = activity.loading = false }
const loadInformation = async (force = false) => {
  if (!props.modelValue || !props.peer?.row_id || infoLoading.value) return
  const current = generation, rowID = props.peer.row_id
  infoLoading.value = true; infoError.value = ''; now.value = Date.now()
  try {
    const res = await terminalStatus(rowID)
    if (current !== generation) return
    reported.value = res.data
    const missing = ['os', 'cpu', 'memory', 'version'].some(key => !device.value[key])
    if ((force || (missing && !probed)) && res.data.files_enabled && res.data.has_saved_password) {
      probed = true
      const client = new DeviceFilesClient(props.peer); probe = client
      try { const ready = await client.connect('', true); if (current === generation) reported.value = { ...reported.value, device: { ...reported.value.device, ...ready.system_info } } }
      finally { client.close(); if (probe === client) probe = null }
    }
  } catch (e) { if (current === generation) infoError.value = T(fileErrorKey(e?.message)) }
  finally { if (current === generation) infoLoading.value = false }
}
const openDetails = () => { if (timer && activeRow === props.peer?.row_id) return; stop(); activeRow = props.peer?.row_id; probed = false; reported.value = {}; loadActivity(); loadInformation(); timer = setInterval(() => { now.value = Date.now(); if (document.visibilityState !== 'hidden') {loadInformation();loadActivity()} }, 15000) }
watch(() => props.modelValue, value => { if (!value) stop() })
watch(() => props.peer?.row_id, () => { if (props.modelValue) openDetails() })
onDeactivated(stop)
onBeforeUnmount(stop)

const parseDate = (value) => {
  if (!value) return null
  if (typeof value === 'number') return new Date(value * 1000)
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}
const loadActivity = async () => {
  if (!props.modelValue || !props.peer?.row_id || activity.loading) return
  const current=generation,rowID=props.peer.row_id,deviceID=props.peer.id
  activity.list = []
  activity.error = false
  activity.loading = true
  const [terminalResult,desktopResult]=await Promise.allSettled([terminalHistory(rowID),props.allowAudit ? auditList({page:1,page_size:5,peer_id:deviceID}) : Promise.resolve({data:{list:[]}})])
  if(current!==generation)return
  activity.loading = false
  activity.error = terminalResult.status==='rejected' || desktopResult.status==='rejected'
  const terminalItems = terminalResult.status==='fulfilled' ? terminalResult.value.data?.list || [] : []
  const desktopItems = desktopResult.status==='fulfilled' ? desktopResult.value.data?.list || [] : []
  activity.list = [...terminalItems,...desktopItems].sort((a,b)=>(parseDate(b.created_at)?.getTime()||0)-(parseDate(a.created_at)?.getTime()||0)).slice(0,5)
}
const closeHistory = () => { historyRequest++; history.visible = false; history.loading = false }
const openHistory = () => { history.visible = true; history.source = 'web'; resetHistory() }
const resetHistory = () => { history.page = 1; history.anchor = 0; loadHistory() }
const loadHistory = async () => {
  if (!history.visible || !props.modelValue || !props.peer?.row_id) return
  const requestID = ++historyRequest, current = generation, rowID = props.peer.row_id
  const source = history.source, page = history.page
  history.loading = true; history.error = false; history.list = []
  try {
    const reply = source === 'web'
      ? await terminalHistory(rowID, { page, page_size: 20, before_id: history.anchor || undefined })
      : await auditList({ page, page_size: 20, peer_id: props.peer.id })
    if (requestID !== historyRequest || current !== generation || !history.visible) return
    history.list = reply.data?.list || []
    history.total = Number(reply.data?.total) || 0
    if (source === 'web') history.anchor = reply.data?.before_id || 0
  } catch {
    if (requestID === historyRequest && current === generation) { history.error = true; history.total = 0 }
  } finally {
    if (requestID === historyRequest && current === generation) history.loading = false
  }
}
</script>

<style scoped lang="scss">
.device-detail-heading {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
}

.device-detail-heading > div {
  min-width: 0;
}

.device-detail-heading strong,
.device-detail-heading span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-detail-heading strong {
  color: var(--console-heading);
  font-size: 16px;
}

.device-detail-heading span {
  margin-top: 2px;
  color: var(--console-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.device-detail-content {
  display: grid;
  gap: 18px;
}

.device-detail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  background: var(--console-neutral-soft);
  border: 1px solid var(--console-border);
  border-radius: 8px;
}

.device-presence { display: flex; align-items: center; gap: 10px; white-space: nowrap;
  min-width: 0;
}

.device-detail-status strong,
.device-status-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.device-detail-status strong {
  margin-top: 0;
  color: var(--console-heading);
  font-size: 13px;
}

.device-status-label {
  color: var(--console-muted);
  font-size: 12px;
  font-weight: 700;
}

.device-detail-status.is-online .device-status-label { color: var(--console-success); }
.device-detail-status.is-offline .device-status-label { color: var(--console-danger); }

.device-detail-section {
  padding-top: 2px;
}

.device-detail-section + .device-detail-section {
  padding-top: 18px;
  border-top: 1px solid var(--console-border);
}

.device-detail-section h3 {
  margin: 0 0 12px;
  color: var(--console-heading);
  font-size: 14px;
}

.device-detail-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.device-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
  margin: 0;
}

.device-detail-grid div { min-width: 0; }
.device-detail-grid dt { color: var(--console-muted); font-size: 12px; }
.device-detail-grid dd {
  margin: 3px 0 0;
  overflow: hidden;
  color: var(--console-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.device-detail-grid dd.is-breakable { overflow-wrap: anywhere; white-space: normal; }

.activity-actions { display: flex; align-items: center; gap: 8px; }
.device-detail-section-title { margin-bottom: 10px; }
.device-detail-section-title h3 { margin: 0; }
.history-heading { padding-right: 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: 1; min-width: 0; }
.history-heading > span { min-width: 0; }
.history-refresh { width: 32px; height: 32px; min-height: 32px; min-width: 32px; padding: 0; margin: 0; color: var(--console-muted); background: transparent; border: 0; }
.history-refresh:hover { color: var(--console-primary); background: transparent; }
.history-refresh:focus-visible { outline: 2px solid var(--console-primary); outline-offset: 2px; }
.history-tools { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-bottom: 12px; }
.history-tools .el-radio-group { margin-right: auto; }
.history-records { min-height: 100px; max-height: 56dvh; overflow: auto; }
:deep(.connection-history-dialog .el-dialog__footer) { display: flex; justify-content: flex-end; }

@media (max-width: 520px) {
  .device-detail-status { gap: 10px; }

  .device-detail-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
