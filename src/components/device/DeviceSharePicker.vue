<template>
  <section class="device-share-picker">
    <h3>{{ T('ChooseShareDevices') }}</h3>
    <form class="picker-search" @submit.prevent="search"><el-input v-model="id" :placeholder="T('SearchDeviceId')" :aria-label="T('SearchDeviceId')" clearable/><el-input v-model="hostname" :placeholder="T('SearchHostname')" :aria-label="T('SearchHostname')" clearable/><el-button native-type="submit" :icon="Search" :aria-label="T('Search')"/></form>
    <div class="picked-devices" aria-live="polite"><span>{{ T('ShareSelectedDevices', { param: selected.length }) }}</span><el-tag v-for="(rowID, index) in selected" :key="rowID" closable @close="toggle(rowID, false)">{{ labels[rowID] || T('SelectedDeviceLabel', { param: index + 1 }) }}</el-tag></div>
    <el-alert v-if="failed" :title="T('DeviceListLoadFailed')" type="error" :closable="false"><el-button @click="load">{{ T('Retry') }}</el-button></el-alert>
    <el-table v-else :data="devices" v-loading="loading" row-key="row_id" max-height="240">
      <el-table-column :label="T('Select')" width="48"><template #default="{row}"><el-checkbox :model-value="selected.includes(row.row_id)" :aria-label="T('Select') + ' ' + row.id" @change="value => toggle(row.row_id, value)"/></template></el-table-column>
      <el-table-column :label="T('DeviceIdAndOs')" min-width="150"><template #default="{row}"><span class="picker-id"><PeerOs :os="row.os"/>{{ row.id }}</span></template></el-table-column>
      <el-table-column prop="hostname" :label="T('Hostname')" min-width="130" show-overflow-tooltip/>
      <template #empty><el-empty :description="T('NoDevicesFound')" :image-size="40"/></template>
    </el-table>
    <el-pagination v-if="total > 10" v-model:current-page="page" :page-size="10" :total="total" layout="prev, pager, next" @current-change="load"/>
  </section>
</template>

<script setup>
import { onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
import { list } from '@/api/my/peer'
import PeerOs from '@/components/icons/peerOs.vue'
const selected = defineModel({ type: Array, default: () => [] })
const props = defineProps({ knownDevices: { type: Array, default: () => [] } })
const devices = ref([]), loading = ref(false), failed = ref(false), id = ref(''), hostname = ref(''), page = ref(1), total = ref(0)
const labels = reactive({})
const remember = rows => rows.forEach(row => { labels[row.row_id] = row.hostname ? row.hostname + ' · ' + row.id : row.id })
watch(() => props.knownDevices, remember, { immediate: true })
let version = 0
const load = async () => {
  const current = ++version; loading.value = true; failed.value = false
  try { const res = await list({ scope: 'mine', page: page.value, page_size: 10, id: id.value, hostname: hostname.value }); if (current === version) { devices.value = res.data.list; total.value = res.data.total; remember(devices.value) } }
  catch { if (current === version) { devices.value = []; failed.value = true } }
  finally { if (current === version) loading.value = false }
}
const search = () => { page.value = 1; load() }
const toggle = (rowID, value) => { selected.value = value ? [...new Set([...selected.value, rowID])] : selected.value.filter(item => item !== rowID) }
onMounted(load)
onBeforeUnmount(() => version++)
</script>

<style scoped>
.device-share-picker { margin: 16px 0 24px; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; }
h3 { font-size: 14px; margin: 0 0 12px; }
.picker-search { display: flex; gap: 8px; }
.picker-id { display: inline-flex; align-items: center; gap: 8px; }
.picked-devices { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 12px 0; color: var(--el-text-color-secondary); }
.picked-devices :deep(.el-tag) { max-width: 100%; height: auto; min-height: 24px; white-space: normal; overflow-wrap: anywhere; }
.device-share-picker :deep(.el-pagination) { margin-top: 12px; }
@media (max-width: 480px) { .picker-search { flex-wrap: wrap; } .picker-search .el-input { flex: 1 1 100%; } }
</style>
