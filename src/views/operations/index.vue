<template>
  <section class="ops-page" v-loading="loading">
    <div class="ops-summary">
      <el-card v-for="item in services" :key="item.name" shadow="never" class="ops-status">
        <span class="ops-dot" :class="`is-${item.value.status}`"></span>
        <div><strong>{{ item.name }}</strong><small>{{ statusLabel(item.value) }}</small></div>
        <el-tag :type="item.value.status === 'ok' ? 'success' : item.value.status === 'unknown' ? 'info' : 'danger'">{{ item.value.status }}</el-tag>
      </el-card>
    </div>
    <el-card shadow="never">
      <template #header><div class="panel-head"><div><strong>{{ T('OperationsAlarmCenter') }}</strong><small>{{ T('OperationsAlarmDescription') }}</small></div><el-button :icon="Refresh" @click="load">{{ T('Refresh') }}</el-button></div></template>
      <el-table :data="alarmRows" stripe>
        <el-table-column prop="severity" :label="T('Severity')" width="110"><template #default="{ row }"><el-tag :type="row.severity === 'critical' ? 'danger' : 'warning'">{{ row.severity }}</el-tag></template></el-table-column>
        <el-table-column prop="title" :label="T('Title')" min-width="180" show-overflow-tooltip/>
        <el-table-column prop="description" :label="T('Description')" min-width="260" show-overflow-tooltip/>
        <el-table-column prop="occurrence" :label="T('Occurrences')" width="90"/>
        <el-table-column prop="assignee" :label="T('Assignee')" width="130"/>
        <el-table-column :label="T('Status')" width="140"><template #default="{ row }"><el-select :model-value="row.status" @change="value => changeStatus(row, value)"><el-option label="open" value="open"/><el-option label="acknowledged" value="acknowledged"/><el-option label="resolved" value="resolved"/></el-select></template></el-table-column>
      </el-table>
      <el-empty v-if="!alarmRows.length" :description="T('NoOperationsAlarms')"/>
    </el-card>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons'
import { alarms, status, updateAlarm } from '@/api/operations'
import { T } from '@/utils/i18n'
const loading = ref(false); const snapshot = ref({}); const alarmRows = ref([])
const services = computed(() => ['api', 'database', 'hbbs', 'hbbr'].map(key => ({ name: key.toUpperCase(), value: snapshot.value[key] || { status: 'unknown' } })))
const statusLabel = item => item.reason ? `${item.status} · ${item.reason}` : `${item.status} · ${item.latency_ms || 0}ms`
const load = async () => { loading.value = true; const [s, a] = await Promise.all([status().catch(() => false), alarms({ page: 1, page_size: 50 }).catch(() => false)]); snapshot.value = s?.data || {}; alarmRows.value = a?.data?.list || []; loading.value = false }
const changeStatus = async (row, value) => { if (await updateAlarm({ id: row.id, status: value, assignee: row.assignee || '', audit_log_id: row.audit_log_id || 0 }).catch(() => false)) load() }
onMounted(load)
</script>
<style scoped lang="scss">
.ops-page{display:grid;gap:14px}.ops-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.ops-status :deep(.el-card__body){display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:10px}.ops-status strong,.ops-status small{display:block}.ops-status small{margin-top:3px;color:var(--console-muted)}.ops-dot{width:10px;height:10px;border-radius:50%;background:#98a2b3}.ops-dot.is-ok{background:var(--console-success)}.ops-dot.is-error{background:var(--console-danger)}.panel-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.panel-head strong,.panel-head small{display:block}.panel-head small{margin-top:3px;color:var(--console-muted)}@media(max-width:900px){.ops-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.ops-summary{grid-template-columns:1fr}}
</style>

