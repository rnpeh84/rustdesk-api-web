<template>
 <section class="policy-sync" :aria-label="T('PolicySyncTitle')" v-loading="loading">
  <header><h3>{{ T('PolicySyncTitle') }}</h3><el-tooltip :content="T('Refresh')"><el-button circle :icon="Refresh" :aria-label="T('PolicySyncRefresh')" :disabled="loading" @click="load"/></el-tooltip></header>
  <el-alert v-if="failed" :title="T('PolicySyncLoadFailed')" type="error" :closable="false"/>
  <template v-else-if="state">
   <div class="policy-tags"><el-tag type="info" effect="plain">{{ T(policySyncStatusKey(state)) }}</el-tag><el-tag type="warning" effect="plain">{{ T('PolicyApplyUnverified') }}</el-tag></div>
   <dl><div><dt>{{ T('PolicyDirectIP') }}</dt><dd>{{ T(directIPKey(state.desired_direct_ip)) }}</dd></div><div><dt>{{ T('PolicySyncSource') }}</dt><dd>{{ T(policySourceKey(state.source)) }}</dd></div><div><dt>{{ T('Version') }}</dt><dd>{{ state.client_version || T('NotCollected') }}</dd></div><div><dt>{{ T('PolicySyncRevision') }}</dt><dd>{{ state.revision || '-' }}</dd></div></dl>
   <details><summary>{{ T('PolicySyncDetails') }}</summary><p>{{ T(policyCapabilityKey(state.capability)) }}</p><p>{{ T('PolicySyncLimit') }}</p></details>
   <small>{{ T('PolicySyncDeliveredAt') }}: {{ formatTime(state.last_delivered_at) }}</small><small>{{ T('PolicySyncAcknowledgedAt') }}: {{ formatTime(state.last_acknowledged_at) }}</small><small>{{ T('PolicySyncCheckedAt') }}: {{ formatTime(state.checked_at) }}</small>
  </template>
 </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { devicePolicySync } from '@/api/peer'
import { policySyncStatusKey, directIPKey, policySourceKey, policyCapabilityKey } from '@/utils/policySync'
import { T } from '@/utils/i18n'
const props=defineProps({rowId:{type:Number,required:true}})
const state=ref(null),loading=ref(false),failed=ref(false)
let generation=0
const formatTime=value=>value ? new Date(value*1000).toLocaleString() : T('NotCollected')
const load=async()=>{
 if(loading.value || !props.rowId)return
 const current=generation,row=props.rowId;loading.value=true;failed.value=false
 try {const result=await devicePolicySync(row);if(current===generation)state.value=result.data}
 catch {if(current===generation)failed.value=true}
 finally {if(current===generation)loading.value=false}
}
watch(()=>props.rowId,()=>{generation++;loading.value=false;state.value=null;load()},{immediate:true})
const timer=setInterval(()=>{if(!document.hidden)load()},15000)
onBeforeUnmount(()=>{generation++;clearInterval(timer)})
</script>
<style scoped>
.policy-sync{display:grid;gap:10px;border-top:1px solid var(--console-border);padding-top:14px}.policy-sync header,.policy-tags{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.policy-sync header{justify-content:space-between}.policy-sync h3,.policy-sync p,.policy-sync dl,.policy-sync dd{margin:0}.policy-sync dl{display:grid;grid-template-columns:1fr 1fr;gap:10px}.policy-sync dt,.policy-sync p,.policy-sync small{color:var(--console-muted);line-height:1.6}.policy-sync dd,.policy-sync small{overflow-wrap:anywhere}@media(max-width:480px){.policy-sync dl{grid-template-columns:1fr}}
.policy-sync summary{color:var(--console-muted);cursor:pointer;line-height:1.8}.policy-sync summary:focus-visible{outline:2px solid var(--console-primary)}
</style>
