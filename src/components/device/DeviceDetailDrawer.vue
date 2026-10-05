<template>
  <el-drawer
      :model-value="modelValue"
      class="device-detail-drawer"
      :title="T('DeviceDetails')"
      size="min(520px, 100vw)"
      append-to-body
      destroy-on-close
      @open="loadActivity"
      @close="emit('update:modelValue', false)"
  >
    <template #header>
      <div class="device-detail-heading">
        <PeerOs :os="peer?.os"/>
        <div>
          <strong>{{ peer?.hostname || peer?.alias || peer?.id || T('Unknown') }}</strong>
          <span>{{ peer?.id || '-' }}</span>
        </div>
      </div>
    </template>

    <div v-if="peer" class="device-detail-content">
      <section class="device-detail-status" :class="isOnline ? 'is-online' : 'is-offline'">
        <div>
          <span class="device-status-label">
            <el-icon aria-hidden="true"><CircleCheck v-if="isOnline"/><Warning v-else/></el-icon>
            {{ isOnline ? T('Online') : T('Offline') }}
          </span>
          <strong>{{ peer.last_online_time ? timeAgo(peer.last_online_time * 1000) : T('NeverConnected') }}</strong>
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
          <div><dt>{{ T('Hostname') }}</dt><dd>{{ peer.hostname || '-' }}</dd></div>
          <div><dt>{{ T('Alias') }}</dt><dd>{{ peer.alias || '-' }}</dd></div>
          <div><dt>{{ T('Uuid') }}</dt><dd class="is-breakable">{{ peer.uuid || '-' }}</dd></div>
        </dl>
      </section>

      <section class="device-detail-section">
        <h3>{{ T('Assignment') }}</h3>
        <dl class="device-detail-grid">
          <div><dt>{{ T('Username') }}</dt><dd>{{ peer.username || '-' }}</dd></div>
          <div><dt>{{ T('Group') }}</dt><dd>{{ groupName || T('NotSet') }}</dd></div>
          <div><dt>{{ T('AppliedPolicy') }}</dt><dd>{{ T('NotCollected') }}</dd></div>
          <div><dt>{{ T('DeviceNote') }}</dt><dd>{{ T('NotCollected') }}</dd></div>
        </dl>
      </section>

      <section class="device-detail-section">
        <h3>{{ T('SystemInformation') }}</h3>
        <dl class="device-detail-grid">
          <div><dt>{{ T('Os') }}</dt><dd>{{ peer.os || '-' }}</dd></div>
          <div><dt>{{ T('Version') }}</dt><dd>{{ peer.version || '-' }}</dd></div>
          <div><dt>CPU</dt><dd>{{ peer.cpu || '-' }}</dd></div>
          <div><dt>{{ T('Memory') }}</dt><dd>{{ peer.memory || '-' }}</dd></div>
          <div><dt>{{ T('LastOnlineIp') }}</dt><dd>{{ peer.last_online_ip || '-' }}</dd></div>
          <div><dt>{{ T('PublicKeyFingerprint') }}</dt><dd>{{ T('NotCollected') }}</dd></div>
        </dl>
      </section>

      <section class="device-detail-section">
        <div class="device-detail-section-title">
          <h3>{{ T('RecentActivity') }}</h3>
          <el-button v-if="allowAudit" link :loading="activity.loading" @click="loadActivity">
            {{ T('Refresh') }}
          </el-button>
        </div>
        <el-skeleton v-if="activity.loading" :rows="3" animated/>
        <el-alert
            v-else-if="activity.error"
            type="warning"
            :closable="false"
            :title="T('ActivityLoadFailed')"
        />
        <ol v-else-if="activity.list.length" class="device-activity-list">
          <li v-for="item in activity.list" :key="item.id">
            <div>
              <strong>{{ item.from_name || item.from_peer || T('Unknown') }}</strong>
              <span>{{ item.ip || T('NoIpInformation') }}</span>
            </div>
            <time :datetime="toDateTime(item.created_at)">{{ formatDate(item.created_at) }}</time>
          </li>
        </ol>
        <el-empty v-else :image-size="64" :description="allowAudit ? T('NoConnectionActivity') : T('ActivityUnavailable')"/>
      </section>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { CircleCheck, Connection, Warning } from '@element-plus/icons-vue'
import { list as auditList } from '@/api/audit'
import PeerOs from '@/components/icons/peerOs.vue'
import { useAppStore } from '@/store/app'
import { T } from '@/utils/i18n'
import { timeAgo } from '@/utils/time'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  peer: { type: Object, default: null },
  groupName: { type: String, default: '' },
  allowAudit: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'connect'])
const appStore = useAppStore()

const activity = reactive({ list: [], loading: false, error: false })
const isOnline = computed(() => {
  if (!props.peer?.last_online_time) return false
  return Date.now() - props.peer.last_online_time * 1000 < 60 * 1000
})

const parseDate = (value) => {
  if (!value) return null
  if (typeof value === 'number') return new Date(value * 1000)
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}
const formatDate = (value) => {
  const date = parseDate(value)
  if (!date) return '-'
  return new Intl.DateTimeFormat(appStore.setting.lang, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
const toDateTime = (value) => parseDate(value)?.toISOString() || ''

const loadActivity = async () => {
  activity.list = []
  activity.error = false
  if (!props.allowAudit || !props.peer?.id) return

  activity.loading = true
  const response = await auditList({ page: 1, page_size: 5, peer_id: props.peer.id }).catch(() => false)
  activity.loading = false
  if (!response) {
    activity.error = true
    return
  }
  activity.list = response.data?.list || []
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

.device-detail-status > div {
  min-width: 0;
}

.device-detail-status strong,
.device-status-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.device-detail-status strong {
  margin-top: 3px;
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

.device-activity-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.device-activity-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--console-border);
}

.device-activity-list li:last-child { border-bottom: 0; }
.device-activity-list li > div { min-width: 0; }
.device-activity-list strong,
.device-activity-list span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-activity-list span,
.device-activity-list time { color: var(--console-muted); font-size: 12px; }
.device-activity-list time { flex: 0 0 auto; font-variant-numeric: tabular-nums; }

@media (max-width: 520px) {
  .device-detail-status { align-items: stretch; flex-direction: column; }
  .device-detail-status .el-button { width: 100%; }
  .device-detail-grid { grid-template-columns: minmax(0, 1fr); }
}
</style>
