<template>
  <main class="remote-terminal-host">
    <div v-if="failure" class="remote-terminal-error" role="alert"><p>{{ T(failure) }}</p><el-button @click="load">{{ T('WebTerminalRecheck') }}</el-button></div>
    <p v-else-if="!peer" class="remote-terminal-loading" role="status">{{ T('TerminalState_checking') }}</p>
    <WebTerminal v-if="peer" ref="terminal" :peer="peer" :show-entry="false" embedded @state="sendState" @workspace="sendView" @auth="sendAuth"/>
  </main>
</template>
<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { T } from '@/utils/i18n'
import { terminalWorkspace, terminalStatus } from '@/api/terminal'
import { isDark } from '@/utils/theme'
import WebTerminal from '@/components/device/WebTerminal.vue'
const route = useRoute(), peer = ref(null), terminal = ref(null), failure = ref('')
const device = String(route.params.deviceId || '')
let alive = true, generation = 0
let authPort
const sendAuth = value => authPort?.postMessage({type:'auth',required:value.required===true,busy:value.busy===true})
const sendState = state => { if (parent !== window) parent.postMessage({ type: 'rede-terminal-state', device, state }, location.origin) }
const sendView = value => { if (parent !== window) parent.postMessage({type:'rede-terminal-view',device,...value},location.origin) }
const load = async () => {
  const version = ++generation
  failure.value = ''; peer.value = null
  try {
    if (!/^[\w-]{1,64}$/.test(device)) throw new Error('device')
    const resolved = await terminalWorkspace(device)
    if (!alive || version !== generation) return
    if (resolved.data.id !== device || !Number.isSafeInteger(resolved.data.row_id) || resolved.data.row_id < 1) throw new Error('device')
    const status = await terminalStatus(resolved.data.row_id)
    if (!alive || version !== generation) return
    peer.value = resolved.data
    await nextTick()
    if (alive && version === generation) await terminal.value?.open(status.data)
  } catch { if (alive && version === generation) { failure.value = 'TerminalHelp_access_denied'; sendState('unavailable') } }
}
const message = event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'rede-terminal-control' || event.data.device !== device) return
  if (event.data.action === 'bind-auth' && event.ports.length === 1) {
    authPort?.close(); const port = event.ports[0]; authPort = port
    port.onmessage = ({data}) => {
      if (!alive || authPort !== port) return
      if (data?.type === 'submit' && typeof data.password === 'string' && data.password.length <= 128) terminal.value?.submitWorkspaceAuth(data.password)
    }
    sendAuth(terminal.value?.workspaceAuth() || {required:false,busy:false})
  }
  if (event.data.action === 'visibility') terminal.value?.setWorkspaceVisible(event.data.active === true)
  if (event.data.action === 'theme' && typeof event.data.dark === 'boolean') isDark.value = event.data.dark
  if (event.data.action === 'command' && ['find','copy','paste','save-output','files','notifications','settings','reconnect'].includes(event.data.command)) {
    if (event.data.command === 'reconnect' && !peer.value) void load()
    else terminal.value?.workspaceCommand(event.data.command)
  }
  if (event.data.action === 'close' && Number.isSafeInteger(event.data.request)) {
    const request=event.data.request
    Promise.resolve(terminal.value?.requestWorkspaceClose() ?? true).then(allowed=>{
      parent.postMessage({type:'rede-terminal-close',device,request,allowed:allowed===true},location.origin)
    }).catch(()=>parent.postMessage({type:'rede-terminal-close',device,request,allowed:false},location.origin))
  }
}
onMounted(() => {
  window.addEventListener('message', message)
  if (parent !== window) parent.postMessage({type:'rede-terminal-auth-ready',device},location.origin)
  sendState('checking'); void load()
})
onBeforeUnmount(() => { alive = false; generation++; authPort?.close(); window.removeEventListener('message', message) })
</script>
<style scoped>
.remote-terminal-host{height:100dvh;min-width:0;overflow:hidden;background:var(--el-bg-color)}
.remote-terminal-error,.remote-terminal-loading{padding:24px;color:var(--el-text-color-secondary);font-size:13px;line-height:1.7}
</style>
