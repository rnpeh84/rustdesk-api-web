<template>
  <div class="device-connect" @click.stop>
    <el-dropdown v-if="modes.length === 2" trigger="click" @command="connect">
      <el-button type="primary" :aria-label="`${T('DeviceConnectionChoose')} ${peer.id}`">{{ T('DeviceConnectionChoose') }} <el-icon class="choice-icon" aria-hidden="true"><ArrowDown/></el-icon></el-button>
      <template #dropdown><el-dropdown-menu>
        <el-dropdown-item command="desktop">{{ T('DeviceConnectionDesktop') }}</el-dropdown-item>
        <el-dropdown-item command="terminal">{{ T('DeviceConnectionTerminal') }}</el-dropdown-item>
      </el-dropdown-menu></template>
    </el-dropdown>
    <el-tooltip v-else :content="unavailableReason" :disabled="!!modes.length"><span :tabindex="!modes.length ? 0 : undefined" :aria-label="!modes.length ? unavailableReason : undefined"><el-button type="primary" :disabled="!modes.length" :aria-label="`${buttonLabel} ${peer.id}`" @click="connect(modes[0])">{{ buttonLabel }}</el-button></span></el-tooltip>
    <WebTerminal ref="terminal" :peer="peer" :show-entry="false"/>
  </div>
</template>

<script setup>
import {computed,onActivated,onBeforeUnmount,onDeactivated,onMounted,ref} from 'vue'
import {ArrowDown} from '@element-plus/icons'
import {terminalStatus} from '@/api/terminal'
import {toWebClientLink} from '@/utils/webclient'
import {T} from '@/utils/i18n'
import WebTerminal from './WebTerminal.vue'
const props=defineProps({peer:{type:Object,required:true}})
const terminal=ref(null),now=ref(Date.now())
const availability=ref({desktop_state:'unknown',terminal_state:'unknown',reported_at:0,desktop_web_enabled:false})
let timer,alive=true,fetching=false,enabled=true
const fresh=computed(()=>availability.value.reported_at>0&&now.value/1000-availability.value.reported_at<=90)
const modes=computed(()=>{
  if(!fresh.value||!availability.value.service_running)return []
  const result=[]
  if(availability.value.desktop_state==='available'&&availability.value.desktop_web_enabled)result.push('desktop')
  if(availability.value.terminal_state==='available'&&!['disabled','unsupported'].includes(availability.value.state))result.push('terminal')
  return result
})
const buttonLabel=computed(()=>T(modes.value.length?modes.value[0]==='desktop'?'DeviceConnectionDesktop':'DeviceConnectionTerminal':'DeviceConnectionUnavailable'))
const unavailableReason=computed(()=>T(!availability.value.reported_at?'DeviceConnectionReportNeeded':!fresh.value?'DeviceConnectionUnknown':!availability.value.service_running?'DeviceConnectionOffline':availability.value.terminal_state==='permission_required'?'DeviceConnectionLoginNeeded':['disabled','unsupported'].includes(availability.value.terminal_state)?`DeviceConnectionTerminal_${availability.value.terminal_state}`:availability.value.desktop_state==='available'&&!availability.value.desktop_web_enabled?'DeviceConnectionWebDisabled':'DeviceConnectionUnavailable'))
const refresh=async()=>{
  now.value=Date.now()
  if(!enabled||fetching||document.visibilityState==='hidden')return
  fetching=true
  try{const res=await terminalStatus(props.peer.row_id);if(alive&&enabled)availability.value=res.data}
  catch{if(alive)availability.value={...availability.value,reported_at:0}}
  finally{fetching=false}
}
const connect=mode=>{
  if(!modes.value.includes(mode))return
  if(mode==='desktop')toWebClientLink(props.peer)
  else terminal.value?.open(availability.value)
}
onMounted(()=>{refresh();timer=setInterval(refresh,15000);document.addEventListener('visibilitychange',refresh)})
onActivated(()=>{enabled=true;refresh()})
onDeactivated(()=>{enabled=false})
onBeforeUnmount(()=>{alive=false;enabled=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)})
</script>

<style scoped>
.device-connect{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}.connection-summary,.connection-hint{font-size:12px;line-height:1.5;text-align:center;color:var(--el-text-color-secondary);overflow-wrap:anywhere}.connection-hint{max-width:240px}.choice-icon{margin-left:6px}.device-connect :deep(.el-button){white-space:normal;height:auto;min-height:32px;line-height:1.5}.device-connect :deep(.web-terminal-entry){margin:0}
</style>
