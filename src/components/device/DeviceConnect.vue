<template>
  <div class="device-connect" @click.stop>
    <el-dropdown v-if="modes.length === 2" ref="choice" trigger="click" @command="connect">
      <el-button class="connection-icon-button is-multiple" :aria-label="buttonAria" :title="T('DeviceConnectionChoose')" @keydown.enter.stop.prevent="choice?.handleOpen()" @keydown.space.stop.prevent="choice?.handleOpen()" @keydown.down.stop.prevent="choice?.handleOpen()">
          <el-icon aria-hidden="true"><Monitor/></el-icon><TerminalModeIcon/><el-icon class="connection-chevron" aria-hidden="true"><ArrowDown/></el-icon>
        </el-button>
      <template #dropdown><el-dropdown-menu>
        <el-dropdown-item command="desktop"><el-icon aria-hidden="true"><Monitor/></el-icon>{{ T('DeviceConnectionDesktop') }}</el-dropdown-item>
        <el-dropdown-item command="terminal"><TerminalModeIcon/>{{ T('DeviceConnectionTerminal') }}</el-dropdown-item>
      </el-dropdown-menu></template>
    </el-dropdown>
    <el-tooltip v-else :content="modes.length ? buttonLabel : unavailableReason">
      <span :tabindex="!modes.length ? 0 : undefined" :aria-label="!modes.length ? unavailableReason : undefined">
        <el-button class="connection-icon-button" :disabled="!modes.length" :aria-label="buttonAria" @click="connect(modes[0])">
          <TerminalModeIcon v-if="modes[0] === 'terminal'"/><el-icon v-else aria-hidden="true"><Monitor/></el-icon>
        </el-button>
      </span>
    </el-tooltip>
    <WebTerminal ref="terminal" :peer="peer" :show-entry="false"/>
  </div>
</template>

<script setup>
import {computed,onActivated,onBeforeUnmount,onDeactivated,onMounted,ref} from 'vue'
import {ArrowDown, Monitor} from '@element-plus/icons-vue'
import TerminalModeIcon from './TerminalModeIcon.vue'
import {terminalStatus} from '@/api/terminal'
import {toWebClientLink} from '@/utils/webclient'
import {T} from '@/utils/i18n'
import WebTerminal from './WebTerminal.vue'
const props=defineProps({peer:{type:Object,required:true}})
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
.device-connect { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-width: 0; line-height: 1; }
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
