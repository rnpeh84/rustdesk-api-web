<template>
 <section class="policy-sync" :aria-label="T('PolicySyncTitle')" v-loading="loading">
  <header><h3>{{ T('PolicySyncTitle') }}</h3><el-tooltip :content="T('Refresh')"><el-button circle :icon="Refresh" :aria-label="T('PolicySyncRefresh')" :disabled="loading" @click="load"/></el-tooltip></header>
  <el-alert v-if="failed" :title="T('PolicySyncLoadFailed')" type="error" :closable="false"/>
  <template v-else-if="state">
   <div class="policy-tags" role="status" aria-live="polite"><el-tooltip :content="T('PolicyReceiptHint')"><el-tag :type="state.status === 'acknowledged' && policySyncStatusKey(state) === 'PolicySyncAcknowledged' ? 'success' : 'info'" effect="plain" tabindex="0">{{ T(policySyncStatusKey(state)) }}</el-tag></el-tooltip></div>
   <details v-for="policy in state.policies || []" :key="policy.policy_id" class="policy-settings">
    <summary><span>{{ policy.name }}</span><small>v{{ policy.version }}</small></summary>
    <dl><div v-for="[key,value] in policyOptionEntries(policy.options)" :key="key"><dt>{{ T(policyOptionKey(key)) }}</dt><dd>{{ T(policyOptionValueKey(value)) }}<el-tag v-if="state.effective_options?.[key] !== value" type="info" size="small" effect="plain">{{ T('PolicyOverridden') }}</el-tag></dd></div></dl>
    <p v-if="!policyOptionEntries(policy.options).length">{{ T('PolicyNoClientOptions') }}</p>
   </details>
   <details v-if="state.policies?.length > 1 && policyOptionEntries(state.effective_options).length" class="policy-settings"><summary>{{ T('PolicyEffectiveSettings') }}</summary><dl><div v-for="[key,value] in policyOptionEntries(state.effective_options)" :key="key"><dt>{{ T(policyOptionKey(key)) }}</dt><dd>{{ T(policyOptionValueKey(value)) }}</dd></div></dl></details>
   <p v-if="!state.policies?.length">{{ T(policySourceKey(state.source)) }}</p>
   <small v-if="state.last_acknowledged_at">{{ T('PolicySyncAcknowledgedAt') }}: {{ formatTime(state.last_acknowledged_at) }}</small>
   <details><summary>{{ T('PolicySyncDetails') }}</summary><p>{{ T('PolicyReceiptHint') }}</p><p v-if="!state.supported">{{ T(policyCapabilityKey(state.capability)) }}</p><dl><div><dt>{{ T('PolicySyncRevision') }}</dt><dd>{{ state.revision || '-' }}</dd></div><div v-if="state.last_delivered_at"><dt>{{ T('PolicySyncDeliveredAt') }}</dt><dd>{{ formatTime(state.last_delivered_at) }}</dd></div><div><dt>{{ T('PolicySyncCheckedAt') }}</dt><dd>{{ formatTime(state.checked_at) }}</dd></div></dl></details>
  </template>
 </section>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { devicePolicySync } from '@/api/peer'
import { policySyncStatusKey, policySourceKey, policyCapabilityKey, policyOptionEntries, policyOptionKey, policyOptionValueKey } from '@/utils/policySync'
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
.policy-sync{display:grid;gap:10px;border-top:1px solid var(--console-border);padding-top:14px}.policy-sync header,.policy-tags{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.policy-sync header{justify-content:space-between}.policy-sync h3,.policy-sync p,.policy-sync dl,.policy-sync dd{margin:0}.policy-sync dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.policy-sync dt,.policy-sync p,.policy-sync small{color:var(--console-muted);line-height:1.6}.policy-sync dl>div{min-width:0}.policy-sync details dl{margin-top:10px}.policy-sync dd,.policy-sync small{overflow-wrap:anywhere}@media(max-width:480px){.policy-sync dl{grid-template-columns:1fr}}
.policy-settings summary{display:flex;align-items:center;gap:8px;overflow-wrap:anywhere}.policy-settings summary span{min-width:0}.policy-settings dd{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.policy-settings summary::before{content:"▸"}.policy-settings[open] summary::before{content:"▾"}.policy-sync summary{color:var(--console-muted);cursor:pointer;line-height:1.8}.policy-sync summary:focus-visible{outline:2px solid var(--console-primary)}
</style>
