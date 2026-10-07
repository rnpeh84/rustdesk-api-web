<template>
  <section v-if="visible" class="device-files-panel" role="region" :aria-label="`${T('DeviceFiles')} · ${peer.id}`" @contextmenu.stop="blankMenu" @keydown.shift.f10.stop="blankMenu">
    <div class="files-heading"><strong>{{ T('DeviceFiles') }}</strong><span v-if="connected" :title="T('FilesAccountHint')">{{ user }}</span><el-button link :icon="Close" :aria-label="T('FilesHide')" :title="T('FilesHide')" @click="close"/></div>
    <el-form v-if="!connected" @submit.prevent="connect()">
      <el-form-item v-if="!useSaved" :label="T('WebTerminalPassword')">
        <el-input v-model="password" type="password" show-password autocomplete="off" maxlength="128" :disabled="busy" :aria-label="T('WebTerminalPassword')"/>
      </el-form-item>
      <el-checkbox v-if="hasSaved" v-model="useSaved" :disabled="busy">{{ T('WebTerminalSavedPassword') }}</el-checkbox>
      <el-button type="primary" native-type="submit" :loading="busy">{{ T('WebTerminalCheckConnect') }}</el-button>
    </el-form>
    <div v-if="connected" class="files-workspace" :class="{ 'is-dragging': dragging, 'is-busy': busy }" :aria-busy="busy" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="drop">
      <div class="files-toolbar">
        <el-button :disabled="busy || path === '/'" :icon="Back" :aria-label="T('FilesParent')" :title="T('FilesParent')" @click="navigate(parent)"/>
        <el-button :disabled="busy" :icon="House" :aria-label="T('FilesHome')" :title="T('FilesHome')" @click="navigate(home)"/>
        <el-button :disabled="busy" :icon="Refresh" :aria-label="T('Refresh')" :title="T('Refresh')" @click="navigate(path)"/>
        <el-button :disabled="busy || !writable" :icon="FolderAdd" :aria-label="T('FilesNewFolder')" :title="T('FilesNewFolder')" @click="edit('mkdir')"/>
        <el-button type="primary" :disabled="busy || !writable" :icon="Upload" :aria-label="T('FilesUpload')" :title="T('FilesUpload')" @click="picker?.click()"/>
        <input ref="picker" type="file" multiple hidden @change="selectFiles"/>
      </div>
      <form class="files-location" @submit.prevent="navigate(location)"><el-input v-model="location" :readonly="busy" :aria-label="T('FilesPath')" autocomplete="off" :spellcheck="false"/><el-button native-type="submit" :disabled="busy" :icon="Right" :aria-label="T('FilesGo')" :title="T('FilesGo')"/></form>
      <el-input v-model="filter" class="files-filter" :prefix-icon="Search" clearable :placeholder="T('FilesSearch')" :aria-label="T('FilesSearch')" maxlength="256"/>
      <span v-if="!writable" class="files-readonly">{{ T('FilesReadOnly') }}</span>
      <el-table :data="displayEntries" height="100%" :empty-text="T('FilesEmpty')" row-key="name" :row-class-name="({row}) => row.name === selectedName ? 'is-selected' : ''" :default-sort="{prop:'name',order:'ascending'}" @sort-change="sortEntries" @row-click="selectRow" @row-dblclick="openRow" @row-contextmenu="showMenu" @wheel.passive="menu = null" @touchmove.passive="menu = null">
        <el-table-column prop="name" sortable="custom" :label="T('Filename')" min-width="110">
          <template #default="{ row }"><el-button v-if="row.kind !== 'blocked'" link :disabled="busy" :class="['files-entry',{ 'is-folder':row.kind === 'directory' }]" :icon="row.kind === 'directory' ? Folder : Document" :title="row.parent ? T('FilesParent') : `${row.mode || ''} · UID ${row.uid ?? '-'} / GID ${row.gid ?? '-'}`" @keydown.enter.prevent="openRow(row, null, $event)" @keydown.shift.f10.stop.prevent="keyboardMenu(row, $event)">{{ row.name }}</el-button><span v-else class="files-name files-blocked"><el-icon><Document/></el-icon>{{ row.name }}<el-icon :aria-label="T('FilesBlocked')"><Lock/></el-icon></span></template>
        </el-table-column>
        <el-table-column prop="size" sortable="custom" :label="T('FilesSize')" width="82"><template #default="{ row }">{{ row.kind === 'file' ? sizeLabel(row.size) : '-' }}</template></el-table-column>
        <el-table-column class-name="files-row-actions" width="34"><template #default="{ row }"><el-button v-if="row.kind === 'file'" link :disabled="busy" :icon="Download" :aria-label="`${T('FilesDownload')} ${row.name}`" :title="T('FilesDownload')" @click.stop="download(row)"/></template></el-table-column>
        <el-table-column class-name="files-row-actions" width="30"><template #default="{ row }"><el-button v-if="!row.parent && row.kind !== 'blocked'" link :disabled="busy" :icon="MoreFilled" :aria-label="`${T('FilesActions')} ${row.name}`" :title="T('FilesActions')" @click.stop="keyboardMenu(row, $event)"/></template></el-table-column>
      </el-table>
      <el-button v-if="next !== null" :disabled="busy" @click="loadMore">{{ T('FilesMore') }}</el-button>
      <div v-if="progress" class="files-progress" role="status" aria-live="polite"><span>{{ progress.name }}</span><el-progress :percentage="progress.percent"/><el-button :disabled="cancelled" @click="cancelled = true">{{ T('Cancel') }}</el-button></div>
      <div class="files-summary"><span>{{ T('FilesEntryCount', { count: displayEntries.length }) }}</span><span>{{ writable ? T('FilesWritable') : T('FilesReadOnlyShort') }}</span></div>
    </div>
    <WorkspaceMenu class="files-context-menu" :position="menu" :items="menuItems" :label="T('FilesActions')" @close="menu = null" @action="menuAction"/>
    <FileTextEditor v-model="editorVisible" v-model:text="editorText" :name="editorEntry?.name" :path="editorEntry?.path" :original="editorOriginal" :read-only="editorEntry?.can_write !== true || !editorHash" :loading="editorLoading" :saving="editorSaving" :error="editorError" @save="saveEditor"/>
    <el-dialog class="terminal-owned-dialog" v-model="editing" :title="T(`FilesAction_${editOp}`)" width="min(420px, calc(100vw - 24px))" append-to-body :close-on-click-modal="false" @closed="editError = ''">
      <el-form label-position="top" @submit.prevent="applyEdit">
        <p v-if="editRow">{{ editRow.name }}<span v-if="editOp === 'chmod'"> · UID {{ editRow.uid }} / GID {{ editRow.gid }}</span></p>
        <el-form-item v-if="editOp !== 'chmod'" :label="T('Filename')"><el-input v-model="editName" :disabled="busy" maxlength="255" :aria-label="T('Filename')"/></el-form-item>
        <el-form-item v-if="['move','copy'].includes(editOp)" :label="T('FilesTargetPath')"><el-input v-model="editPath" :disabled="busy" :aria-label="T('FilesTargetPath')"/></el-form-item>
        <el-form-item v-if="editOp === 'chmod'" :label="T('FilesMode')"><el-input v-model="editMode" :disabled="busy" maxlength="3" :aria-label="T('FilesMode')"/><span class="files-mode-hint">{{ T('FilesModeHint') }}</span></el-form-item>
        <el-alert v-if="editError" :title="editError" type="error" :closable="false"/>
        <div class="files-edit-buttons"><el-button :disabled="busy" @click="editing = false">{{ T('Cancel') }}</el-button><el-button type="primary" native-type="submit" :loading="busy">{{ T('FilesApply') }}</el-button></div>
      </el-form>
    </el-dialog>
    <el-dialog class="terminal-owned-dialog" v-model="propertiesVisible" :title="T('FilesProperties')" width="min(420px, calc(100vw - 24px))" append-to-body>
      <dl v-if="properties" class="files-properties"><dt>{{ T('Filename') }}</dt><dd>{{ properties.name }}</dd><dt>{{ T('FilesPath') }}</dt><dd>{{ properties.path }}</dd><dt>{{ T('FilesKind') }}</dt><dd>{{ T(properties.kind === 'directory' ? 'FilesFolder' : 'File') }}</dd><dt>{{ T('FilesSize') }}</dt><dd>{{ sizeLabel(properties.size || 0) }}</dd><dt>{{ T('FilesMode') }}</dt><dd>{{ properties.mode || '-' }} · UID {{ properties.uid ?? '-' }} / GID {{ properties.gid ?? '-' }}</dd></dl>
      <template #footer><el-button @click="propertiesVisible = false">{{ T('Close') }}</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { terminalStatus } from '@/api/terminal'
import { Back, Refresh, Upload, Download, Folder, Lock, Close, House, FolderAdd, Right, Document, MoreFilled, Search } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import WorkspaceMenu from './WorkspaceMenu.vue'
import FileTextEditor from './FileTextEditor.vue'
import { notifyTerminal as notify } from '@/utils/notifications'
import { DeviceFilesClient, fileErrorKey } from '@/utils/deviceFiles'
import { T } from '@/utils/i18n'
const props = defineProps({ peer: { type: Object, required: true } })
const emit = defineEmits(['close', 'terminal-path', 'busy-change', 'dirty-change'])
const visible = ref(false), connected = ref(false), busy = ref(false), password = ref(''), hasSaved = ref(false), useSaved = ref(false)
const error = ref(''), notice = ref(''), user = ref(''), path = ref(''), entries = ref([]), next = ref(null), progress = ref(null), dragging = ref(false), picker = ref(null), cancelled = ref(false)
const home = ref(''), location = ref(''), writable = ref(false), menu = ref(null), editing = ref(false), editOp = ref('mkdir'), editRow = ref(null), editName = ref(''), editPath = ref(''), editMode = ref('600'), editError = ref('')
const showHidden = ref(true), copiedEntry = ref(null), propertiesVisible = ref(false), properties = ref(null)
const filter = ref(''), selectedName = ref(''), sort = ref({by:'name',order:'asc'})
const displayEntries = computed(() => (path.value !== '/' ? [{name:'..',kind:'directory',parent:true}] : []).concat(entries.value.filter(row => showHidden.value || !row.name.startsWith('.'))))
const parent = computed(() => path.value.split('/').slice(0, -1).join('/') || '/')
let client, generation = 0, limit = 64 * 1024 * 1024, queued = []
const editorVisible=ref(false),editorEntry=ref(null),editorText=ref(''),editorOriginal=ref(''),editorHash=ref(''),editorLoading=ref(false),editorSaving=ref(false),editorError=ref('')
const editorDirty=computed(()=>editorVisible.value&&editorText.value!==editorOriginal.value)
watch(editorDirty,value=>emit('dirty-change',value))
let filterTimer
const listOptions = () => ({ query:filter.value,sort_by:sort.value.by,sort_order:sort.value.order })
const selectRow = (row, column, event) => { if (!event?.target.closest('.files-row-actions')) { selectedName.value = row.name;if(row.kind==='file')openEditor(row) } }
const openRow = (row, column, event) => { if(!busy.value&&!event?.target.closest('.files-row-actions')){if(row.kind==='directory')navigate(row.parent?parent.value:joinPath(row.name));else if(row.kind==='file')openEditor(row)} }
const scheduleFilter = () => { clearTimeout(filterTimer); filterTimer=setTimeout(() => { if (connected.value && !busy.value) navigate(path.value) },250) }
watch(filter,scheduleFilter)
watch(busy,value=>{emit('busy-change',value);if(!value && requestedFilter!==filter.value && connected.value)scheduleFilter()})
let requestedFilter = ''
const sortEntries = ({prop,order}) => { sort.value={by:prop==='size'?'size':'name',order:order==='descending'?'desc':'asc'};if(connected.value&&!busy.value)navigate(path.value) }
const joinPath = name => path.value === '/' ? `/${name}` : path.value ? `${path.value}/${name}` : name
const sizeLabel = size => size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`
const showError = e => { error.value = T(fileErrorKey(e?.message)); notice.value = ''; notify.error(error.value) }
watch(notice, value => { if (value) notify.success(value) })
const dispose = () => { clearTimeout(filterTimer); generation++; client?.close(); client = null; password.value = ''; busy.value = connected.value = dragging.value = false; progress.value = menu.value = null; editing.value = propertiesVisible.value = editorVisible.value = false; copiedEntry.value = null; filter.value='';selectedName.value='';editorText.value=editorOriginal.value='';editorEntry.value=null }
const close = () => { visible.value = false; dispose(); emit('close') }
watch(visible, value => { if (!value) dispose() })
const navigate = async target => {
  if (busy.value) return
  const current = client
  busy.value = true; error.value = ''; menu.value = null
  if(target !== path.value)filter.value=''
  const options=listOptions();requestedFilter=options.query
  try { const result = await current.request('list', { path: target,...options }); if (client !== current) return; path.value = result.path ?? target; location.value = path.value; writable.value = result.writable !== false; entries.value = result.entries; next.value = result.next;selectedName.value='' }
  catch (e) { if (client === current) showError(e) }
  finally { if (client === current) busy.value = false }
}
const loadMore = async () => {
  if (busy.value || next.value === null) return
  const current = client; busy.value = true
  try { const result = await current.request('list', { path: path.value, offset: next.value,...listOptions() }); if (client === current) { entries.value.push(...result.entries); next.value = result.next } }
  catch (e) { if (client === current) showError(e) }
  finally { if (client === current) busy.value = false }
}
const connect = async (files = queued) => {
  if (busy.value) return
  const value = password.value
  dispose(); const current = new DeviceFilesClient(props.peer); client = current; const version = generation
  busy.value = true; error.value = notice.value = ''; path.value = ''; entries.value = []
  current.onClose = code => { if (client === current) { connected.value = busy.value = false; showError(new Error(code)) } }
  try {
    const ready = await current.connect(value, useSaved.value)
    if (version !== generation || !visible.value) return
    if (ready.credential_saved) hasSaved.value = useSaved.value = true
    else notify.warning(T('WebTerminalPasswordSaveFailed'))
    connected.value = true; user.value = ready.user; home.value = ready.home || ''; limit = ready.limit; busy.value = false
    await navigate(home.value)
    if (files?.length) await upload(files)
  } catch (e) { if (client === current) { if (['auth_required', 'saved_password_unavailable'].includes(e?.message)) useSaved.value = false; busy.value = false; showError(e) } }
}
const cancelledTransfer = async current => { if (cancelled.value) { await current.request('cancel'); throw new Error('cancelled') } }
const digest = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('')
const editorFailure=e=>e?.message==='conflict'?T('FilesEditorConflict'):e?.message==='text'?T('FilesEditorUnsupported'):e?.message==='editor_size'?T('FilesEditorLimit'):T(fileErrorKey(e?.message))
const openEditor=async row=>{
  if(busy.value||editorVisible.value||row.can_read===false)return
  const current=client;busy.value=editorLoading.value=true;editorEntry.value={...row,path:joinPath(row.name),parent:path.value};editorText.value=editorOriginal.value=editorHash.value=editorError.value='';editorVisible.value=true
  try{
    const start=await current.request('download_start',{path:path.value,name:row.name});if(start.size>1048576)throw new Error('editor_size')
    const chunks=[];let count=0
    for(;;){const part=await current.request('download_next');if(client!==current)return;if(part.done){const blob=new Blob(chunks),data=new Uint8Array(await blob.arrayBuffer());if(count!==start.size||await digest(data)!==part.sha256)throw new Error('integrity');let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(data)}catch{throw new Error('text')}if(text.includes('\0'))throw new Error('text');editorText.value=editorOriginal.value=text;editorHash.value=part.sha256;break}const chunk=Uint8Array.from(atob(part.data),char=>char.charCodeAt(0));count+=chunk.length;if(count>start.size||part.count!==count||chunk.length>6144)throw new Error('integrity');chunks.push(chunk)}
  }catch(e){if(client===current){editorError.value=editorFailure(e);try{await current.request('cancel')}catch{}}}finally{if(client===current)busy.value=editorLoading.value=false}
}
const saveEditor=async()=>{
  if(busy.value||editorEntry.value?.can_write!==true||!editorHash.value)return
  const current=client,data=new TextEncoder().encode(editorText.value);if(data.length>1048576){editorError.value=T('FilesEditorLimit');return}
  busy.value=editorSaving.value=true;editorError.value=''
  try{await current.request('edit_start',{path:editorEntry.value.parent,name:editorEntry.value.name,size:data.length,expected_sha256:editorHash.value});for(let offset=0;offset<data.length;offset+=6144){let binary='';for(const byte of data.subarray(offset,offset+6144))binary+=String.fromCharCode(byte);await current.request('upload_chunk',{data:btoa(binary)})}const hash=await digest(data);await current.request('edit_finish',{sha256:hash});if(client===current){editorOriginal.value=editorText.value;editorHash.value=hash;notify.success(T('FilesEditorSaved'))}}
  catch(e){if(client===current){editorError.value=editorFailure(e);try{await current.request('cancel')}catch{}}}finally{if(client===current){busy.value=editorSaving.value=false;await navigate(path.value)}}
}
const upload = async files => {
  if (busy.value || !connected.value) return
  const current = client; busy.value = true; cancelled.value = false; error.value = notice.value = ''
  let completed = 0
  try {
    for (const file of files) {
      if (file.size > limit) throw new Error('size')
      await cancelledTransfer(current)
      progress.value = { name: file.name, percent: 0 }
      await current.request('upload_start', { path: path.value, name: file.name, size: file.size })
      const data = new Uint8Array(await file.arrayBuffer())
      for (let offset = 0; offset < data.length; offset += 6144) {
        await cancelledTransfer(current)
        const chunk = data.subarray(offset, offset + 6144)
        let binary = ''; for (const byte of chunk) binary += String.fromCharCode(byte)
        await current.request('upload_chunk', { data: btoa(binary) })
        progress.value = { name: file.name, percent: Math.floor(Math.min(offset + chunk.length, data.length) / data.length * 100) }
      }
      await cancelledTransfer(current)
      await current.request('upload_finish', { sha256: await digest(data) }); completed++
    }
    notice.value = T('FilesUploaded', { param: completed })
  } catch (e) { if (client === current) { if (e.message === 'cancelled') notice.value = T('FilesCancelled'); else showError(e); try { await current.request('cancel') } catch {} } }
  finally { if (client === current) { const failure = error.value; progress.value = null; busy.value = false; await navigate(path.value); if (failure) error.value = failure } }
}
const download = async row => {
  if (busy.value) return
  const current = client; busy.value = true; cancelled.value = false; error.value = notice.value = ''
  try {
    const start = await current.request('download_start', { path: path.value, name: row.name })
    if (start.size > limit) throw new Error('size')
    const chunks = []; let count = 0
    progress.value = { name: row.name, percent: 0 }
    while (true) {
      await cancelledTransfer(current)
      const part = await current.request('download_next')
      if (part.done) {
        const blob = new Blob(chunks)
        if (count !== start.size || await digest(await blob.arrayBuffer()) !== part.sha256) throw new Error('integrity')
        const url = URL.createObjectURL(blob), link = document.createElement('a')
        link.href = url; link.download = row.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
        notice.value = T('FilesDownloaded'); break
      }
      const chunk = Uint8Array.from(atob(part.data), c => c.charCodeAt(0)); count += chunk.length
      if (count > start.size || chunk.length > 6144 || part.count !== count) throw new Error('integrity')
      chunks.push(chunk); progress.value = { name: row.name, percent: start.size ? Math.floor(count / start.size * 100) : 100 }
    }
  } catch (e) { if (client === current) { if (e.message === 'cancelled') notice.value = T('FilesCancelled'); else showError(e); try { await current.request('cancel') } catch {} } }
  finally { if (client === current) { busy.value = false; progress.value = null } }
}
const selectFiles = event => { const files = Array.from(event.target.files || []); event.target.value = ''; upload(files) }
const drop = event => {
  dragging.value = false
  if (busy.value) return
  if (Array.from(event.dataTransfer.items || []).some(item => item.webkitGetAsEntry?.()?.isDirectory)) { notify.warning(T('FilesDirectoriesUnsupported')); return }
  upload(Array.from(event.dataTransfer.files || []))
}

const showMenu = (row, column, event) => {
  event.preventDefault()
  event.stopPropagation?.()
  if (!connected.value) return
  menu.value = { row, x: event.clientX, y: event.clientY, trigger: event.target.closest('button') }
}
const keyboardMenu = (row, event) => { const box = event.currentTarget.getBoundingClientRect(); showMenu(row, null, { preventDefault() {}, target: event.currentTarget, clientX: box.left, clientY: box.bottom }) }
const blankMenu = event => {
  if (event.target.closest('input,textarea,.workspace-context-menu') || !connected.value) return
  event.preventDefault()
  const bounds = event.currentTarget.getBoundingClientRect()
  menu.value = { row: null, x: event.clientX || bounds.left + 12, y: event.clientY || bounds.top + 80, trigger: event.target.closest('button') }
}
const menuItems = computed(() => {
  const row = menu.value?.row, items = [], add = (id, key, disabled = false, danger = false) => items.push({ id, label: T(key), disabled: busy.value || disabled, danger })
  if (row) {
    if(row.parent){add('open','FilesParent');return items}
    if (row.kind === 'directory') add('open', 'FilesOpen')
    if (row.kind === 'file') add('download', 'FilesDownload')
    if (row.kind === 'file') add('editor','FilesEditor',row.can_read===false)
    if (row.kind !== 'blocked') {
      add('rename', 'FilesAction_rename', !writable.value)
      add('copy', 'FilesAction_copy', row.kind !== 'file')
      add('move', 'FilesAction_move', !writable.value)
      add('chmod', 'FilesAction_chmod', !row.can_chmod)
      add('remove', 'FilesAction_remove', !writable.value, true)
      items.push({ id: 'edit-divider', separator: true })
      add('copy-entry', 'Copy', row.kind !== 'file')
      add('cut-entry', 'FilesCut', !writable.value)
    }
    add('copy-name', 'FilesCopyName')
    add('copy-path', 'FilesCopyPath')
    if (row.kind === 'directory') add('terminal-path', 'FilesTerminalPath')
    add('properties', 'FilesProperties')
  } else {
    add('refresh', 'Refresh')
    add('upload', 'FilesUpload', !writable.value)
    add('mkdir', 'FilesNewFolder', !writable.value)
    add('createfile', 'FilesNewFile', !writable.value)
    add('paste-entry', 'FilesPaste', !writable.value || !copiedEntry.value)
    items.push({ id: 'navigate-divider', separator: true })
    add('home', 'FilesHome'); add('parent', 'FilesParent', path.value === '/')
    add('location', 'FilesGo'); add('copy-path', 'FilesCopyPath')
    add('terminal-path', 'FilesTerminalPath')
    add('hidden', showHidden.value ? 'FilesHideHidden' : 'FilesShowHidden')
  }
  return items
})
const copyText = async text => { try { await navigator.clipboard.writeText(text); notify.success(T('CopySuccess')) } catch { notify.error(T('CopyFailed')) } }
const edit = (op, row = null) => {
  editOp.value = op; editRow.value = row; editName.value = row?.name || ''; editPath.value = path.value; editMode.value = row?.mode || '600'; editError.value = ''; editing.value = true
}
const menuAction = async (op, context) => {
  const row = context.row
  if (busy.value) return
  if (op === 'refresh') return navigate(path.value)
  if (op === 'upload') return picker.value?.click()
  if (op === 'home') return navigate(home.value)
  if (op === 'parent') return navigate(parent.value)
  if (op === 'open') return navigate(row.parent ? parent.value : joinPath(row.name))
  if (op === 'location') return document.querySelector('.files-location input')?.focus()
  if (op === 'hidden') { showHidden.value = !showHidden.value; return }
  if (op === 'copy-name') return copyText(row.name)
  if (op === 'copy-path') return copyText(row ? joinPath(row.name) : path.value)
  if (op === 'terminal-path') { emit('terminal-path', row ? joinPath(row.name) : path.value); return }
  if (op === 'properties') { properties.value = { ...row, path: joinPath(row.name) }; propertiesVisible.value = true; return }
  if (op === 'copy-entry' || op === 'cut-entry') { copiedEntry.value = { row: { ...row }, path: path.value, cut: op === 'cut-entry' }; notify.info(T(op === 'cut-entry' ? 'FilesCutReady' : 'FilesCopyReady')); return }
  if (op === 'paste-entry') {
    const source = copiedEntry.value, current = client
    if (!source || !writable.value) return
    busy.value = true
    try { await current.request(source.cut ? 'move' : 'copy', { path: source.path, name: source.row.name, target_path: path.value, target_name: source.row.name }); if (client === current) { if (source.cut) copiedEntry.value = null; busy.value = false; await navigate(path.value); notify.success(T('FilesPasted')) } }
    catch (e) { if (client === current) showError(e) }
    finally { if (client === current) busy.value = false }
    return
  }
  if (op === 'download') return download(row)
  if (op === 'editor') return openEditor(row)
  if (op !== 'remove') return edit(op, row)
  const current = client
  try { await ElMessageBox.confirm(T('FilesDeleteConfirm', { param: row.name }), T('FilesAction_remove'), { customClass:'terminal-owned-dialog',type: 'warning', confirmButtonText: T('FilesAction_remove'), cancelButtonText: T('Cancel') }) }
  catch { return }
  if (client !== current || busy.value) return
  busy.value = true; error.value = ''
  try { await current.request('remove', { path: path.value, name: row.name }); if (client === current) { busy.value = false; await navigate(path.value); notify.success(T('FilesCompleted', { action: T('FilesAction_remove') })) } }
  catch (e) { if (client === current) showError(e) }
  finally { if (client === current) busy.value = false }
}
const applyEdit = async () => {
  if (busy.value) return
  if (editOp.value === 'chmod' && !/^[0-7]{3}$/.test(editMode.value)) { editError.value = T('FilesModeHint'); return }
  const current = client, values = { path: path.value, name: editRow.value?.name || editName.value }
  if (editOp.value === 'chmod') values.mode = parseInt(editMode.value, 8)
  else if (editOp.value !== 'mkdir') { values.target_name = editName.value; values.target_path = editPath.value }
  busy.value = true; editError.value = ''
  try {
    if (editOp.value === 'createfile') { await current.request('upload_start', { path: path.value, name: editName.value, size: 0 }); await current.request('upload_finish', { sha256: await digest(new Uint8Array(0)) }) }
    else await current.request(editOp.value, values)
    if (client === current) { editing.value = false; busy.value = false; await navigate(path.value); notify.success(T('FilesCompleted', { action: T(`FilesAction_${editOp.value}`) })) }
  }
  catch (e) { if (client === current) editError.value = T(fileErrorKey(e.message)) }
  finally { if (client === current) busy.value = false }
}
const confirmClose=async()=>{if(!editorDirty.value)return true;try{await ElMessageBox.confirm(T('FilesEditorDiscard'),T('FilesEditor'),{customClass:'terminal-owned-dialog',type:'warning',confirmButtonText:T('FilesEditorDiscardButton'),cancelButtonText:T('Cancel')});return true}catch{return false}}
defineExpose({ close, confirmClose, open: async (availability, files = []) => { if (visible.value && connected.value) { if (files.length) await upload(files); return }; queued = files; hasSaved.value = !!availability.has_saved_password; useSaved.value = hasSaved.value; error.value = notice.value = ''; visible.value = true; const version = generation; try { const result = await terminalStatus(props.peer.row_id); if (version !== generation || !visible.value) return; hasSaved.value = !!result.data.has_saved_password; useSaved.value = hasSaved.value } catch { /* 조회 실패 시 전달받은 상태를 유지한다. */ }; await nextTick(); if (hasSaved.value && visible.value) await connect(files) } })
onDeactivated(() => { visible.value = false; dispose() })
onBeforeUnmount(dispose)
</script>

<style scoped>
.device-files-panel{height:100%;display:flex;flex-direction:column;min-height:0;overflow:hidden;padding:10px;box-sizing:border-box;background:var(--el-bg-color)}.files-heading{display:flex;align-items:center;gap:8px;flex:none;margin-bottom:8px;font-size:12px}.files-heading>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--el-text-color-secondary)}.files-heading>.el-button{margin-left:auto}.files-workspace{flex:1;min-height:0;display:flex;flex-direction:column;border:2px solid transparent;border-radius:4px}.files-workspace.is-dragging{border-color:var(--el-color-primary);background:var(--el-color-primary-light-9)}.files-toolbar{display:flex;align-items:center;justify-content:flex-start;gap:4px;flex:none}.files-toolbar .el-button{width:30px;height:30px;padding:6px}.files-toolbar .el-button+.el-button{margin-left:0}.files-location{display:flex;gap:4px;flex:none;margin:8px 0}.files-location :deep(input){font-family:monospace;font-size:12px}.files-readonly{flex:none;color:var(--el-text-color-secondary);font-size:11px;margin-bottom:6px}.files-workspace>.el-table{flex:1;min-height:0;font-size:12px}.files-error{flex:none;margin-bottom:8px}.files-error :deep(.el-alert__content){max-height:80px;overflow:auto}.files-name{overflow-wrap:anywhere}.files-name .el-icon{margin-left:6px}.files-progress{flex:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(60px,1fr) auto;align-items:center;gap:8px;margin-top:8px}.files-progress>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.files-edit-buttons{display:flex;justify-content:flex-end;margin-top:16px}.files-mode-hint{font-size:12px;color:var(--el-text-color-secondary)}.files-summary{display:flex;justify-content:space-between;gap:8px;flex:none;padding-top:7px;font-size:11px;color:var(--el-text-color-secondary)}.files-properties{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px;font-size:12px}.files-properties dt{color:var(--el-text-color-secondary)}.files-properties dd{margin:0;overflow-wrap:anywhere}
@media(max-width:600px){.files-progress{grid-template-columns:minmax(0,1fr) auto}.files-progress>span{grid-column:1/-1}}
.files-workspace :deep(.el-button.is-link){max-width:100%;height:auto;white-space:normal;overflow-wrap:anywhere}
.files-workspace :deep(.el-table__cell .cell){padding:0 6px}
</style>
<style>
.terminal-dialog .device-files-panel .files-location{--files-location-height:36px;align-items:stretch}
.terminal-dialog .device-files-panel .files-location .el-input,.terminal-dialog .device-files-panel .files-location .el-input__wrapper{height:var(--files-location-height);min-height:0;box-sizing:border-box}
.terminal-dialog .device-files-panel .files-location .el-input__inner{height:100%;line-height:normal}
.terminal-dialog .device-files-panel .files-location .el-button:not(.is-link){height:var(--files-location-height);min-height:0;width:36px;flex:none;padding:6px}
@media(max-height:500px) and (max-width:600px){.terminal-dialog .device-files-panel .files-location{--files-location-height:28px}.terminal-dialog .device-files-panel .files-location .el-button{width:24px}}
</style>
<style>
/* 짧은 목록 조회마다 패널 전체가 흐려졌다 밝아지는 현상을 방지한다. 중복 작업은 disabled와 busy 검사로 막는다. */
.terminal-dialog .device-files-panel .files-workspace.is-busy .el-button.is-disabled{opacity:1;transition:none}
.terminal-dialog .device-files-panel .files-workspace.is-busy .el-button.is-link.is-disabled{color:var(--el-text-color-regular)}
.terminal-dialog .device-files-panel .files-workspace.is-busy .el-button.is-disabled{cursor:wait}
.terminal-dialog .device-files-panel .el-table__body{border-collapse:separate;border-spacing:0 4px}
.terminal-dialog .device-files-panel .el-table__body td.el-table__cell{height:32px;padding:3px 0;border-top:1px solid var(--el-border-color);border-bottom:1px solid var(--el-border-color)}
.terminal-dialog .device-files-panel .el-table__body td.el-table__cell:first-child{border-radius:5px 0 0 5px}.terminal-dialog .device-files-panel .el-table__body td.el-table__cell:last-child{border-right:1px solid var(--el-border-color);border-radius:0 5px 5px 0}
.terminal-dialog .device-files-panel .el-table__header th.el-table__cell{height:28px;padding:2px 0}
.terminal-dialog .device-files-panel .el-table .cell{line-height:22px}.terminal-dialog .device-files-panel .el-table .el-button.is-link{padding:0;height:22px;min-height:22px;line-height:22px}
</style>
<style scoped>
/* 높이가 짧은 확대 화면에서도 경로·검색·목록·하단 상태를 한 패널에 맞춘다. */
@media(max-height:500px){.device-files-panel{padding:6px}.device-files-panel .files-heading{margin-bottom:4px}.device-files-panel .files-location{margin:4px 0}.device-files-panel .files-filter{margin-bottom:4px}.device-files-panel .files-summary{padding-top:4px}.device-files-panel .files-toolbar{margin-bottom:0}}
@media(max-height:500px) and (max-width:600px){
  .device-files-panel .files-heading{height:24px;font-size:11px}.device-files-panel .files-heading .el-button{height:24px!important;padding:3px}
  .device-files-panel .files-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-areas:'tools tools' 'path search' 'notice notice' 'table table' 'more more' 'progress progress' 'summary summary';grid-template-rows:auto auto auto minmax(0,1fr) auto auto auto;column-gap:4px}
  .device-files-panel .files-toolbar{grid-area:tools;padding-bottom:4px}.device-files-panel .files-toolbar .el-button{height:24px!important;width:24px;padding:3px}
  .device-files-panel .files-location{grid-area:path;margin:0 0 4px;min-width:0}.device-files-panel .files-location .el-button{height:28px!important;width:24px;padding:3px}
  .device-files-panel .files-filter{grid-area:search;min-width:0;height:28px;margin:0 0 4px}.device-files-panel .files-location :deep(.el-input__wrapper),.device-files-panel .files-filter :deep(.el-input__wrapper){min-height:28px;height:28px;padding:0 5px;box-sizing:border-box}
  .device-files-panel .files-readonly{grid-area:notice;margin-bottom:2px;font-size:10px}.device-files-panel .files-workspace>.el-table{grid-area:table;height:100%;min-height:0}.device-files-panel .files-workspace>.el-button{grid-area:more;height:24px}.device-files-panel .files-progress{grid-area:progress}.device-files-panel .files-summary{grid-area:summary;padding-top:2px;font-size:10px}
}
</style>
<style scoped>
.files-workspace :deep(.el-table){user-select:none;-webkit-user-select:none}
</style>
<style scoped>
.device-files-panel{background:var(--el-bg-color);color:var(--el-text-color-regular)}.files-filter{flex:none;margin-bottom:8px}.files-entry{max-width:100%;font-size:12px;font-weight:400;color:var(--el-text-color-regular)}.files-entry :deep(span){overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.files-entry.is-folder{font-weight:600}.files-entry.is-folder :deep(.el-icon){color:var(--el-color-primary);font-size:17px}.files-entry:not(.is-folder) :deep(.el-icon){color:var(--el-text-color-secondary);font-size:15px}.files-blocked{display:flex;align-items:center;gap:5px;color:var(--el-text-color-secondary)}.files-heading{margin-bottom:10px}.files-toolbar{margin-bottom:2px}.files-summary{padding-top:8px;border-top:1px solid var(--el-border-color);color:var(--el-text-color-secondary)}.files-workspace :deep(.el-table){--el-table-bg-color:var(--el-bg-color);--el-table-tr-bg-color:var(--el-bg-color);--el-table-header-bg-color:var(--el-bg-color);--el-table-header-text-color:var(--el-text-color-secondary);--el-table-text-color:var(--el-text-color-regular);--el-table-border-color:var(--el-border-color);--el-table-row-hover-bg-color:var(--el-fill-color-light);--el-table-current-row-bg-color:var(--el-fill-color)}.files-workspace :deep(.el-table td){padding:6px 0}.files-workspace :deep(.el-table tr.is-selected td){background:var(--el-fill-color)}.files-workspace :deep(.el-table .cell){padding:0 6px}.files-workspace :deep(.el-table__body tr){cursor:default}.files-workspace :deep(.el-table__body tr td:first-child){border-left:2px solid var(--el-border-color)}.files-workspace :deep(.el-table__body tr:hover td:first-child),.files-workspace :deep(.el-table__body tr.is-selected td:first-child){border-left-color:var(--el-color-primary)}.files-workspace :deep(.el-table .sort-caret.ascending){border-bottom-color:var(--el-text-color-secondary)}.files-workspace :deep(.el-table .sort-caret.descending){border-top-color:var(--el-text-color-secondary)}.files-workspace :deep(.el-table .ascending .sort-caret.ascending){border-bottom-color:var(--el-color-primary)}.files-workspace :deep(.el-table .descending .sort-caret.descending){border-top-color:var(--el-color-primary)}
</style>
