<template>
  <div class="web-terminal-entry" @click.stop>
    <span v-if="showEntry" class="terminal-status" :class="`terminal-${state}`">{{ T(`TerminalState_${state}`) }}</span>
    <div v-if="showEntry">
      <el-button type="primary" link :disabled="blocked" @click="visible = true">{{ T('WebTerminalConnect') }}</el-button>
      <el-button v-if="blocked" link @click="visible = true">{{ T('WebTerminalRecheck') }}</el-button>
    </div>
    <el-dialog v-model="visible" :title="T('WebTerminalTitle', { param: peer.id })" width="min(960px, calc(100vw - 24px))" append-to-body destroy-on-close :close-on-click-modal="false" @closed="dispose">
      <p class="terminal-explanation">{{ T('WebTerminalExplanation') }}</p>
      <el-form v-if="!active" @submit.prevent="connect">
        <el-checkbox v-if="hasSaved" v-model="useSaved" :disabled="busy">{{ T('WebTerminalSavedPassword') }}</el-checkbox>
        <el-form-item v-if="!useSaved" :label="T('WebTerminalPassword')">
          <el-input v-model="password" type="password" name="device-password" show-password autocomplete="off" maxlength="128" :aria-label="T('WebTerminalPassword')" :disabled="busy"/>
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="busy">{{ T('WebTerminalCheckConnect') }}</el-button>
      </el-form>
      <div class="terminal-session-status" role="status" aria-live="polite">
        <strong>{{ T(`TerminalState_${state}`) }}</strong>
        <span>{{ T(`TerminalHelp_${state}`) }}</span>
      </div>
      <div v-show="active" ref="screen" class="terminal-screen" :aria-label="T('WebTerminalTitle', { param: peer.id })"/>
      <template #footer>
        <el-button v-if="socket" @click="disconnect">{{ T('WebTerminalDisconnect') }}</el-button>
        <el-button @click="visible = false">{{ T('Close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import '@xterm/xterm/css/xterm.css'
import { T } from '@/utils/i18n'
import { prepareTerminal, terminalStatus } from '@/api/terminal'

const props = defineProps({ peer: { type: Object, required: true }, showEntry:{type:Boolean,default:true} })
const state = ref('unknown')
const blocked = computed(() => ['disabled', 'unsupported'].includes(state.value))
const visible = ref(false)
const password = ref('')
const useSaved = ref(false)
const hasSaved = ref(false)
const busy = ref(false)
const active = ref(false)
const screen = ref(null)
const socket = ref(null)
let terminal, fit, observer, expiry, attempt = 0, alive = true
const states = new Set(['unknown', 'checking', 'allowed', 'ready', 'disabled', 'unsupported', 'auth_required', 'unavailable', 'configuration', 'pty_failed', 'busy'])
const setState = value => { state.value = states.has(value) ? value : 'unavailable' }
const send = message => { if (socket.value?.readyState === WebSocket.OPEN) socket.value.send(JSON.stringify(message)) }
const clearTerminal = () => { observer?.disconnect(); observer = null; terminal?.dispose(); terminal = null; fit = null; active.value = false }
const disconnect = () => {
  attempt++
  const current = socket.value
  socket.value = null
  if (current) { current.onopen = current.onmessage = current.onerror = current.onclose = null; if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: 'close' })); current.close() }
  busy.value = false
  clearTerminal()
  if (['ready', 'allowed', 'checking'].includes(state.value)) setState('unknown')
}
const dispose = () => { disconnect(); password.value = '' }
watch(visible, value => { if (!value) dispose() })
const setupTerminal = async current => {
  active.value = true
  await nextTick()
  if (socket.value !== current || !screen.value) return
  const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
  if (socket.value !== current || !screen.value) return
  terminal = new Terminal({ cursorBlink: true, disableStdin: true, screenReaderMode: true, scrollback: 2000, fontSize: 14, theme: { background: '#111827', foreground: '#e5e7eb' } })
  fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(screen.value)
  terminal.parser.registerOscHandler(52, () => true)
  fit.fit()
  terminal.onData(data => {
    if (state.value !== 'ready') return
    const bytes = new TextEncoder().encode(data)
    if (bytes.length > 16384) return
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
    send({ type: 'input', data: btoa(binary) })
  })
  observer = new ResizeObserver(() => { if (!terminal || !visible.value) return; fit.fit(); if (state.value === 'ready') send({ type: 'resize', rows: terminal.rows, cols: terminal.cols }) })
  observer.observe(screen.value)
  send({ type: 'open', rows: terminal.rows, cols: terminal.cols })
}
const connect = async () => {
  if (busy.value || socket.value) return
  const generation = ++attempt
  busy.value = true
  setState('checking')
  try {
    const res = await prepareTerminal({ peer_id: props.peer.row_id, password: useSaved.value ? '' : password.value, use_saved: useSaved.value })
    password.value = ''
    if (generation !== attempt || !visible.value) return
    const api = new URL(import.meta.env.VITE_SERVER_API || '/api/admin', window.location.href)
    const url = new URL(res.data.websocket_path, api.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const current = new WebSocket(url, ['rustdesk-terminal-v1', `ticket.${res.data.ticket}`])
    socket.value = current
    current.onmessage = event => {
      if (socket.value !== current) return
      let msg; try { msg = JSON.parse(event.data) } catch { disconnect(); setState('unavailable'); return }
      if (msg.type === 'ping') { send({ type: 'pong' }); return }
      if (msg.type === 'status') {
        setState(msg.state)
        if (msg.state === 'allowed') setupTerminal(current).catch(() => { disconnect(); setState('unavailable') })
      } else if (msg.type === 'opened') {
        busy.value = false; setState('ready'); if (terminal) { terminal.options.disableStdin = false; terminal.focus() }
      } else if (msg.type === 'output' && terminal && typeof msg.data === 'string') {
        try { terminal.write(Uint8Array.from(atob(msg.data), c => c.charCodeAt(0))) } catch { disconnect(); setState('unavailable') }
      } else if (msg.type === 'error') {
        disconnect(); setState(msg.state)
      } else if (msg.type === 'closed') disconnect()
    }
    current.onerror = () => { disconnect(); setState('unavailable') }
    current.onclose = () => { disconnect() }
  } catch { if (generation === attempt) { busy.value = false; setState('unavailable') } }
}
onMounted(async () => {
  expiry = setInterval(() => { if (!socket.value && !visible.value) setState('unknown') }, 60000)
  if(!props.showEntry)return
  try { const res = await terminalStatus(props.peer.row_id); if (alive && !socket.value && !visible.value) { setState(res.data.state); hasSaved.value = !!res.data.has_saved_password; useSaved.value = hasSaved.value } } catch { /* 조회 실패 시 활성 여부를 추측하지 않는다. */ }
})
onDeactivated(dispose)
defineExpose({open:async availability=>{hasSaved.value=!!availability.has_saved_password;useSaved.value=hasSaved.value;visible.value=true;await nextTick();if(hasSaved.value)await connect()}})
onBeforeUnmount(() => { alive = false; clearInterval(expiry); dispose() })
</script>

<style scoped>
.web-terminal-entry { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; }
.terminal-status { color: var(--el-text-color-secondary); }
.terminal-ready, .terminal-allowed { color: var(--el-color-success); }
.terminal-disabled, .terminal-pty_failed { color: var(--el-color-danger); }
.terminal-explanation { margin: 0 0 16px; color: var(--el-text-color-regular); line-height: 1.6; }
.terminal-session-status { display: flex; flex-direction: column; gap: 4px; margin: 16px 0; line-height: 1.5; }
.terminal-session-status span { color: var(--el-text-color-secondary); }
.terminal-screen { background: #111827; padding: 12px; height: min(55vh, 520px); min-height: 200px; border-radius: 6px; overflow: hidden; }
.terminal-screen :deep(.xterm) { height: 100%; }
@media (max-width: 600px) { .terminal-screen { padding: 6px; } }
</style>
