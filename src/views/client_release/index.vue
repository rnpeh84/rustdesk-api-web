<template>
  <section class="release-page" v-loading="loading" aria-live="polite">
    <el-alert v-if="error" type="error" :title="T('ClientReleaseAdminLoadFailed')" :closable="false" show-icon />
    <el-card shadow="never">
      <template #header>
        <div class="page-head"><div><strong>{{ T('ClientReleaseManagement') }}</strong><small>{{ T('ClientReleaseManagementDescription') }}</small></div><el-button @click="load"><el-icon><Refresh /></el-icon>{{ T('Refresh') }}</el-button></div>
      </template>
      <el-table :data="rows" stripe row-key="manifest.version" :empty-text="T('NoClientReleases')">
        <el-table-column prop="manifest.version" :label="T('Version')" width="130" sortable />
        <el-table-column :label="T('ReleaseStatus')" width="140"><template #default="{ row }"><el-tag :type="statusType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column :label="T('Validation')" min-width="220"><template #default="{ row }"><span v-if="row.validation?.valid" class="validation-ok"><el-icon><CircleCheck /></el-icon>{{ T('ValidationPassed') }}</span><span v-else class="validation-failed" :title="row.validation?.errors?.join('\n')"><el-icon><Warning /></el-icon>{{ validationSummary(row) }}</span></template></el-table-column>
        <el-table-column :label="T('InstallerCount')" width="120"><template #default="{ row }">{{ new Intl.NumberFormat().format(row.manifest.artifacts?.length || 0) }}</template></el-table-column>
        <el-table-column prop="manifest.generated_at" :label="T('GeneratedAt')" min-width="180" sortable><template #default="{ row }">{{ formatDate(row.manifest.generated_at) }}</template></el-table-column>
        <el-table-column :label="T('Action')" width="210" fixed="right" class-name="table-actions"><template #default="{ row }"><el-tooltip :content="T('ValidateRelease')"><el-button circle :aria-label="T('ValidateRelease')" @click="validate(row)"><el-icon><DocumentChecked /></el-icon></el-button></el-tooltip><el-tooltip :content="row.status === 'superseded' ? T('RollbackRelease') : T('PromoteStable')"><el-button circle type="primary" :disabled="!row.validation?.valid || row.status === 'stable' || row.status === 'revoked'" :aria-label="row.status === 'superseded' ? T('RollbackRelease') : T('PromoteStable')" @click="promote(row)"><el-icon><Promotion /></el-icon></el-button></el-tooltip><el-tooltip :content="T('RevokeRelease')"><el-button circle type="danger" plain :disabled="row.status === 'revoked'" :aria-label="T('RevokeRelease')" @click="revoke(row)"><el-icon><CloseBold /></el-icon></el-button></el-tooltip></template></el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header><div class="page-head"><div><strong>{{ T('ClientDistributionHistory') }}</strong><small>{{ T('ClientDistributionHistoryDescription') }}</small></div></div></template>
      <el-tabs v-model="historyTab">
        <el-tab-pane :label="T('ReleaseHistory')" name="release"><el-table :data="history.events" stripe><el-table-column prop="version" :label="T('Version')" width="120"/><el-table-column :label="T('Action')" width="120"><template #default="{ row }">{{ historyAction(row.action) }}</template></el-table-column><el-table-column :label="T('Result')" width="100"><template #default="{ row }">{{ historyResult(row.result) }}</template></el-table-column><el-table-column prop="environment" :label="T('Environment')" min-width="160"/><el-table-column prop="reason" :label="T('FailureReason')" min-width="220" show-overflow-tooltip/><el-table-column prop="actor_name" :label="T('Actor')" width="140"/><el-table-column :label="T('CreatedAt')" min-width="180"><template #default="{ row }">{{ formatTimestamp(row.created_at) }}</template></el-table-column></el-table></el-tab-pane>
        <el-tab-pane :label="T('DownloadHistory')" name="download"><el-table :data="history.downloads" stripe><el-table-column prop="version" :label="T('Version')" width="120"/><el-table-column prop="filename" :label="T('Filename')" min-width="240" show-overflow-tooltip/><el-table-column prop="username" :label="T('Username')" width="140"/><el-table-column prop="environment" :label="T('Environment')" min-width="160" show-overflow-tooltip/><el-table-column :label="T('Result')" width="100"><template #default="{ row }">{{ historyResult(row.result) }}</template></el-table-column><el-table-column prop="bytes" :label="T('TransferredBytes')" width="140"><template #default="{ row }">{{ new Intl.NumberFormat().format(row.bytes || 0) }}</template></el-table-column><el-table-column :label="T('CreatedAt')" min-width="180"><template #default="{ row }">{{ formatTimestamp(row.created_at) }}</template></el-table-column></el-table></el-tab-pane>
      </el-tabs>
    </el-card>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CloseBold, DocumentChecked, Promotion, Refresh, Warning } from '@element-plus/icons'
import { adminClientReleases, clientReleaseHistory, promoteClientRelease, revokeClientRelease, rollbackClientRelease, validateClientRelease } from '@/api/clientRelease'
import { T } from '@/utils/i18n'

const loading = ref(false)
const error = ref(false)
const rows = ref([])
const historyTab = ref('release')
const history = reactive({ events: [], downloads: [] })
const environment = () => `web-admin/${navigator.platform || 'unknown'}`.slice(0, 128)
const load = async () => {
  loading.value = true
  const [releaseResult, historyResult] = await Promise.all([adminClientReleases().catch(() => null), clientReleaseHistory({ limit: 100 }).catch(() => null)])
  rows.value = releaseResult?.data?.list || []
  history.events = historyResult?.data?.events || []
  history.downloads = historyResult?.data?.downloads || []
  error.value = !releaseResult || !historyResult
  loading.value = false
}
const validate = async row => {
  const result = await validateClientRelease({ version: row.manifest.version, environment: environment() }).catch(() => null)
  if (!result) ElMessage.error(T('ClientReleaseActionFailed'))
  else ElMessage.success(result.data.valid ? T('ValidationPassed') : T('ValidationFailed'))
  await load()
}
const promote = async row => {
  const rollback = row.status === 'superseded'
  const message = rollback ? T('RollbackReleaseConfirm', { param: row.manifest.version }) : T('PromoteStableConfirm', { param: row.manifest.version })
  if (!await ElMessageBox.confirm(message, T('Confirm')).catch(() => false)) return
  const action = rollback ? rollbackClientRelease : promoteClientRelease
  if (await action({ version: row.manifest.version, environment: environment() }).catch(() => null)) ElMessage.success(rollback ? T('ReleaseRolledBack') : T('ReleasePromoted'))
  else ElMessage.error(T('ClientReleaseActionFailed'))
  await load()
}
const revoke = async row => {
  const reason = await ElMessageBox.prompt(T('RevokeReleaseReasonGuide'), T('RevokeRelease'), { inputPlaceholder: T('FailureReason'), inputValidator: value => Boolean(value?.trim()) || T('ParamRequired', { param: T('FailureReason') }) }).catch(() => null)
  if (!reason) return
  if (await revokeClientRelease({ version: row.manifest.version, environment: environment(), reason: reason.value }).catch(() => null)) ElMessage.success(T('ReleaseRevoked'))
  else ElMessage.error(T('ClientReleaseActionFailed'))
  await load()
}
const statusType = status => ({ stable: 'success', validated: 'primary', revoked: 'danger', superseded: 'warning' }[status] || 'info')
const statusLabel = status => T({ stable: 'StableRelease', validated: 'Validated', revoked: 'Revoked', superseded: 'Superseded', draft: 'Draft' }[status] || 'Unknown')
const validationSummary = row => row.validation?.errors?.[0] || T('ValidationRequired')
const formatDate = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : T('NoData')
const formatTimestamp = value => value ? formatDate(Number(value) < 1e12 ? Number(value) * 1000 : value) : T('NoData')
const historyAction = action => T({ validate: 'ReleaseActionValidate', promote: 'ReleaseActionPromote', rollback: 'ReleaseActionRollback', revoke: 'ReleaseActionRevoke', install: 'ReleaseActionInstall' }[action] || 'Unknown')
const historyResult = result => T(result === 'success' ? 'ResultSuccess' : result === 'failure' ? 'ResultFailure' : 'Unknown')
onMounted(load)
</script>

<style scoped lang="scss">
.release-page{display:grid;gap:16px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.page-head{display:flex;justify-content:space-between;align-items:center;gap:16px}.page-head strong,.page-head small{display:block}.page-head small{margin-top:4px;color:var(--console-muted)}.validation-ok,.validation-failed{display:inline-flex;align-items:center;max-width:100%;gap:6px}.validation-ok{color:var(--console-success)}.validation-failed{color:var(--console-warning);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.release-page :deep(.el-table .cell){font-variant-numeric:tabular-nums}@media(max-width:700px){.page-head{align-items:flex-start}.page-head .el-button{flex:0 0 auto}.release-page :deep(.el-card__body){overflow-x:auto}}
</style>
