<template>
  <div class="web-terminal-entry" @click.stop>
    <div v-if="showEntry">
      <el-button type="primary" link :disabled="blocked" @click="visible = true">{{ T('WebTerminalConnect') }}</el-button>
      <el-button v-if="blocked" link @click="visible = true">{{ T('WebTerminalRecheck') }}</el-button>
    </div>
    <el-dialog v-model="visible" class="terminal-dialog" :class="{ 'terminal-expanded': expanded }" :modal-class="expanded ? 'terminal-expanded-overlay' : ''" :fullscreen="expanded" :title="T('WebTerminalTitle', { param: peer.id })" width="min(1100px, calc(100vw - 24px))" append-to-body destroy-on-close :close-on-click-modal="false" :before-close="requestClose" @opened="attachNotifications" @closed="dispose" @keydown.capture="recordActivity" @pointerdown.capture="recordActivity" @wheel.capture.passive="recordActivity" @drop.capture="recordActivity">
      <template #header="{ titleId }"><div class="terminal-heading" @contextmenu.prevent="workspaceMenu"><span :id="titleId">{{ T('WebTerminalTitle', { param: peer.id }) }}</span><div class="terminal-toolbar" role="toolbar" :aria-label="T('TerminalToolbar')">
        <el-button v-if="filesAllowed" :disabled="!active || state !== 'ready'" :icon="FolderOpened" :aria-label="T('DeviceFiles')" :title="T('DeviceFiles')" :aria-pressed="filesVisible" @click="toggleFiles"/>
        <el-button :disabled="!active" :icon="Search" :aria-label="T('TerminalFind')" :title="T('TerminalFind')" :aria-pressed="findVisible" @click="openFind"/>
        <el-button :icon="MoreFilled" :aria-label="T('TerminalActions')" :title="T('TerminalActions')" @click="toolbarMenu"/>
        <el-button :icon="Setting" :aria-label="T('TerminalSettings')" :title="T('TerminalSettings')" @click="settingsVisible = true"/>
      </div><span class="terminal-hostname" :title="hostname">{{ hostname }}</span></div><el-button class="terminal-expand-button" :aria-label="T(expanded ? 'TerminalRestore' : 'TerminalExpand')" :title="T(expanded ? 'TerminalRestore' : 'TerminalExpand')" :aria-pressed="expanded" @click="expanded = !expanded"><WindowSizeIcon :restore="expanded"/></el-button></template>
      <el-form v-if="!active" class="terminal-connect-form" :class="{'has-password':!useSaved}" @submit.prevent="connect">
        <el-checkbox v-if="hasSaved" v-model="useSaved" :disabled="busy">{{ T('WebTerminalSavedPassword') }}</el-checkbox>
        <el-form-item v-if="!useSaved" :label="T('WebTerminalPassword')">
          <el-input v-model="password" type="password" name="device-password" show-password autocomplete="off" maxlength="128" :aria-label="T('WebTerminalPassword')" :disabled="busy"/>
        </el-form-item>
        <el-button type="primary" native-type="submit" :loading="busy">{{ T('WebTerminalCheckConnect') }}</el-button>
      </el-form>
      <div class="terminal-session-status" :class="{'is-connected':state === 'ready'}" role="status" aria-live="polite" @contextmenu.prevent="workspaceMenu">
        <strong>{{ T(`TerminalState_${state}`) }}</strong>
        <ResourceMeters v-if="state === 'ready'" :resources="resourceStatus.resources" :reported-at="resourceStatus.reported_at" :active="resourceStatus.service_running"/>
        <span v-if="failureStage || !['unknown','checking','allowed','ready'].includes(state)">{{ T(`TerminalHelp_${state}`) }}</span>
        <span v-if="failureStage" class="terminal-failure-stage">{{ T('TerminalFailureStage') }}: {{ T(`TerminalStage_${failureStage}`) }}</span>
      </div>
      <form v-if="findVisible" class="terminal-find" @submit.prevent="findText(1)"><el-input ref="findInput" v-model="query" :aria-label="T('TerminalFindText')" autocomplete="off" @input="findIndex = -1"/><span>{{ findCount ? `${findIndex + 1} / ${findCount}` : '0 / 0' }}</span><el-button :icon="ArrowUp" :aria-label="T('TerminalFindPrevious')" @click="findText(-1)"/><el-button :icon="ArrowDown" :aria-label="T('TerminalFindNext')" @click="findText(1)"/><el-button :icon="Close" :aria-label="T('TerminalFindClose')" @click="closeFind"/></form>
      <div v-show="active" class="terminal-workspace" @contextmenu="workspaceMenu">
        <div v-show="filesVisible" class="terminal-files" :style="{ width: `${filesWidth}px` }"><DeviceFiles ref="files" :peer="peer" @close="filesVisible = false" @terminal-path="preparePath" @busy-change="fileBusy = $event; recordActivity()" @dirty-change="editorDirty = $event"/></div>
        <div v-if="filesVisible" class="terminal-files-divider" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="T('FilesResize')" :aria-valuemin="260" :aria-valuemax="600" :aria-valuenow="filesWidth" @pointerdown="startResize" @keydown.left.prevent="resizeFiles(filesWidth - 20)" @keydown.right.prevent="resizeFiles(filesWidth + 20)"/>
        <div ref="screen" class="terminal-screen" :class="{ 'is-dragging': dragging }" :aria-label="T('WebTerminalTitle', { param: peer.id })" @contextmenu.prevent.stop="terminalMenu" @dragover="dragOver" @dragleave="dragging = false" @drop="dropFiles"/>
      </div>
      <WorkspaceMenu class="terminal-context-menu" :position="menu" :items="contextItems" :label="T('TerminalActions')" @close="menu = null" @action="contextAction"/>
      <el-dialog class="terminal-owned-dialog" v-model="settingsVisible" :title="T('TerminalSettings')" width="min(420px, calc(100vw - 24px))" append-to-body :close-on-click-modal="false" @keydown.capture="recordActivity" @pointerdown.capture="recordActivity">
        <el-form label-position="top"><el-form-item :label="T('TerminalIdleClose')"><el-select v-model="idleDraft" popper-class="terminal-owned-select" :disabled="preferencesSaving" :aria-label="T('TerminalIdleClose')"><el-option v-for="minutes in [0,1,5,10,15,30,60]" :key="minutes" :value="minutes" :label="minutes ? T('TerminalIdleMinutes',{count:minutes}) : T('TerminalIdleUnlimited')"/></el-select></el-form-item></el-form>
        <p class="terminal-settings-note">{{ T('TerminalIdleHint') }}</p>
        <template #footer><el-button @click="settingsVisible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="preferencesSaving" @click="savePreferences">{{ T('Save') }}</el-button></template>
      </el-dialog>
      <el-dialog class="terminal-owned-dialog" v-model="pasteVisible" :title="T('TerminalPaste')" width="min(520px, calc(100vw - 24px))" append-to-body :close-on-click-modal="false"><el-input v-model="pasteText" type="textarea" :rows="6" :aria-label="T('TerminalPasteText')" autocomplete="off"/><template #footer><el-button @click="pasteVisible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :disabled="state !== 'ready' || !pasteText" @click="applyPaste">{{ T('TerminalPaste') }}</el-button></template></el-dialog>
      <template #footer>
        <div class="terminal-footer" @contextmenu.prevent="workspaceMenu"><div ref="notificationHost" class="terminal-notification-host"/><div class="terminal-footer-actions"><el-button v-if="socket" @click="requestDisconnect">{{ T('WebTerminalDisconnect') }}</el-button><el-button @click="requestClose">{{ T('Close') }}</el-button></div></div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import '@xterm/xterm/css/xterm.css'
import { T } from '@/utils/i18n'
import { prepareTerminal, terminalStatus, terminalPreferences, saveTerminalPreferences } from '@/api/terminal'
import { FolderOpened, Search, MoreFilled, ArrowUp, ArrowDown, Close, Setting } from '@element-plus/icons-vue'
import ResourceMeters from './ResourceMeters.vue'
import WindowSizeIcon from './WindowSizeIcon.vue'
import DeviceFiles from './DeviceFiles.vue'
import WorkspaceMenu from './WorkspaceMenu.vue'
import { notifyTerminal as ElMessage, attachNotificationHost, releaseNotificationHost, showNotifications } from '@/utils/notifications'
import { findTerminalMatches, quoteShellPath } from '@/utils/terminalTools'

const props = defineProps({ peer: { type: Object, required: true }, showEntry:{type:Boolean,default:true} })
const state = ref('unknown')
const blocked = computed(() => ['disabled', 'unsupported'].includes(state.value))
const visible = ref(false)
const password = ref('')
const useSaved = ref(false)
const hasSaved = ref(false)
const busy = ref(false)
const active = ref(false)
const failureStage = ref('')
const screen = ref(null)
const socket = ref(null)
const expanded = ref(false), filesAllowed = ref(false), files = ref(null), dragging = ref(false)
const filesVisible = ref(false), filesWidth = ref(320)
const notificationHost = ref(null), menu = ref(null), fontSize = ref(14)
const findVisible = ref(false), findInput = ref(null), query = ref(''), findIndex = ref(-1), findCount = ref(0)
const pasteVisible = ref(false), pasteText = ref(''), selected = ref(false)
const settingsVisible=ref(false), idleMinutes=ref(0), idleDraft=ref(0), preferencesSaving=ref(false), resourceStatus=ref({})
const fileBusy=ref(false)
const editorDirty=ref(false)
const hostname=computed(()=>resourceStatus.value.device?.hostname || props.peer.hostname || T('TerminalHostnameUnknown'))
let idleTimer, resourceTimer, lastActivity=Date.now(), statusPending=false, preferenceGeneration=0
const recordActivity=()=>{lastActivity=Date.now()}
const documentActivity=event=>{if(visible.value&&event.target.closest?.('.terminal-dialog,.terminal-owned-dialog'))recordActivity()}
const refreshResources=async()=>{if(!visible.value||statusPending)return;statusPending=true;const current=attempt;try{const result=await terminalStatus(props.peer.row_id);if(visible.value&&current===attempt)resourceStatus.value=result.data}catch{if(visible.value&&current===attempt)resourceStatus.value={}}finally{statusPending=false}}
const loadPreferences=async()=>{const current=++preferenceGeneration;try{const result=await terminalPreferences();if(visible.value&&current===preferenceGeneration){idleMinutes.value=idleDraft.value=[0,1,5,10,15,30,60].includes(result.data.idle_minutes)?result.data.idle_minutes:0}}catch{if(visible.value&&current===preferenceGeneration)ElMessage.warning(T('TerminalSettingsUnavailable'))}}
const savePreferences=async()=>{preferencesSaving.value=true;try{await saveTerminalPreferences({idle_minutes:idleDraft.value});idleMinutes.value=idleDraft.value;recordActivity();settingsVisible.value=false;ElMessage.success(T('TerminalSettingsSaved'))}catch{ElMessage.error(T('TerminalSettingsSaveFailed'))}finally{preferencesSaving.value=false}}
watch(settingsVisible,value=>{if(value)idleDraft.value=idleMinutes.value})
const checkIdle=()=>{if(visible.value&&state.value==='ready'&&!fileBusy.value&&!editorDirty.value&&!preferencesSaving.value&&idleMinutes.value>0&&Date.now()-lastActivity>=idleMinutes.value*60000){visible.value=false;ElMessage.info(T('TerminalIdleClosed'))}}
let connectionAvailability = {}
let terminal, fit, observer, expiry, attempt = 0, alive = true
const states = new Set(['unknown', 'checking', 'allowed', 'ready', 'disabled', 'unsupported', 'auth_required', 'unavailable', 'configuration', 'pty_failed', 'busy', 'key_mismatch', 'offline', 'peer_not_found', 'server_rejected', 'signature_failed', 'id_server_unreachable', 'relay_unreachable', 'connection_timeout', 'connection_closed', 'protocol_error', 'browser_transport', 'request_failed', 'access_denied', 'browser_terminal_error', 'saved_password_unavailable'])
const requestFailures = new Set(['busy', 'saved_password_unavailable', 'request_failed'])
const stages = new Set(['configuration', 'id_server', 'server_verification', 'rendezvous', 'relay', 'device_verification', 'authentication', 'shell', 'session', 'browser', 'request'])
const setState = (value, stage = '') => { const previous = state.value; state.value = states.has(value) ? value : 'unavailable'; failureStage.value = stages.has(stage) ? stage : ''; if (previous !== state.value && !['unknown','checking','allowed','ready'].includes(state.value)) ElMessage.error(T(`TerminalState_${state.value}`)) }
const send = message => { if (socket.value?.readyState === WebSocket.OPEN) socket.value.send(JSON.stringify(message)) }
const clearTerminal = () => { observer?.disconnect(); observer = null; terminal?.dispose(); terminal = null; fit = null; active.value = false }
const disconnect = () => {
  files.value?.close(); filesVisible.value = false; stopResize()
  menu.value = null; findVisible.value = pasteVisible.value = false; pasteText.value = ''
  attempt++
  const current = socket.value
  socket.value = null
  if (current) { current.onopen = current.onmessage = current.onerror = current.onclose = null; if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({ type: 'close' })); current.close() }
  busy.value = false
  clearTerminal()
  if (['ready', 'allowed', 'checking'].includes(state.value)) setState('unknown')
}
const requestClose=async done=>{if(editorDirty.value && !(await files.value?.confirmClose()))return;if(typeof done==='function')done();else visible.value=false}
const requestDisconnect=async()=>{if(editorDirty.value && !(await files.value?.confirmClose()))return;disconnect()}
const dispose = () => { clearInterval(idleTimer);clearInterval(resourceTimer);idleTimer=resourceTimer=null;preferenceGeneration++;settingsVisible.value=false;releaseNotificationHost(notificationHost.value); disconnect(); password.value = ''; expanded.value = dragging.value = false }
const attachNotifications = () => attachNotificationHost(notificationHost.value)
const openFiles = async (list = []) => { filesVisible.value = true; await nextTick(); await files.value?.open(connectionAvailability, list) }
const toggleFiles = () => { if (filesVisible.value) files.value?.close(); else openFiles() }
const resizeFiles = value => { filesWidth.value = Math.max(260, Math.min(600, value, (screen.value?.parentElement.clientWidth || 960) - 200)) }
let resizing = null
const moveResize = event => { if (resizing) resizeFiles(resizing.width + event.clientX - resizing.x) }
const stopResize = () => { resizing = null; window.removeEventListener('pointermove', moveResize); window.removeEventListener('pointerup', stopResize); window.removeEventListener('pointercancel', stopResize) }
const startResize = event => { if (event.button !== 0) return; event.preventDefault(); resizing = { x: event.clientX, width: filesWidth.value }; window.addEventListener('pointermove', moveResize); window.addEventListener('pointerup', stopResize); window.addEventListener('pointercancel', stopResize) }
const dragOver = event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragging.value = filesAllowed.value } }
const dropFiles = event => {
  if (!event.dataTransfer?.files.length) return
  event.preventDefault(); event.stopPropagation(); dragging.value = false
  if (!filesAllowed.value || state.value !== 'ready') return
  if (Array.from(event.dataTransfer.items || []).some(item => item.webkitGetAsEntry?.()?.isDirectory)) { ElMessage.warning(T('FilesDirectoriesUnsupported')); return }
  openFiles(Array.from(event.dataTransfer.files))
}
const menuAt = (event, zone) => { event.preventDefault(); selected.value = !!terminal?.hasSelection(); menu.value = { x: event.clientX, y: event.clientY, zone, trigger: screen.value?.querySelector('textarea') || event.currentTarget.closest('button') } }
const terminalMenu = event => menuAt(event, 'terminal')
const workspaceMenu = event => { if (!event.target.closest('input,textarea,.workspace-context-menu')) menuAt(event, 'workspace') }
const toolbarMenu = event => { const box = event.currentTarget.getBoundingClientRect(); menuAt({ ...event, preventDefault() {}, currentTarget: event.currentTarget, clientX: box.left, clientY: box.bottom }, 'terminal') }
const contextItems = computed(() => {
  const items = [], add = (id, key, disabled = false, shortcut = '') => items.push({ id, label: T(key), disabled, shortcut })
  if (menu.value?.zone === 'terminal') {
    add('copy', 'Copy', !selected.value, 'Ctrl+Shift+C')
    add('paste', 'TerminalPaste', state.value !== 'ready', 'Ctrl+Shift+V')
    add('select-all', 'TerminalSelectAll', !active.value)
    add('find', 'TerminalFind', !active.value, 'Ctrl+Shift+F')
    items.push({ id: 'view-divider', separator: true })
    add('font-increase', 'TerminalFontIncrease', !active.value || fontSize.value >= 24)
    add('font-decrease', 'TerminalFontDecrease', !active.value || fontSize.value <= 10)
    add('font-reset', 'TerminalFontReset', !active.value)
    add('clear', 'TerminalClear', !active.value)
    add('save-output', 'TerminalSaveOutput', !active.value)
    items.push({ id: 'session-divider', separator: true })
  }
  if (filesAllowed.value) add('files', filesVisible.value ? 'FilesHide' : 'DeviceFiles', state.value !== 'ready')
  add('expand', expanded.value ? 'TerminalRestore' : 'TerminalExpand')
  add('notifications', 'NotificationCenter')
  add('settings','TerminalSettings')
  add('reconnect', 'TerminalReconnect', !!socket.value || busy.value)
  add('disconnect', 'WebTerminalDisconnect', !socket.value)
  return items
})
const copySelection = async () => { const text = terminal?.getSelection(); if (!text) return; try { await navigator.clipboard.writeText(text); ElMessage.success(T('CopySuccess')) } catch { ElMessage.error(T('CopyFailed')) } }
const pasteIntoTerminal = text => {
  if (!terminal || state.value !== 'ready') return false
  if (new TextEncoder().encode(text).length > 16384) { ElMessage.warning(T('TerminalPasteLimit')); return false }
  terminal.paste(text); terminal.focus(); return true
}
const pasteClipboard = async () => {
  if (state.value !== 'ready') return
  try { const text = await navigator.clipboard.readText(); if (!text) return; if (/[\r\n]/.test(text)) { pasteText.value = text; pasteVisible.value = true } else pasteIntoTerminal(text) }
  catch { pasteText.value = ''; pasteVisible.value = true; ElMessage.info(T('TerminalClipboardManual')) }
}
const applyPaste = () => { if (pasteIntoTerminal(pasteText.value)) { pasteVisible.value = false; pasteText.value = ''; nextTick(() => terminal?.focus()) } }
const preparePath = path => { if (pasteIntoTerminal(`cd -- ${quoteShellPath(path)}`)) ElMessage.info(T('TerminalPathPrepared')) }
const openFind = async () => { if (!terminal) return; findVisible.value = true; await nextTick(); findInput.value?.focus() }
const closeFind = () => { findVisible.value = false; terminal?.focus() }
const findText = direction => {
  const matches = findTerminalMatches(terminal?.buffer.active, query.value)
  findCount.value = matches.length
  if (!matches.length) { findIndex.value = -1; terminal?.clearSelection(); if (query.value) ElMessage.info(T('TerminalFindEmpty')); return }
  findIndex.value = findIndex.value < 0 ? (direction > 0 ? 0 : matches.length - 1) : (findIndex.value + direction + matches.length) % matches.length
  const match = matches[findIndex.value]
  terminal.select(match.column, match.row, match.length); terminal.scrollToLine(Math.max(0, match.row - 2))
}
const setFontSize = size => { fontSize.value = Math.max(10, Math.min(24, size)); if (terminal) { terminal.options.fontSize = fontSize.value; fit.fit(); send({ type: 'resize', rows: terminal.rows, cols: terminal.cols }) } }
const saveOutput = () => {
  if (!terminal) return
  const lines = [], buffer = terminal.buffer.active
  for (let row = 0; row < buffer.length; row++) { const line = buffer.getLine(row); if (!line) continue; const value = line.translateToString(true); if (line.isWrapped && lines.length) lines[lines.length - 1] += value; else lines.push(value) }
  const blob = new Blob([lines.join('\n').trimEnd()], { type: 'text/plain;charset=utf-8' }), url = URL.createObjectURL(blob), anchor = document.createElement('a')
  anchor.href = url; anchor.download = `terminal-${String(props.peer.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  ElMessage.success(T('TerminalOutputSaved'))
}
const contextAction = id => {
  if (id === 'copy') return copySelection()
  if (id === 'paste') return pasteClipboard()
  if (id === 'select-all') return terminal?.selectAll()
  if (id === 'find') return openFind()
  if (id === 'font-increase') return setFontSize(fontSize.value + 1)
  if (id === 'font-decrease') return setFontSize(fontSize.value - 1)
  if (id === 'font-reset') return setFontSize(14)
  if (id === 'clear') { terminal?.clear(); terminal?.focus(); return }
  if (id === 'save-output') return saveOutput()
  if (id === 'files') return toggleFiles()
  if (id === 'expand') { expanded.value = !expanded.value; return }
  if (id === 'notifications') return showNotifications()
  if (id === 'settings') { settingsVisible.value=true;return }
  if (id === 'reconnect') return connect()
  if (id === 'disconnect') return requestDisconnect()
}
watch(visible, value => { if (!value) dispose();else{idleMinutes.value=0;recordActivity();loadPreferences();idleTimer=setInterval(checkIdle,1000);resourceTimer=setInterval(refreshResources,15000)} })
const setupTerminal = async current => {
  active.value = true
  await nextTick()
  if (socket.value !== current || !screen.value) return
  const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
  if (socket.value !== current || !screen.value) return
  terminal = new Terminal({ cursorBlink: true, disableStdin: true, screenReaderMode: true, scrollback: 2000, fontSize: fontSize.value, fontFamily: 'Consolas, "SFMono-Regular", Menlo, monospace', theme: { background: '#17202e', foreground: '#e4ebf5', cursor: '#c2d7eb', selectionBackground: '#496a8d88' } })
  fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(screen.value)
  terminal.parser.registerOscHandler(52, () => true)
  terminal.attachCustomKeyEventHandler(event => {
    if (event.type !== 'keydown') return true
    if (event.shiftKey && event.key === 'F10') { const box = screen.value.getBoundingClientRect(); terminalMenu({ preventDefault() {}, currentTarget: screen.value, clientX: box.left + 24, clientY: box.top + 24 }); return false }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey) { const action = { c: copySelection, v: pasteClipboard, f: openFind }[event.key.toLowerCase()]; if (action) { event.preventDefault(); action(); return false } }
    return true
  })
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
      let msg; try { msg = JSON.parse(event.data); if (!msg || typeof msg !== 'object' || Array.isArray(msg)) throw new Error('invalid message') } catch { disconnect(); setState('protocol_error', 'browser'); return }
      if (msg.type === 'ping') { send({ type: 'pong' }); return }
      if (msg.type === 'status') {
        setState(msg.state)
        if (msg.state === 'allowed') {
          if (msg.credential_saved) { hasSaved.value = useSaved.value = true; connectionAvailability.has_saved_password = true }
          else ElMessage.warning(T('WebTerminalPasswordSaveFailed'))
          setupTerminal(current).catch(() => { disconnect(); setState('browser_terminal_error', 'browser') })
        }
      } else if (msg.type === 'opened') {
        busy.value = false; setState('ready');recordActivity();refreshResources(); if (terminal) { terminal.options.disableStdin = false; terminal.focus() }
      } else if (msg.type === 'output' && terminal && typeof msg.data === 'string') {
        try { terminal.write(Uint8Array.from(atob(msg.data), c => c.charCodeAt(0))) } catch { disconnect(); setState('protocol_error', 'session') }
      } else if (msg.type === 'error') {
        if (msg.state === 'auth_required' || msg.state === 'saved_password_unavailable') useSaved.value = false
        disconnect(); setState(msg.state, msg.stage)
      } else if (msg.type === 'closed') disconnect()
    }
    current.onerror = () => { disconnect(); setState('browser_transport', 'browser') }
    current.onclose = () => { disconnect(); setState('connection_closed', 'browser') }
  } catch (error) {
    if (generation === attempt) {
      busy.value = false
      const denied = error?.code === 403 || [401, 403].includes(error?.response?.status)
      const reason = error?.code === 101 && requestFailures.has(error?.data?.state) ? error.data.state : 'request_failed'
      setState(denied ? 'access_denied' : error?.code === 'ECONNABORTED' ? 'connection_timeout' : reason, 'request')
    }
  }
}
onMounted(async () => {
  for(const event of ['keydown','pointerdown','wheel','drop'])document.addEventListener(event,documentActivity,{capture:true,passive:true})
  expiry = setInterval(() => { if (!socket.value && !visible.value) setState('unknown') }, 60000)
  if(!props.showEntry)return
  try { const res = await terminalStatus(props.peer.row_id); if (alive && !socket.value && !visible.value) { setState(res.data.state); hasSaved.value = !!res.data.has_saved_password; useSaved.value = hasSaved.value } } catch { /* 조회 실패 시 활성 여부를 추측하지 않는다. */ }
})
onDeactivated(dispose)
defineExpose({open:async availability=>{connectionAvailability=availability;resourceStatus.value=availability;filesAllowed.value=!!availability.files_enabled;hasSaved.value=!!availability.has_saved_password;useSaved.value=hasSaved.value;visible.value=true;await nextTick();if(hasSaved.value)await connect()}})
onBeforeUnmount(() => { alive = false;for(const event of ['keydown','pointerdown','wheel','drop'])document.removeEventListener(event,documentActivity,true);clearInterval(expiry); dispose() })
</script>

<style scoped>
.web-terminal-entry { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 12px; }
.terminal-status { color: var(--el-text-color-secondary); }
.terminal-ready, .terminal-allowed { color: var(--el-color-success); }
.terminal-disabled, .terminal-pty_failed { color: var(--el-color-danger); }
.terminal-explanation { margin: 0 0 16px; color: var(--el-text-color-regular); line-height: 1.6; }
.terminal-heading{display:flex;align-items:center;justify-content:flex-start;gap:16px;min-width:0;font-size:13px;color:#e4ebf5}.terminal-heading>span{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.terminal-toolbar{display:flex;align-items:center;gap:4px;flex:none}.terminal-toolbar .el-button{width:30px;height:30px;padding:6px;border-color:#59677a;background:transparent;color:#e4ebf5}.terminal-toolbar .el-button:hover{background:#37465a;border-color:#91a4bc}.terminal-heading .el-button+.el-button{margin-left:0}
.terminal-session-status { display: flex; flex-direction: column; gap: 4px; margin: 0; padding:7px 12px; border-bottom:1px solid var(--el-border-color);line-height:1.5;font-size:11px;flex:none;background:var(--el-bg-color); }
.terminal-session-status span { color: var(--el-text-color-secondary); }
.terminal-session-status strong{font-weight:500}.terminal-session-status strong:before{content:'';display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:var(--el-color-primary)}
.terminal-workspace { display:flex; position:relative;flex:1 1 0;height:auto;min-height:0;min-width:0;overflow:hidden;background:#17202e; }
.terminal-screen { flex:1; min-width:0; min-height:0; background: #17202e; padding: 12px; border-radius: 0; overflow: hidden; box-sizing:border-box; }
.terminal-files { flex:none; min-height:0; max-width:calc(100% - 200px); overflow:hidden; }
.terminal-files-divider { flex:none; width:6px; cursor:col-resize; touch-action:none; position:relative;background:var(--el-bg-color); }
.terminal-files-divider:after { content:''; position:absolute; left:2px; top:0; bottom:0; width:1px; background:var(--el-border-color); }
.terminal-files-divider:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:-2px; }
.terminal-screen.is-dragging{outline:3px solid var(--el-color-primary);outline-offset:-3px}
.terminal-find{display:flex;align-items:center;gap:5px;flex:none;padding:7px 12px;background:var(--el-bg-color);border-bottom:1px solid var(--el-border-color)}.terminal-find .el-input{max-width:320px;min-width:0}.terminal-find>span{font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums}.terminal-find .el-button{width:28px;height:28px;padding:5px;margin-left:0}.terminal-footer{display:flex;align-items:center;gap:12px;text-align:left;min-width:0}.terminal-notification-host{flex:1;min-width:0;min-height:36px}.terminal-footer-actions{display:flex;gap:6px;flex:none}.terminal-footer-actions .el-button{margin-left:0;height:32px;padding:6px 10px}
.terminal-heading{width:100%}.terminal-session-status{flex-direction:row;align-items:center;flex-wrap:wrap}
.terminal-session-status.is-connected{flex-wrap:nowrap}.terminal-session-status :deep(.resource-meters){margin-left:auto}.terminal-session-status.is-connected>strong{flex:none;white-space:nowrap}
:global(.el-dialog.terminal-dialog){height:min(740px,86dvh);max-height:calc(100dvh - 24px);padding:0;border-radius:8px;overflow:hidden}
:global(.terminal-dialog .el-dialog__header){padding:9px 48px 9px 14px;background:#263244;border-bottom:1px solid #3d4b60}
:global(.terminal-dialog .el-dialog__headerbtn .el-dialog__close){color:#e4ebf5}
:global(.terminal-dialog .el-dialog__body){display:flex;flex-direction:column;min-height:0;padding:0;overflow:hidden;background:var(--el-fill-color-light)}
:global(.terminal-dialog .el-dialog__body>.el-form){padding:12px 16px;flex:none}
:global(.terminal-dialog .el-dialog__footer){padding:8px 12px;background:var(--el-bg-color)}
/* 확대 창의 헤더·상태·버튼을 제외한 실제 공간에 터미널을 맞춘다. */
:global(.terminal-expanded-overlay .el-overlay-dialog) { padding: 0; }
:global(.el-dialog.terminal-dialog.terminal-expanded) { width: 100% !important; max-width: none; height: 100dvh; max-height: 100dvh; padding: 0; border: 0; border-radius: 0; }
:global(.el-dialog.terminal-expanded .el-dialog__body) { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.terminal-expanded .terminal-session-status { flex: 0 0 auto; }
.terminal-expanded .terminal-workspace { flex: 1 1 0; height: auto; min-height: 0; }
.terminal-screen :deep(.xterm) { height: 100%; }
@media (max-width: 600px) { .terminal-screen { padding: 6px; } .terminal-heading{gap:8px;flex-wrap:wrap}.terminal-toolbar .el-button{width:28px;height:28px}.terminal-files{position:absolute;inset:0 auto 0 0;z-index:2;max-width:100%;width:100%!important;background:var(--el-bg-color);}.terminal-files-divider{display:none;}.terminal-footer{gap:6px;flex-wrap:wrap}.terminal-notification-host{flex-basis:100%}.terminal-footer-actions{margin-left:auto}.terminal-find{padding:6px;gap:4px} }
/* 작업 공간만 어두운 팔레트를 적용하고 기존 대시보드 테마는 유지한다. */
:global(.el-dialog.terminal-dialog){--el-bg-color:#171f2b;--el-bg-color-overlay:#202a39;--el-fill-color-light:#263346;--el-fill-color-blank:#171f2b;--el-border-color:#354255;--el-border-color-light:#354255;--el-border-color-lighter:#2a374a;--el-text-color-primary:#e5ecf6;--el-text-color-regular:#b8c6d9;--el-text-color-secondary:#95a6bd;--el-text-color-placeholder:#7b8ba2;--el-color-primary:#73b9f0;--el-color-primary-light-9:#25384d;background:#171f2b;border:1px solid #3a485d;box-shadow:0 16px 60px #080d1855}
:global(.terminal-dialog .el-dialog__header){background:#202a39;border-bottom-color:#354255;position:relative}
.terminal-heading{position:relative;min-height:34px}.terminal-hostname{position:absolute;left:calc(50% + 17px);transform:translateX(-50%);max-width:calc(100% - 770px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:600;color:#e7eef8;letter-spacing:.2px}.terminal-heading>span:first-child{font-size:12px;color:#bdcadb}.terminal-toolbar .el-button{background:#263244;border-color:#405069;color:#c6d7eb}.terminal-toolbar .el-button:hover{background:#344661;border-color:#739bc0}.terminal-session-status{background:#192331;color:#aebdd1;border-bottom:1px solid #354255;gap:24px;min-height:32px}.terminal-session-status strong:before{background:#69c4a7}.terminal-footer-actions .el-button{background:#263244;color:#d8e4f3}.terminal-files-divider,.terminal-find{background:#202a39}.terminal-settings-note{font-size:12px;color:var(--el-text-color-secondary);line-height:1.7}.terminal-screen{background:#111925}.terminal-find{color:#b8c6d9}
@media(max-width:1200px){.terminal-hostname{position:static;transform:none;margin-left:0;max-width:100%;flex-basis:100%;text-align:center}.terminal-heading{gap:6px;flex-wrap:wrap}}
@media(max-width:600px){.terminal-hostname{flex-basis:100%;max-width:100%;text-align:center;margin-left:0;font-size:12px;padding:1px 0}.terminal-heading{gap:6px}.terminal-session-status{gap:10px;padding:5px 8px}.terminal-session-status strong{font-size:10px}.terminal-session-status strong:before{margin-right:4px}.terminal-workspace{isolation:isolate}.terminal-files{z-index:3}}
</style>
<style>
.terminal-dialog .el-dialog__body>.terminal-connect-form{display:flex;align-items:center;gap:8px 16px;padding:6px 16px}
.terminal-connect-form>.el-checkbox{margin:0;min-width:0;flex:1;height:32px;align-items:center}.terminal-connect-form .el-checkbox__label{white-space:normal;line-height:1.4}.terminal-connect-form>.el-button{margin-left:auto;flex:none}.terminal-connect-form>.el-form-item{flex:1;min-width:180px;margin:0}.terminal-connect-form.has-password{flex-wrap:wrap}.terminal-connect-form.has-password>.el-checkbox{flex-basis:100%}
@media(max-width:600px){.terminal-dialog .el-dialog__body>.terminal-connect-form{padding:6px 12px;gap:8px}.terminal-connect-form .el-checkbox__label{font-size:12px}.terminal-connect-form>.el-button{font-size:12px;padding:6px 8px}}
.terminal-dialog .el-dialog__header .terminal-expand-button.el-button{position:absolute;right:48px;top:10px;width:30px;height:30px;padding:6px;margin:0;background:#263244;border-color:#405069;color:#c6d7eb}
/* 앱 공통 밝은 입력·표 스타일보다 작업 공간의 대비를 우선한다. */
.terminal-dialog{--console-surface:#171f2b;--console-text:#bdcbe0;--console-border:#354255}
.terminal-dialog .el-input.is-disabled .el-input__wrapper,.terminal-dialog .el-input__wrapper,.terminal-dialog .el-select__wrapper,.terminal-owned-dialog .el-input__wrapper,.terminal-owned-dialog .el-select__wrapper{background:#111925;box-shadow:0 0 0 1px #405069 inset}
.terminal-dialog .el-input__inner,.terminal-dialog .el-select__selected-item,.terminal-owned-dialog .el-input__inner,.terminal-owned-dialog .el-select__selected-item{color:#d6e1ef}
.terminal-dialog .el-input__inner::placeholder,.terminal-owned-dialog .el-input__inner::placeholder{color:#8fa2bc}
.terminal-dialog .el-table__header .cell{color:#aabbd2}
.terminal-dialog .el-table__body td .cell{color:#b8c6d9}
.terminal-dialog .el-table td.el-table__cell,.terminal-dialog .el-table th.el-table__cell{border-bottom-color:#2e3b4f}
.terminal-dialog .el-table__inner-wrapper::before{background:#354255}
.terminal-dialog .notification-history strong{color:#d8e4f3}
.terminal-owned-select.el-popper{--el-bg-color-overlay:#202a39;--el-fill-color-light:#344661;--el-text-color-regular:#d6e1ef;--el-border-color-light:#405069;--el-color-primary:#9acaed;background:#202a39;border-color:#405069}
.terminal-owned-select .el-select-dropdown__item{color:#d6e1ef}.terminal-owned-select .el-select-dropdown__item.is-hovering{background:#344661}
.terminal-owned-dialog{--el-bg-color:#171f2b;--el-bg-color-overlay:#202a39;--el-fill-color-light:#263346;--el-fill-color-blank:#171f2b;--el-border-color:#354255;--el-border-color-light:#354255;--el-border-color-lighter:#2a374a;--el-text-color-primary:#e5ecf6;--el-text-color-regular:#b8c6d9;--el-text-color-secondary:#95a6bd;--el-text-color-placeholder:#7b8ba2;--el-color-primary:#73b9f0;--el-color-primary-light-9:#25384d;background:#171f2b;border:1px solid #3a485d;border-radius:8px;color:#cbd8e9;box-shadow:0 16px 60px #080d1866}
.terminal-owned-dialog.el-dialog{padding:0;overflow:hidden}.terminal-owned-dialog .el-dialog__header{padding:12px 44px 12px 16px;background:#202a39;border-bottom:1px solid #354255}.terminal-owned-dialog .el-dialog__title{font-size:14px;color:#e5ecf6}.terminal-owned-dialog .el-dialog__body{padding:14px 16px}.terminal-owned-dialog .el-dialog__footer{padding:10px 16px;border-top:1px solid #354255}.terminal-owned-dialog .el-dialog__close,.terminal-owned-dialog .el-message-box__title{color:#cbd8e9}.terminal-dialog .el-button:not(.is-link):not(.is-text),.terminal-owned-dialog .el-button:not(.is-link):not(.is-text){height:32px;border-radius:5px;background:#263244;color:#d8e4f3;border-color:#405069}.terminal-dialog .el-button--primary:not(.is-link),.terminal-owned-dialog .el-button--primary:not(.is-link){background:#416d94;border-color:#598eb9;color:#fff}.terminal-dialog .el-button:not(.is-disabled):not(.is-link):hover,.terminal-owned-dialog .el-button:not(.is-disabled):not(.is-link):hover{background:#344b66;border-color:#73a9d0}.terminal-dialog .terminal-toolbar .el-button,.terminal-dialog .files-toolbar .el-button{height:30px;width:30px;padding:6px}.terminal-dialog .el-button.is-disabled,.terminal-owned-dialog .el-button.is-disabled{opacity:.5}.terminal-owned-dialog .el-message-box__content{color:#b8c6d9}.terminal-owned-dialog .el-textarea__inner,.terminal-owned-dialog .el-input__wrapper,.terminal-owned-dialog .el-select__wrapper{background:#111925}.terminal-owned-dialog .el-input__inner{color:#d6e1ef}
/* 비활성화 중에도 작업 공간의 어두운 배경을 유지한다. */
.terminal-dialog,.terminal-owned-dialog{--el-disabled-bg-color:#202a39;--el-fill-color:#263346;--el-fill-color-extra-light:#202a39;--el-disabled-text-color:#95a6bd}
.terminal-dialog .el-input.is-disabled .el-input__inner,.terminal-owned-dialog .el-input.is-disabled .el-input__inner{background:transparent;color:#95a6bd;-webkit-text-fill-color:#95a6bd}
</style>
