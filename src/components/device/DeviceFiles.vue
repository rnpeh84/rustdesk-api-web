<template>
  <el-dialog v-model="visible" :title="`${T('DeviceFiles')} · ${peer.id}`" width="min(900px, calc(100vw - 24px))" append-to-body destroy-on-close :close-on-click-modal="false" @closed="dispose">
    <el-form v-if="!connected" @submit.prevent="connect()">
      <el-form-item v-if="!useSaved" :label="T('WebTerminalPassword')">
        <el-input v-model="password" type="password" show-password autocomplete="off" maxlength="128" :disabled="busy" :aria-label="T('WebTerminalPassword')"/>
      </el-form-item>
      <el-checkbox v-if="hasSaved" v-model="useSaved" :disabled="busy">{{ T('WebTerminalSavedPassword') }}</el-checkbox>
      <el-button type="primary" native-type="submit" :loading="busy">{{ T('WebTerminalCheckConnect') }}</el-button>
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="files-error"/>
    <div v-if="connected" class="files-workspace" :class="{ 'is-dragging': dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="drop">
      <div class="files-toolbar">
        <el-button :disabled="busy || !path" :icon="Back" :aria-label="T('FilesParent')" @click="navigate(parent)"/>
        <span class="files-path" :title="`${user}: ~/${path}`">{{ user }}: ~/{{ path }}</span>
        <el-button :disabled="busy" :icon="Refresh" :aria-label="T('Refresh')" @click="navigate(path)"/>
        <el-button type="primary" :disabled="busy" :icon="Upload" @click="picker?.click()">{{ T('FilesUpload') }}</el-button>
        <input ref="picker" type="file" multiple hidden @change="selectFiles"/>
      </div>
      <div class="files-drop-guide">{{ T('FilesDropGuide') }}</div>
      <el-table :data="entries" height="min(45vh, 420px)" :empty-text="T('FilesEmpty')" row-key="name">
        <el-table-column :label="T('Filename')" min-width="110">
          <template #default="{ row }"><el-button v-if="row.kind === 'directory'" link :disabled="busy" :icon="Folder" @click="navigate(joinPath(row.name))">{{ row.name }}</el-button><span v-else class="files-name">{{ row.name }}<el-icon v-if="row.kind === 'blocked'" :aria-label="T('FilesBlocked')"><Lock/></el-icon></span></template>
        </el-table-column>
        <el-table-column :label="T('FilesSize')" width="80"><template #default="{ row }">{{ row.kind === 'file' ? sizeLabel(row.size) : '-' }}</template></el-table-column>
        <el-table-column width="70"><template #default="{ row }"><el-button v-if="row.kind === 'file'" :disabled="busy" :icon="Download" :aria-label="`${T('FilesDownload')} ${row.name}`" @click="download(row)"/></template></el-table-column>
      </el-table>
      <el-button v-if="next !== null" :disabled="busy" @click="loadMore">{{ T('FilesMore') }}</el-button>
      <div v-if="progress" class="files-progress" role="status" aria-live="polite"><span>{{ progress.name }}</span><el-progress :percentage="progress.percent"/><el-button :disabled="cancelled" @click="cancelled = true">{{ T('Cancel') }}</el-button></div>
      <div v-else-if="notice" role="status" class="files-notice">{{ notice }}</div>
    </div>
    <template #footer><el-button @click="visible = false">{{ T('Close') }}</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { Back, Refresh, Upload, Download, Folder, Lock } from '@element-plus/icons-vue'
import { DeviceFilesClient, fileErrorKey } from '@/utils/deviceFiles'
import { T } from '@/utils/i18n'
const props = defineProps({ peer: { type: Object, required: true } })
const visible = ref(false), connected = ref(false), busy = ref(false), password = ref(''), hasSaved = ref(false), useSaved = ref(false)
const error = ref(''), notice = ref(''), user = ref(''), path = ref(''), entries = ref([]), next = ref(null), progress = ref(null), dragging = ref(false), picker = ref(null), cancelled = ref(false)
const parent = computed(() => path.value.split('/').slice(0, -1).join('/'))
let client, generation = 0, limit = 64 * 1024 * 1024, queued = []
const joinPath = name => path.value ? `${path.value}/${name}` : name
const sizeLabel = size => size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`
const showError = e => { error.value = T(fileErrorKey(e?.message)); notice.value = '' }
const dispose = () => { generation++; client?.close(); client = null; password.value = ''; busy.value = connected.value = dragging.value = false; progress.value = null }
watch(visible, value => { if (!value) dispose() })
const navigate = async target => {
  if (busy.value) return
  const current = client
  busy.value = true; error.value = ''
  try { const result = await current.request('list', { path: target }); if (client !== current) return; path.value = target; entries.value = result.entries; next.value = result.next }
  catch (e) { if (client === current) showError(e) }
  finally { if (client === current) busy.value = false }
}
const loadMore = async () => {
  if (busy.value || next.value === null) return
  const current = client; busy.value = true
  try { const result = await current.request('list', { path: path.value, offset: next.value }); if (client === current) { entries.value.push(...result.entries); next.value = result.next } }
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
    connected.value = true; user.value = ready.user; limit = ready.limit; busy.value = false
    await navigate('')
    if (files?.length) await upload(files)
  } catch (e) { if (client === current) { busy.value = false; showError(e) } }
}
const cancelledTransfer = async current => { if (cancelled.value) { await current.request('cancel'); throw new Error('cancelled') } }
const digest = async data => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), value => value.toString(16).padStart(2, '0')).join('')
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
  if (Array.from(event.dataTransfer.items || []).some(item => item.webkitGetAsEntry?.()?.isDirectory)) { error.value = T('FilesDirectoriesUnsupported'); return }
  upload(Array.from(event.dataTransfer.files || []))
}
defineExpose({ open: async (availability, files = []) => { queued = files; hasSaved.value = !!availability.has_saved_password; useSaved.value = hasSaved.value; error.value = notice.value = ''; visible.value = true; await nextTick(); if (hasSaved.value) await connect(files) } })
onDeactivated(() => { visible.value = false; dispose() })
onBeforeUnmount(dispose)
</script>

<style scoped>
.files-workspace{margin-top:12px;border:2px solid transparent;border-radius:6px}.files-workspace.is-dragging{border-color:var(--el-color-primary);background:var(--el-color-primary-light-9)}.files-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.files-path{flex:1;min-width:80px;overflow-wrap:anywhere;font-family:monospace}.files-toolbar .el-button+.el-button{margin-left:0}.files-drop-guide{margin:10px 0;color:var(--el-text-color-secondary);font-size:12px}.files-error{margin-top:12px}.files-name{overflow-wrap:anywhere}.files-name .el-icon{margin-left:6px}.files-progress{display:grid;grid-template-columns:minmax(0,1fr) minmax(80px,1fr) auto;align-items:center;gap:12px;margin-top:14px}.files-progress>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.files-notice{margin-top:12px;color:var(--el-color-success)}
@media(max-width:600px){.files-progress{grid-template-columns:minmax(0,1fr) auto}.files-progress>span{grid-column:1/-1}}
.files-workspace :deep(.el-button.is-link){max-width:100%;height:auto;white-space:normal;overflow-wrap:anywhere}
</style>
