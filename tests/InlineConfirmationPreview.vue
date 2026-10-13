<template>
  <main class="delete-preview">
    <header><div><h1>{{ T('DeletePreviewTitle') }}</h1><p>{{ T('DeletePreviewHint') }}</p></div><div class="preview-tools"><el-button @click="toggleTheme">{{ T(dark ? 'DeletePreviewLight' : 'DeletePreviewDark') }}</el-button><el-button :icon="Refresh" @click="restore">{{ T('Reset') }}</el-button></div></header>
    <el-card shadow="never" class="icon-action-preview">
      <h2>{{ T('IconActionPreviewTitle') }}</h2><p>{{ T('IconActionPreviewHint') }}</p>
      <div v-for="scope in ['row-actions', 'card-actions', 'table-actions']" :key="scope" :class="scope" class="preview-icon-actions" :data-testid="`icons-${scope}`">
        <el-tooltip v-for="item in actionSamples" :key="item.key" :content="T(item.label)"><el-button :class="item.class" :data-testid="`action-${scope}-${item.key}`" :type="item.type" :circle="item.circle" :plain="item.plain" :link="item.link" :icon="item.slot ? undefined : item.icon" :disabled="item.disabled" :aria-label="T(item.label)" @click="lastResult = T(item.label)"><template v-if="item.slot" #default><el-icon><component :is="item.icon"/></el-icon></template></el-button></el-tooltip>
        <InlineConfirmButton :data-testid="`action-${scope}-confirm`" tone="primary" :icon="Upload" :label="T('Publish')" :action="() => { lastResult = T('Publish') }"/>
        <InlineConfirmButton :data-testid="`action-${scope}-revoke`" :label="T('Revoke')" :action="() => { lastResult = T('Revoke') }"/>
        <InlineConfirmButton :data-testid="`action-${scope}-unshare`" :icon="Remove" :label="T('StopSharing')" :action="() => { lastResult = T('StopSharing') }"/>
      </div>
    </el-card>
    <el-card shadow="never" class="query-toolbar">
      <div class="preview-toolbar"><InlineConfirmButton data-testid="batch" show-label :label="T('BatchDelete')" :disabled="!rows.length" :confirm-key="rows.map(row => row.row_id).join(',')" :action="clearRows"/><span>{{ T('DeletePreviewSteps') }}</span></div>
    </el-card>
    <el-card shadow="never" class="list-body">
      <el-table :data="rows" row-key="row_id">
        <el-table-column prop="id" label="ID" min-width="110"/>
        <el-table-column prop="hostname" :label="T('Hostname')" min-width="150"/>
        <el-table-column :label="T('Type')" min-width="130"><template #default="{row}">{{ T(row.shared ? 'DeletePreviewShared' : 'DeletePreviewOwned') }}</template></el-table-column>
        <el-table-column :label="T('Actions')" width="96" fixed="right"><template #default="{row}"><div class="row-actions" :data-testid="`row-${row.row_id}`"><OwnedDeviceDelete v-if="row.owned" :peer="row" @deleted="deleted"/><InlineConfirmButton v-else :label="T('Delete')" :confirm-key="row.row_id" :action="() => deleteRow(row.row_id)"/></div></template></el-table-column>
      </el-table>
    </el-card>
    <div class="preview-status" role="status" aria-live="polite">{{ T('DeletePreviewResult', { param: lastResult }) }} · {{ T('DeletePreviewCalls', { param: deleteCalls }) }}</div>
    <p class="preview-note">{{ T('DeletePreviewSafety') }}</p>
    <section class="edge-probe"><span>{{ T('DeletePreviewEdge') }}</span><div class="row-actions"><InlineConfirmButton data-testid="edge" :label="T('DeletePreviewLongLabel')" :action="edgeDelete"/></div></section>
  </main>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { ArrowUp, CircleCheck, Close, CopyDocument, Edit, MoreFilled, Refresh, Remove, Share, Upload, View } from '@element-plus/icons-vue'
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
import OwnedDeviceDelete from '@/components/device/OwnedDeviceDelete.vue'
import request from '@/utils/request'
import { useAppStore } from '@/store/app'
import { T } from '@/utils/i18n'

useAppStore().setting.lang = 'ko'
const dark = ref(true), rows = ref([]), deleteCalls = ref(0), lastResult = ref(T('DeletePreviewWaiting'))
const actionSamples = [
  { key: 'edit', label: 'Edit', icon: Edit, circle: true },
  { key: 'share', label: 'Share', icon: Share, type: 'primary', plain: true },
  { key: 'view', label: 'Preview', icon: View, type: 'info', plain: true, circle: true },
  { key: 'refresh', label: 'SyncBuildStatus', icon: Refresh, type: 'warning', plain: true, circle: true },
  { key: 'validate', label: 'ValidatePolicy', icon: CircleCheck, type: 'primary', circle: true },
  { key: 'publish', label: 'Publish', icon: Upload, type: 'success', circle: true },
  { key: 'cancel', label: 'Cancel', icon: Close, type: 'danger', plain: true, circle: true },
  { key: 'more', label: 'More', icon: MoreFilled, circle: true },
  { key: 'copy', label: 'CopyId', icon: CopyDocument, class: 'table-copy-button', link: true, slot: true },
  { key: 'order', label: 'MoveUp', icon: ArrowUp, class: 'console-icon-action', slot: true },
  { key: 'disabled', label: 'Edit', icon: Edit, type: 'primary', circle: true, disabled: true },
]
const samples = () => [
  { row_id: 1, id: '123456789', hostname: 'Windows 테스트 PC', owned: false },
  { row_id: 2, id: '234567891', hostname: 'Linux 테스트 서버', owned: true },
  { row_id: 3, id: '345678912', hostname: '공유 중인 테스트 PC', owned: true, shared: true },
]
const restore = () => { rows.value = samples(); deleteCalls.value = 0; lastResult.value = T('DeletePreviewWaiting') }
restore()
const toggleTheme = () => { dark.value = !dark.value; document.documentElement.classList.toggle('dark', dark.value) }
const deleted = id => { rows.value = rows.value.filter(row => row.row_id !== id); lastResult.value = T('DeletePreviewDeleted') }
const delay = () => new Promise(resolve => setTimeout(resolve, 800))
const deleteRow = async id => { deleteCalls.value++; await delay(); deleted(id) }
const clearRows = async () => { deleteCalls.value++; await delay(); rows.value = []; lastResult.value = T('DeletePreviewDeleted') }
const edgeDelete = async () => { deleteCalls.value++; await delay(); lastResult.value = T('DeletePreviewDeleted') }

// 테스트 페이지의 모든 API 요청은 메모리 응답으로 끝낸다. 운영·로컬 DB에는 연결하지 않는다.
const previousAdapter = request.defaults.adapter
request.defaults.adapter = async config => {
  let data
  if (config.url === '/my/peer/delete-preview') {
    const row = rows.value.find(item => item.row_id === Number(config.params.row_id))
    data = { revision: 'preview-only', shares: row?.shared ? [{ kind: 'user', id: 1, target_id: 1, target_type: 1, name: '테스트 공유', recipient: '테스트 사용자' }] : [] }
  } else if (config.url === '/my/peer/delete') {
    deleteCalls.value++; await delay(); data = {}
  } else throw new Error('테스트 페이지에서 지원하지 않는 API 요청입니다.')
  return { data: { code: 0, data }, status: 200, statusText: 'OK', headers: {}, config }
}
onBeforeUnmount(() => { request.defaults.adapter = previousAdapter })
</script>

<style scoped>
.delete-preview { min-width: 0; padding: 24px; font-family: inherit; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
h1 { margin: 0; color: var(--console-heading); font-size: 22px; font-weight: 600; }
p { margin: 8px 0 0; color: var(--console-muted); font-size: 13px; line-height: 1.6; }
.preview-tools, .preview-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.preview-toolbar span { color: var(--console-muted); font-size: 13px; }
.query-toolbar { margin-bottom: 12px; }
.icon-action-preview { margin-bottom: 12px; }
.icon-action-preview :deep(.el-card__body) { padding: 12px 16px; }
.icon-action-preview h2 { margin: 0; font-size: 15px; font-weight: 500; color: var(--console-heading); }
.preview-icon-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 12px; }
.query-toolbar :deep(.el-card__body) { padding: 12px 16px; }
.preview-status { margin-top: 16px; min-height: 20px; font-size: 13px; color: var(--console-text); }
.preview-note { margin-top: 8px; }
.edge-probe { position: fixed; z-index: 20; right: 4px; bottom: 4px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--console-muted); background: var(--console-surface); padding: 6px; border: 1px solid var(--console-border); border-radius: 6px; }
@media (max-width: 767px) { .delete-preview { padding: 12px; } header { flex-direction: column; } .preview-toolbar { gap: 8px; } }
</style>
