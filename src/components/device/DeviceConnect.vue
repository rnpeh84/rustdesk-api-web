<template>
  <div class="device-connect" @click.stop>
    <el-tooltip v-if="showClient && !clientAvailable" :content="T('Offline')">
      <span tabindex="0" :aria-label="T('Offline')">
        <el-button class="connection-icon-button" type="primary" plain disabled :aria-label="`${clientLabel} ${peer.id}`"><el-icon aria-hidden="true"><Link/></el-icon></el-button>
      </span>
    </el-tooltip>
    <el-dropdown v-else-if="showClient && clientModes.length === 2" trigger="click">
      <el-button class="connection-icon-button is-multiple" type="primary" plain :aria-label="`${T('ClientConnectionChoose')} ${peer.id}`" :title="T('ClientConnectionChoose')"><el-icon aria-hidden="true"><Link/></el-icon><el-icon class="connection-chevron" aria-hidden="true"><ArrowDown/></el-icon></el-button>
      <template #dropdown><el-dropdown-menu>
        <el-dropdown-item v-for="mode in clientModes" :key="mode"><a class="client-mode-link" :href="clientConnectionUrl(peer.id, mode)"><TerminalModeIcon v-if="mode === 'terminal'"/><el-icon v-else aria-hidden="true"><Monitor/></el-icon>{{ T(mode === 'terminal' ? 'ClientConnectionTerminal' : 'ClientConnectionDesktop') }}</a></el-dropdown-item>
      </el-dropdown-menu></template>
    </el-dropdown>
    <el-tooltip v-else-if="showClient" :content="clientLabel"><a class="el-button el-button--primary is-plain connection-icon-button" :href="clientConnectionUrl(peer.id, clientModes[0])" :aria-label="`${clientLabel} ${peer.id}`"><el-icon aria-hidden="true"><Link/></el-icon></a></el-tooltip>
    <el-tooltip v-if="!peer.row_id && showClient && appStore.setting.appConfig.web_client" :content="T('DeviceConnectionDesktop')"><el-button class="connection-icon-button" type="primary" plain :aria-label="`${T('DeviceConnectionDesktop')} ${peer.id}`" @click="toWebClientLink(peer)"><el-icon aria-hidden="true"><Monitor/></el-icon></el-button></el-tooltip>
    <el-dropdown v-else-if="peer.row_id && modes.length === 2" ref="choice" trigger="click" @command="connect">
      <el-button class="connection-icon-button is-multiple" type="primary" plain :aria-label="buttonAria" :title="T('DeviceConnectionChoose')" @keydown.enter.stop.prevent="choice?.handleOpen()" @keydown.space.stop.prevent="choice?.handleOpen()" @keydown.down.stop.prevent="choice?.handleOpen()">
          <el-icon aria-hidden="true"><Monitor/></el-icon><TerminalModeIcon/><el-icon class="connection-chevron" aria-hidden="true"><ArrowDown/></el-icon>
        </el-button>
      <template #dropdown><el-dropdown-menu>
        <el-dropdown-item command="desktop"><el-icon aria-hidden="true"><Monitor/></el-icon>{{ T('DeviceConnectionDesktop') }}</el-dropdown-item>
        <el-dropdown-item command="terminal"><TerminalModeIcon/>{{ T('DeviceConnectionTerminal') }}</el-dropdown-item>
      </el-dropdown-menu></template>
    </el-dropdown>
    <el-tooltip v-else-if="peer.row_id" :content="modes.length ? buttonLabel : unavailableReason">
      <span :tabindex="!modes.length ? 0 : undefined" :aria-label="!modes.length ? unavailableReason : undefined">
        <el-button class="connection-icon-button" type="primary" plain :disabled="!modes.length" :aria-label="buttonAria" @click="connect(modes[0])">
          <TerminalModeIcon v-if="modes[0] === 'terminal'"/><el-icon v-else aria-hidden="true"><Monitor/></el-icon>
        </el-button>
      </span>
    </el-tooltip>
    <WebTerminal v-if="peer.row_id" ref="terminal" :peer="peer" :show-entry="false"/>
  </div>
</template>

<script setup>
import {computed,onActivated,onBeforeUnmount,onDeactivated,onMounted,ref} from 'vue'
import {ArrowDown, Link, Monitor} from '@element-plus/icons-vue'
import {clientConnectionUrl} from '@/utils/peer'
import {useAppStore} from '@/store/app'
import TerminalModeIcon from './TerminalModeIcon.vue'
import {terminalStatus} from '@/api/terminal'
import {toWebClientLink} from '@/utils/webclient'
import {T} from '@/utils/i18n'
import WebTerminal from './WebTerminal.vue'
const props=defineProps({peer:{type:Object,required:true},showClient:{type:Boolean,default:false}})
const appStore=useAppStore()
const choice=ref(null),terminal=ref(null),now=ref(Date.now())
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
const buttonAria=computed(()=>[modes.value.length===2?T('DeviceConnectionChoose'):buttonLabel.value,props.peer.id].join(' '))
const clientModes=computed(()=>{
  if(!fresh.value)return ['desktop']
  const result=[]
  if(availability.value.desktop_state==='available')result.push('desktop')
  if(availability.value.terminal_state==='available')result.push('terminal')
  return result.length?result:['desktop']
})
const clientLabel=computed(()=>T(clientModes.value[0]==='terminal'?'ClientConnectionTerminal':'ClientConnectionDesktop'))
const clientAvailable=computed(()=>{
  // 서버에 등록되지 않은 외부 주소록 항목은 온라인 상태를 알 수 없어 기존 링크를 유지한다.
  if(!props.peer.row_id)return true
  if(fresh.value)return !!availability.value.service_running
  const lastOnline=Number(availability.value.device?.last_online_time ?? props.peer.last_online_time)||0
  return lastOnline>0&&now.value/1000-lastOnline<60
})
const unavailableReason=computed(()=>T(!availability.value.reported_at?'DeviceConnectionReportNeeded':!fresh.value?'DeviceConnectionUnknown':!availability.value.service_running?'DeviceConnectionOffline':availability.value.terminal_state==='permission_required'?'DeviceConnectionLoginNeeded':['disabled','unsupported'].includes(availability.value.terminal_state)?`DeviceConnectionTerminal_${availability.value.terminal_state}`:availability.value.desktop_state==='available'&&!availability.value.desktop_web_enabled?'DeviceConnectionWebDisabled':'DeviceConnectionUnavailable'))
const refresh=async()=>{
  now.value=Date.now()
  if(!props.peer.row_id||!enabled||fetching||document.visibilityState==='hidden')return
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
.device-connect { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex: 0 0 auto; min-width: 0; line-height: 1; }
.client-mode-link { display: inline-flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; }
.connection-icon-button {
  margin: 0; font-size: 17px; line-height: 1; touch-action: manipulation;
}
.connection-icon-button:focus-visible { outline: 2px solid var(--console-primary); outline-offset: 2px; }
.connection-icon-button :deep(span) { display: inline-flex; align-items: center; gap: 5px; }
.connection-icon-button :deep(svg) { width: 1em; height: 1em; }
.connection-icon-button :deep(.el-icon) { font-size: inherit; }
.connection-icon-button :deep(.connection-chevron) { font-size: 12px; }
@media (prefers-reduced-motion: reduce) { .connection-icon-button { transition: none; } }
</style>
