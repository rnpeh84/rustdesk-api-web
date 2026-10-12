<template>
 <section class="manual-enrollment" :aria-label="T('ManualInstall')" :aria-busy="busy">
  <div class="manual-actions">
   <a class="el-button" href="https://github.com/rustdesk/rustdesk/releases/latest" target="_blank" rel="noopener noreferrer"><el-icon aria-hidden="true"><Download/></el-icon>{{ T('ManualDownload') }}</a>
   <el-select v-model="platform" :aria-label="T('OperatingSystem')" :disabled="busy"><el-option label="Windows" value="windows"/><el-option label="Linux" value="linux"/><el-option label="macOS" value="macos"/></el-select>
   <el-button type="primary" :icon="Connection" :loading="busy" :disabled="!serverReady" @click="prepare">{{ T('ManualPrepare') }}</el-button>
  </div>
  <p class="manual-brief">{{ T('ManualInstallBrief') }}</p>
  <div v-if="token" class="registration-result" aria-live="polite">
   <div class="registration-toolbar"><el-tag :type="state?.registered ? 'success' : 'info'" effect="plain">{{ T(error ? 'ManualStatusUnverified' : registrationStatusKey(state)) }}</el-tag><span v-if="active">{{ T('OfficialInstallUntil') }} {{ new Date(expiresAt*1000).toLocaleTimeString() }}</span>
    <el-tooltip :content="T('Refresh')"><el-button circle :icon="Refresh" :aria-label="T('ManualRefresh')" :disabled="checking || busy" @click="refresh"/></el-tooltip>
    <el-tooltip v-if="active" :content="T('ManualRevoke')"><el-button circle :icon="Close" :aria-label="T('ManualRevoke')" :disabled="busy" @click="revoke"/></el-tooltip>
   </div>
   <template v-if="!state?.registered && active">
    <el-input :model-value="command" type="textarea" readonly :autosize="{minRows:2,maxRows:5}" :aria-label="T('ManualCommand')" :spellcheck="false"/>
    <el-button :icon="DocumentCopy" :disabled="busy" @click="copy">{{ T('Copy') }}</el-button>
   </template>
   <div v-if="state?.registered && !error" class="registration-device"><strong translate="no">{{ state.device_id }}</strong><el-tag effect="plain" :type="state.online ? 'success' : 'info'">{{ T(state.online ? 'Online' : 'Offline') }}</el-tag><router-link to="/my/peer">{{ T('ManualOpenDevice') }}</router-link></div>
  </div>
  <p v-if="error" class="registration-error" role="alert">{{ T('ManualRequestFailed') }}</p>
  <details class="manual-guide"><summary>{{ T('ManualSteps') }}</summary><ol><li>{{ T('ManualStepInstall') }}</li><li>{{ T('ManualStepSettings') }}</li><li>{{ T('ManualStepRegister') }}</li></ol><p>{{ T('ManualViewerLogin') }}</p><p>{{ T('ManualCommandScope') }}</p></details>
 </section>
</template>
<script setup>
import {computed,onActivated,onBeforeUnmount,onDeactivated,ref,watch} from 'vue'
import {Close,Connection,DocumentCopy,Download,Refresh} from '@element-plus/icons-vue'
import {ElMessage} from 'element-plus'
import {prepareManualRegistration,manualRegistrationStatus,revokeManualRegistration} from '@/api/clientRelease'
import {registrationStatusKey,registrationCommandActive} from '@/utils/manualEnrollment'
import {T} from '@/utils/i18n'
const props=defineProps({server:{type:Object,required:true}})
const platform=ref(/Win/i.test(navigator.userAgent) ? 'windows' : /Mac/i.test(navigator.userAgent) ? 'macos':'linux')
const token=ref(''),command=ref(''),expiresAt=ref(0),clock=ref(Date.now()),state=ref(null),busy=ref(false),checking=ref(false),error=ref(false)
const active=computed(()=>registrationCommandActive(expiresAt.value,clock.value) && state.value?.command_active!==false)
const serverReady=computed(()=>!!props.server.api_server && !!props.server.id_server && !!props.server.key)
let generation=0,visible=true
const clear=()=>{generation++;token.value=command.value='';expiresAt.value=0;state.value=null;error.value=false;busy.value=checking.value=false}
const refresh=async()=>{
 if(!token.value || checking.value)return
 const current=generation,raw=token.value;checking.value=true
 try {const result=await manualRegistrationStatus(raw);if(current===generation){state.value=result.data;error.value=false}}
 catch{if(current===generation)error.value=true}
 finally{if(current===generation)checking.value=false}
}
const prepare=async()=>{
 if(busy.value || !serverReady.value)return
 clear();const current=generation;busy.value=true
 try {const result=await prepareManualRegistration({platform:platform.value});if(current===generation){token.value=result.data.registration_token;command.value=result.data.command;expiresAt.value=result.data.expires_at;await refresh()}}
 catch{if(current===generation)error.value=true}
 finally{if(current===generation)busy.value=false}
}
const copy=async()=>{if(!active.value || !command.value)return;try{await navigator.clipboard.writeText(command.value);ElMessage.success(T('Copied'))}catch{ElMessage.warning(T('OfficialInstallCopyFailed'))}}
const revoke=async()=>{
 if(busy.value || !token.value)return
 const current=generation;busy.value=true
 try {await revokeManualRegistration(token.value);if(current===generation){expiresAt.value=0;command.value='';await refresh()}}
 catch{if(current===generation)error.value=true}
 finally{if(current===generation)busy.value=false}
}
watch(platform,clear)
watch(()=>[props.server.api_server,props.server.id_server,props.server.key],clear)
const timer=setInterval(()=>{clock.value=Date.now();if(visible && !document.hidden && token.value && !busy.value)refresh()},5000)
onDeactivated(()=>{visible=false;clear()})
onActivated(()=>{visible=true})
onBeforeUnmount(()=>{clearInterval(timer);clear()})
</script>
<style scoped>
.manual-enrollment{display:grid;gap:12px}.manual-actions,.registration-toolbar,.registration-device{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.manual-actions :deep(.el-select){width:140px}.manual-actions a{margin:0;text-decoration:none}.manual-brief,.manual-guide p{margin:0;color:var(--console-muted);line-height:1.6}.registration-result{display:grid;gap:10px;min-width:0}.registration-toolbar span{color:var(--console-muted);font-size:12px}.registration-device strong{overflow-wrap:anywhere}.registration-error{margin:0;color:var(--el-color-danger)}.manual-guide summary{cursor:pointer;line-height:1.8;color:var(--console-muted)}.manual-guide summary:focus-visible{outline:2px solid var(--console-primary);outline-offset:3px}.manual-guide ol{padding-inline-start:22px;line-height:1.8}.manual-guide p{margin-top:8px}@media(max-width:480px){.manual-actions{gap:8px}.manual-actions :deep(.el-select){flex:1;min-width:120px}.manual-actions>.el-button:last-child{width:100%;margin:0}}
</style>
