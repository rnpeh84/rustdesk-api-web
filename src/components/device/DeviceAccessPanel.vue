<template>
 <section class="device-access" :aria-label="T('DeviceAccessTitle')" v-loading="loading">
  <header><h3>{{ T('DeviceAccessTitle') }}</h3><el-tooltip :content="T('Refresh')"><el-button circle :icon="Refresh" :aria-label="T('DeviceAccessRefresh')" :disabled="loading || saving" @click="load"/></el-tooltip></header>
  <el-alert v-if="failed" :title="T('DeviceAccessLoadFailed')" type="error" :closable="false"/>
  <template v-else-if="state">
   <div class="access-summary"><el-tag :type="state.allowed ? 'info' : 'warning'" effect="plain">{{ T(accessReasonKey(state.reason)) }}</el-tag><el-tag effect="plain">{{ T(state.enforced ? 'DeviceAccessEnforced' : 'DeviceAccessNotEnforced') }}</el-tag>
    <el-tooltip v-if="state.can_manage" :content="T(blockLabel)"><el-button circle :icon="armed ? Check : state.blocked ? Unlock : Lock" :aria-label="T(blockLabel)" :loading="saving" :disabled="saving || loading" @click="block" @blur="cancel" @keydown.esc.stop.prevent="cancel"/></el-tooltip>
   </div>
   <el-table :data="state.all_paths || state.paths" border :aria-label="T('DeviceAccessPaths')" size="small">
    <el-table-column :label="T('DeviceAccessPath')" min-width="120"><template #default="{row}">{{ T(accessPathKey(row.kind)) }}</template></el-table-column>
    <el-table-column :label="T('DeviceAccessSubject')" min-width="150"><template #default="{row}"><span>{{ row.name }}</span><small v-if="row.collection_name">{{ row.collection_name }}</small></template></el-table-column>
    <el-table-column :label="T('DeviceAccessExpiry')" min-width="150"><template #default="{row}"><time v-if="row.expires_at" :datetime="new Date(row.expires_at * 1000).toISOString()">{{ new Date(row.expires_at * 1000).toLocaleString() }}</time><span v-else>{{ T('DeviceAccessNoExpiry') }}</span></template></el-table-column>
    <template #empty>{{ T('DeviceAccessNoPaths') }}</template>
   </el-table>
   <details><summary>{{ T('AccessDetailsGuide') }}</summary><p>{{ T('DeviceAccessImpact') }}</p><p>{{ T('DeviceAccessRemainingGuide') }}</p></details><small>{{ T('DeviceAccessLastChecked') }}: <time :datetime="new Date(state.checked_at * 1000).toISOString()">{{ new Date(state.checked_at * 1000).toLocaleString() }}</time></small>
  </template>
 </section>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { Refresh, Lock, Unlock, Check } from '@element-plus/icons-vue'
import { deviceAccess, blockDeviceAccess } from '@/api/peer'
import { accessPathKey, accessReasonKey } from '@/utils/deviceAccess'
import { T } from '@/utils/i18n'
const props = defineProps({ rowId: { type: Number, required: true } })
const state=ref(null), loading=ref(false), saving=ref(false), failed=ref(false), armed=ref(false)
let generation=0, timer, refreshTimer
const blockLabel=computed(()=>armed.value ? 'DeviceAccessConfirmBlock' : state.value?.blocked ? 'DeviceAccessUnblock' : 'DeviceAccessBlock')
const cancel=()=>{armed.value=false;clearTimeout(timer)}
const load=async()=>{
 if(loading.value || saving.value || !props.rowId)return
 const current=generation, row=props.rowId;loading.value=true;failed.value=false
 try {const result=await deviceAccess(row);if(current===generation)state.value=result.data}
 catch {if(current===generation)failed.value=true}
 finally {if(current===generation)loading.value=false}
}
const block=async()=>{
 if(saving.value || loading.value || !state.value)return
 if(!armed.value){armed.value=true;timer=setTimeout(cancel,5000);return}
 cancel();const current=generation,row=props.rowId;saving.value=true
 try {const result=await blockDeviceAccess(row,{version:state.value.version,blocked:!state.value.blocked});if(current===generation)state.value=result.data}
 catch {if(current===generation){failed.value=true;saving.value=false;await load()}}
 finally {if(current===generation)saving.value=false}
}
watch(()=>props.rowId,()=>{generation++;cancel();loading.value=saving.value=false;state.value=null;load()},{immediate:true})
refreshTimer=setInterval(()=>{if(!document.hidden && !armed.value)load()},15000)
onBeforeUnmount(()=>{generation++;cancel();clearInterval(refreshTimer)})
</script>

<style scoped>
.device-access{display:grid;gap:10px;border-top:1px solid var(--console-border);padding-top:14px}.device-access header,.access-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.device-access header{justify-content:space-between}.device-access h3,.device-access p{margin:0}.device-access p,.device-access small{color:var(--console-muted);line-height:1.6}.device-access small{display:block;overflow-wrap:anywhere}.device-access :deep(.el-table){font-variant-numeric:tabular-nums}
.device-access summary{color:var(--console-muted);cursor:pointer;line-height:1.8}.device-access summary:focus-visible{outline:2px solid var(--console-primary)}
</style>
