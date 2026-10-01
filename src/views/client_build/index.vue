<template>
  <section class="build-page" v-loading="loading">
    <header class="page-intro"><div><span class="eyebrow">{{ T('ClientDistribution') }}</span><h1>{{ T('ClientBuildCenter') }}</h1><p>{{ T('ClientBuildCenterDescription') }}</p></div><el-button @click="load"><el-icon><Refresh /></el-icon>{{ T('Refresh') }}</el-button></header>

    <div class="workspace-grid">
      <el-card shadow="never" class="request-card">
        <template #header><div class="card-heading"><div><strong>{{ T('NewClientBuild') }}</strong><small>{{ T('NewClientBuildDescription') }}</small></div><el-tag :type="readiness.ready ? 'success' : 'warning'" effect="plain">{{ readiness.ready ? T('BuildReady') : T('BuildNotReady') }}</el-tag></div></template>
        <el-form label-position="top">
          <div class="form-grid">
            <el-form-item :label="T('GitHubConnection')"><el-select v-model="form.source_connection_id" @change="checkReadiness"><el-option v-for="item in connections" :key="item.id" :label="`${item.name} · ${item.owner}/${item.repository}`" :value="item.id" /></el-select></el-form-item>
            <el-form-item :label="T('EndpointProfile')"><el-select v-model="form.endpoint_profile_id" @change="checkReadiness"><el-option v-for="item in profiles" :key="item.id" :label="`${item.name} · r${item.revision}`" :value="item.id" /></el-select></el-form-item>
            <el-form-item :label="T('ClientVersion')"><el-input v-model="form.version" placeholder="1.4.9-company.1" /></el-form-item>
            <el-form-item :label="T('GitRef')"><el-input v-model="form.git_ref" placeholder="master 또는 tag" /></el-form-item>
          </div>
          <el-form-item :label="T('BuildTargets')"><el-checkbox-group v-model="form.targets" class="target-grid" @change="checkReadiness"><el-checkbox v-for="target in targetOptions" :key="target.value" :value="target.value" border>{{ target.label }}</el-checkbox></el-checkbox-group></el-form-item>
        </el-form>
        <div class="readiness-list">
          <div v-for="check in readiness.checks" :key="check.key" :class="['readiness-item', { ready: check.ready }]">
            <el-icon><CircleCheck v-if="check.ready"/><Warning v-else/></el-icon><span>{{ check.message }}</span>
          </div>
          <p v-if="!readiness.checks.length">{{ T('SelectBuildConfiguration') }}</p>
        </div>
        <el-button type="primary" size="large" :disabled="!readiness.ready || !validForm" :loading="submitting" @click="submit"><el-icon><VideoPlay /></el-icon>{{ T('StartClientBuild') }}</el-button>
      </el-card>

      <aside class="flow-card">
        <strong>{{ T('BuildFlow') }}</strong>
        <ol><li v-for="(step,index) in flowSteps" :key="step"><span>{{ index+1 }}</span><div>{{ step }}</div></li></ol>
      </aside>
    </div>

    <el-card shadow="never">
      <template #header><div class="card-heading"><div><strong>{{ T('ClientBuildHistory') }}</strong><small>{{ T('ClientBuildHistoryDescription') }}</small></div></div></template>
      <el-table :data="jobs" stripe :empty-text="T('NoClientBuildJobs')">
        <el-table-column prop="version" :label="T('Version')" width="150" fixed="left" />
        <el-table-column :label="T('BuildStatus')" width="130"><template #default="{row}"><el-tag :type="jobType(row.status)" effect="plain">{{ jobLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column prop="repository" :label="T('Repository')" min-width="190" show-overflow-tooltip />
        <el-table-column prop="commit_sha" label="Commit" width="120"><template #default="{row}"><code>{{ row.commit_sha?.slice(0,10) || '-' }}</code></template></el-table-column>
        <el-table-column :label="T('EndpointProfile')" min-width="160"><template #default="{row}">{{ row.endpoint_profile_key }} · r{{ row.endpoint_revision }}</template></el-table-column>
        <el-table-column :label="T('CandidateRelease')" width="140"><template #default="{row}"><el-tag :type="row.candidate_imported_at ? 'success' : row.candidate_import_error ? 'danger' : 'info'" effect="plain">{{ row.candidate_imported_at ? T('CandidateImported') : row.candidate_import_error ? T('CandidateImportFailed') : T('CandidatePending') }}</el-tag></template></el-table-column>
        <el-table-column prop="requested_by_name" :label="T('Requester')" width="130" />
        <el-table-column :label="T('CreatedAt')" width="180"><template #default="{row}">{{ formatTime(row.created_at) }}</template></el-table-column>
        <el-table-column :label="T('FailureReason')" min-width="220" show-overflow-tooltip><template #default="{row}">{{ row.error_message || row.candidate_import_error || '-' }}</template></el-table-column>
        <el-table-column :label="T('Actions')" width="150" fixed="right" align="center">
          <template #default="{row}">
            <div class="row-actions">
              <el-tooltip :content="T('SyncBuildStatus')"><el-button circle :loading="actionJobId === row.id" @click="refreshJob(row)"><el-icon><Refresh /></el-icon></el-button></el-tooltip>
              <el-tooltip v-if="row.github_run_url" :content="T('OpenGitHubRun')"><el-button circle tag="a" :href="row.github_run_url" target="_blank" rel="noopener noreferrer"><el-icon><Link /></el-icon></el-button></el-tooltip>
              <el-tooltip v-if="canCancel(row)" :content="T('CancelBuild')"><el-button circle type="danger" plain :disabled="actionJobId === row.id" @click="cancelJob(row)"><el-icon><Close /></el-icon></el-button></el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { CircleCheck, Close, Link, Refresh, VideoPlay, Warning } from '@element-plus/icons'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelClientBuildJob, clientBuildJobs, clientBuildReadiness, createClientBuildJob, endpointProfiles, githubConnections, refreshClientBuildJob } from '@/api/clientRelease'
import { T } from '@/utils/i18n'

const loading = ref(false), submitting = ref(false), autoSyncing = ref(false), actionJobId = ref(null), profiles = ref([]), connections = ref([]), jobs = ref([])
const readiness = reactive({ ready: false, checks: [] })
const form = reactive({ source_connection_id: null, endpoint_profile_id: null, version: '', git_ref: 'master', targets: ['windows-x86_64', 'macos-aarch64', 'linux-x86_64'] })
const targetOptions = [{ value: 'windows-x86_64', label: 'Windows x64' }, { value: 'windows-aarch64', label: 'Windows ARM64' }, { value: 'macos-x86_64', label: 'macOS Intel' }, { value: 'macos-aarch64', label: 'macOS Apple Silicon' }, { value: 'linux-x86_64', label: 'Linux x64' }, { value: 'linux-aarch64', label: 'Linux ARM64' }]
const flowSteps = computed(() => [T('BuildFlowSource'), T('BuildFlowSnapshot'), T('BuildFlowRunner'), T('BuildFlowCandidate'), T('BuildFlowPromote')])
const validForm = computed(() => Boolean(form.version.trim() && form.git_ref.trim() && form.targets.length))
const load = async () => {
  loading.value = true
  try {
    const [profileResult, connectionResult, jobResult] = await Promise.all([endpointProfiles(), githubConnections(), clientBuildJobs({ limit: 100 })])
    profiles.value = profileResult.data?.list || []; connections.value = connectionResult.data?.list || []; jobs.value = jobResult.data?.list || []
    if (!form.endpoint_profile_id) form.endpoint_profile_id = profiles.value.find(item => item.is_default)?.id || profiles.value[0]?.id || null
    if (!form.source_connection_id) form.source_connection_id = connections.value.find(item => item.status === 'ready')?.id || connections.value[0]?.id || null
    await checkReadiness()
  } finally { loading.value = false }
}
const checkReadiness = async () => {
  readiness.ready = false; readiness.checks = []
  if (!form.source_connection_id || !form.endpoint_profile_id) return
  const result = await clientBuildReadiness({ connection_id: form.source_connection_id, profile_id: form.endpoint_profile_id, targets: form.targets.join(',') }).catch(() => null)
  if (result) Object.assign(readiness, result.data)
}
const submit = async () => {
  submitting.value = true
  try {
    const key = `web-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
    await createClientBuildJob({ ...form, idempotency_key: key })
    ElMessage.success(T('ClientBuildRequested')); await load()
  } finally { submitting.value = false }
}
const replaceJob = updated => { jobs.value = jobs.value.map(item => item.id === updated.id ? updated : item) }
const refreshJob = async row => {
  actionJobId.value = row.id
  try {
    const result = await refreshClientBuildJob(row.id)
    replaceJob(result.data)
    ElMessage.success(T('BuildStatusSynced'))
  } finally { actionJobId.value = null }
}
const cancelJob = async row => {
  await ElMessageBox.confirm(T('CancelBuildConfirm'), T('CancelBuild'), { type: 'warning', confirmButtonText: T('Confirm'), cancelButtonText: T('Cancel') })
  actionJobId.value = row.id
  try {
    const result = await cancelClientBuildJob(row.id)
    replaceJob(result.data)
    ElMessage.success(T('BuildCancelRequested'))
  } finally { actionJobId.value = null }
}
const canCancel = row => ['queued', 'running'].includes(row.status) && Boolean(row.github_run_id)
const needsSync = row => ['queued', 'running', 'cancelling'].includes(row.status) || (row.status === 'succeeded' && !row.candidate_imported_at)
const autoSync = async () => {
  if (loading.value || actionJobId.value || autoSyncing.value) return
  const pending = jobs.value.filter(needsSync).slice(0, 10)
  if (!pending.length) return
  autoSyncing.value = true
  try {
    await Promise.all(pending.map(async row => {
      const result = await refreshClientBuildJob(row.id).catch(() => null)
      if (result?.data) replaceJob(result.data)
    }))
  } finally { autoSyncing.value = false }
}
const jobType = status => ({ succeeded: 'success', failed: 'danger', cancelled: 'info', cancelling: 'warning', running: 'primary', queued: 'warning' }[status] || 'info')
const jobLabel = status => T({ succeeded: 'BuildSucceeded', failed: 'BuildFailed', cancelled: 'BuildCancelled', cancelling: 'BuildCancelling', running: 'BuildRunning', queued: 'BuildQueued' }[status] || 'Unknown')
const formatTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(value) < 1e12 ? Number(value) * 1000 : value)) : T('NoData')
let syncTimer
onMounted(async () => { await load(); syncTimer = window.setInterval(autoSync, 15000) })
onBeforeUnmount(() => { if (syncTimer) window.clearInterval(syncTimer) })
</script>

<style scoped lang="scss">
.build-page{display:grid;gap:16px}.page-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:4px 0 2px}.page-intro h1{margin:4px 0 6px;font-size:24px}.page-intro p{margin:0;color:var(--console-muted)}.eyebrow{color:var(--console-primary);font-size:12px;font-weight:700;letter-spacing:.08em}.workspace-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.card-heading strong,.card-heading small{display:block}.card-heading small{margin-top:4px;color:var(--console-muted)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.target-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%}.target-grid :deep(.el-checkbox){width:100%;margin:0}.readiness-list{display:grid;gap:8px;margin:4px 0 18px;padding:14px;border:1px solid var(--console-border);border-radius:8px;background:var(--console-bg)}.readiness-list>p{margin:0;color:var(--console-muted)}.readiness-item{display:flex;align-items:center;gap:8px;color:var(--console-warning)}.readiness-item.ready{color:var(--console-success)}.flow-card{padding:20px;border:1px solid var(--console-border);border-radius:10px;background:var(--console-surface)}.flow-card ol{display:grid;gap:0;margin:18px 0 0;padding:0;list-style:none}.flow-card li{display:grid;grid-template-columns:28px 1fr;gap:10px;min-height:58px;color:var(--console-text)}.flow-card li span{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;color:var(--console-primary);background:var(--console-primary-soft);font-weight:700}.flow-card li:not(:last-child) div{border-bottom:1px solid var(--console-border);padding-bottom:16px}.row-actions{display:flex;justify-content:center;gap:6px}.build-page code{font-size:12px}@media(max-width:960px){.workspace-grid{grid-template-columns:1fr}.flow-card{display:none}}@media(max-width:700px){.page-intro,.form-grid{display:grid;grid-template-columns:1fr}.target-grid{grid-template-columns:1fr}.build-page :deep(.el-card__body){overflow-x:auto}}
</style>
