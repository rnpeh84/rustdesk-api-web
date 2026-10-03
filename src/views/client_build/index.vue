<template>
  <section class="build-page" v-loading="loading">
    <header class="page-intro"><div><h1>{{ T('ClientBuildCenter') }}</h1><p>{{ T('ClientBuildCenterDescription') }}</p></div><el-button @click="load"><el-icon><Refresh /></el-icon>{{ T('Refresh') }}</el-button></header>

    <div class="workspace-grid">
      <el-card shadow="never" class="request-card">
        <template #header><div class="card-heading"><div><strong>{{ T('NewClientBuild') }}</strong><small>{{ T('NewClientBuildDescription') }}</small></div><el-tag :type="readiness.ready ? 'success' : 'warning'" effect="plain">{{ readiness.ready ? T('BuildReady') : T('BuildNotReady') }}</el-tag></div></template>
        <el-form label-position="top">
          <div class="form-grid">
            <el-form-item :label="T('GitHubBuildSource')"><el-select v-model="form.build_source_id" @change="selectSource"><el-option v-for="item in sources" :key="item.id" :label="`${item.name} · ${item.owner}/${item.repository}`" :value="item.id" /></el-select></el-form-item>
            <el-form-item :label="T('EndpointProfile')"><el-select v-model="form.endpoint_profile_id" @change="checkReadiness"><el-option v-for="item in profiles" :key="item.id" :label="`${item.name} · r${item.revision}`" :value="item.id" /></el-select></el-form-item>
            <el-form-item :label="T('ClientVersion')">
              <div class="version-preview" :aria-busy="versionLoading">
                <el-input :model-value="versionPreview?.version || ''" readonly :aria-label="T('ClientVersion')" name="calculated_version" :placeholder="T('AutomaticBuildVersion')">
                  <template #suffix><el-icon v-if="versionLoading" class="is-loading" aria-hidden="true"><Loading /></el-icon><el-button v-else link :aria-label="T('RefreshBuildVersion')" @click="refreshVersion"><el-icon aria-hidden="true"><Refresh /></el-icon></el-button></template>
                </el-input>
                <div class="version-evidence" aria-live="polite">
                  <span v-if="versionPreview?.official_version">{{ T('SourceVersion') }}: {{ versionPreview.official_version }}</span>
                  <span v-if="versionPreview?.previous_version">{{ T('PreviousBuildVersion') }}: {{ versionPreview.previous_version }}</span>
                  <span v-if="versionPreview">{{ T({source:'BuildVersionFromSource',history:'BuildVersionFromHistory',initial:'BuildVersionFromInitial'}[versionPreview.origin]) }}</span>
                  <span v-if="versionError" class="version-error" role="alert">{{ versionError }}</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item :label="T('GitRef')"><el-input v-model="form.git_ref" placeholder="master 또는 tag" /></el-form-item>
            <el-form-item v-if="versionPreview?.needs_initial_version || versionPreview?.origin === 'initial'" :label="T('InitialSourceVersion')"><div class="version-preview"><el-input v-model="form.base_version" :aria-label="T('InitialSourceVersion')" name="initial_base_version" autocomplete="off" :spellcheck="false" placeholder="1.4.9" /><small>{{ T('InitialSourceVersionGuide') }}</small></div></el-form-item>
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
        <el-table-column :label="T('BuildStatus')" width="150"><template #default="{row}"><el-tag :type="jobType(row.status)" effect="plain">{{ jobDisplayLabel(row) }}</el-tag></template></el-table-column>
        <el-table-column :label="T('GitHubExecution')" min-width="155"><template #default="{row}">{{ row.github_run_id ? `#${row.github_run_id}` : row.status === 'failed' ? T('RunNotLinked') : T('WaitingRunLink') }}</template></el-table-column>
        <el-table-column prop="repository" :label="T('Repository')" min-width="190" show-overflow-tooltip />
        <el-table-column prop="commit_sha" label="Commit" width="120"><template #default="{row}"><code>{{ row.commit_sha?.slice(0,10) || '-' }}</code></template></el-table-column>
        <el-table-column :label="T('EndpointProfile')" min-width="160"><template #default="{row}">{{ row.endpoint_profile_key }} · r{{ row.endpoint_revision }}</template></el-table-column>
        <el-table-column :label="T('CandidateRelease')" width="140"><template #default="{row}"><el-tag :type="row.candidate_imported_at ? 'success' : row.candidate_import_error ? 'danger' : 'info'" effect="plain">{{ row.candidate_imported_at ? T('CandidateImported') : row.candidate_import_error ? T('CandidateImportFailed') : T('CandidatePending') }}</el-tag></template></el-table-column>
        <el-table-column prop="requested_by_name" :label="T('Requester')" width="130" />
        <el-table-column :label="T('CreatedAt')" width="180"><template #default="{row}">{{ formatTime(row.created_at) }}</template></el-table-column>
        <el-table-column :label="T('FailureReason')" min-width="220" show-overflow-tooltip><template #default="{row}">{{ row.error_message || row.candidate_import_error || '-' }}</template></el-table-column>
        <el-table-column :label="T('Actions')" width="200" fixed="right" align="center">
          <template #default="{row}">
            <div class="row-actions">
              <el-button :aria-label="T('BuildDetails')" @click="openDetails(row)">{{ T('BuildDetails') }}</el-button>
              <el-tooltip :content="T('SyncBuildStatus')"><el-button circle :aria-label="T('SyncBuildStatus')" :loading="actionJobId === row.id" @click="refreshJob(row)"><el-icon><Refresh /></el-icon></el-button></el-tooltip>
              <el-tooltip v-if="row.github_run_url" :content="T('OpenGitHubRun')"><el-button circle tag="a" :aria-label="T('OpenGitHubRun')" :href="row.github_run_url" target="_blank" rel="noopener noreferrer"><el-icon><Link /></el-icon></el-button></el-tooltip>
              <el-tooltip v-if="canCancel(row)" :content="T('CancelBuild')"><el-button circle :aria-label="T('CancelBuild')" type="danger" plain :disabled="actionJobId === row.id" @click="cancelJob(row)"><el-icon><Close /></el-icon></el-button></el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-dialog v-model="detailsVisible" :title="T('BuildDetails')" width="min(820px, 94vw)">
      <div v-loading="detailsLoading" class="build-details" aria-live="polite">
        <template v-if="details">
          <el-descriptions :column="1" border>
            <el-descriptions-item :label="T('Version')">{{ details.job.version }}</el-descriptions-item>
            <el-descriptions-item :label="T('GitHubExecution')">{{ details.job.github_run_id ? `#${details.job.github_run_id}` : T('RunNotLinked') }}</el-descriptions-item>
            <el-descriptions-item :label="T('BuildStatus')">{{ details.run_status ? executionLabel(details.conclusion || details.run_status) : jobDisplayLabel(details.job) }}</el-descriptions-item>
            <el-descriptions-item :label="T('FailureReason')">{{ details.job.error_message || details.job.candidate_import_error || '-' }}</el-descriptions-item>
          </el-descriptions>
          <p class="details-note">{{ details.message }}</p>
          <article v-for="task in details.tasks" :key="task.id" class="build-task">
            <header><strong>{{ task.name }}</strong><el-tag :type="task.conclusion === 'failure' ? 'danger' : task.conclusion === 'success' ? 'success' : 'info'">{{ executionLabel(task.conclusion || task.status) }}</el-tag></header>
            <p>{{ T('Runner') }}: {{ task.runner_name || T('BuildQueued') }}</p>
            <ol><li v-for="step in task.steps" :key="step.number" :class="{ 'failed-step': step.conclusion === 'failure' }"><span>{{ step.name }}</span><span>{{ executionLabel(step.conclusion || step.status) }}</span></li></ol>
            <el-button tag="a" :href="task.log_url" target="_blank" rel="noopener noreferrer">{{ T('ViewBuildLogs') }}</el-button>
          </article>
        </template>
        <el-alert v-else-if="detailsError" :title="detailsError" type="error" :closable="false" />
      </div>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CircleCheck, Close, Link, Loading, Refresh, VideoPlay, Warning } from '@element-plus/icons'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelClientBuildJob, clientBuildDetails, clientBuildJobs, clientBuildReadiness, clientBuildVersionPreview, createClientBuildJob, endpointProfiles, githubBuildSources, refreshClientBuildJob } from '@/api/clientRelease'
import { T } from '@/utils/i18n'

const loading = ref(false), submitting = ref(false), autoSyncing = ref(false), actionJobId = ref(null), profiles = ref([]), sources = ref([]), jobs = ref([])
const readiness = reactive({ ready: false, checks: [] })
const detailsVisible = ref(false), detailsLoading = ref(false), details = ref(null), detailsError = ref('')
let detailRequest = 0
const openDetails = async row => {
  const current = ++detailRequest
  detailsVisible.value = true; detailsLoading.value = true; details.value = null; detailsError.value = ''
  try {
    const result = await clientBuildDetails(row.id)
    if (current === detailRequest) details.value = result.data
  } catch {
    if (current === detailRequest) detailsError.value = T('BuildDetailsUnavailable')
  } finally {
    if (current === detailRequest) detailsLoading.value = false
  }
}
const executionLabel = status => T({ queued: 'BuildQueued', waiting: 'BuildQueued', pending: 'BuildQueued', requested: 'BuildQueued', in_progress: 'BuildRunning', completed: 'BuildCompleted', success: 'BuildSucceeded', failure: 'BuildFailed', timed_out: 'BuildTimedOut', cancelled: 'BuildCancelled', skipped: 'BuildSkipped', action_required: 'BuildActionRequired' }[status] || 'Unknown')
const form = reactive({ build_source_id: null, endpoint_profile_id: null, base_version: '', git_ref: '', targets: ['windows-x86_64', 'macos-aarch64', 'linux-x86_64'] })
const versionPreview = ref(null), versionLoading = ref(false), versionError = ref('')
let versionRequest = 0, versionTimer, versionController
const refreshVersion = async () => {
  window.clearTimeout(versionTimer)
  const current = ++versionRequest
  versionController?.abort()
  versionController = new AbortController()
  versionLoading.value = true; versionError.value = ''
  if (!form.build_source_id || !form.git_ref.trim()) { versionPreview.value = null; versionLoading.value = false; return }
  try {
    const result = await clientBuildVersionPreview({ source_id: form.build_source_id, git_ref: form.git_ref.trim(), base_version: form.base_version.trim() }, versionController.signal)
    if (current === versionRequest) versionPreview.value = result.data
  } catch (error) {
    if (current === versionRequest && error?.code !== 'ERR_CANCELED') {
      if (versionPreview.value?.origin !== 'initial') versionPreview.value = null
      versionError.value = error?.message || T('BuildVersionUnavailable')
    }
  } finally { if (current === versionRequest) versionLoading.value = false }
}
watch(() => [form.build_source_id, form.git_ref, form.base_version], (current, previous) => {
  if (current[0] !== previous[0] || current[1] !== previous[1]) { versionPreview.value = null; form.base_version = '' }
  ++versionRequest; versionController?.abort(); window.clearTimeout(versionTimer)
  // 최초 입력란은 기준 버전을 입력하는 동안 유지하고 이전 제안으로 빌드하는 것은 막는다.
  versionLoading.value = true; versionError.value = ''
  versionTimer = window.setTimeout(refreshVersion, 400)
})
const targetOptions = [{ value: 'windows-x86_64', label: 'Windows x64' }, { value: 'windows-aarch64', label: 'Windows ARM64' }, { value: 'macos-x86_64', label: 'macOS Intel' }, { value: 'macos-aarch64', label: 'macOS Apple Silicon' }, { value: 'linux-x86_64', label: 'Linux x64' }, { value: 'linux-aarch64', label: 'Linux ARM64' }]
const flowSteps = computed(() => [T('BuildFlowSource'), T('BuildFlowSnapshot'), T('BuildFlowRunner'), T('BuildFlowCandidate'), T('BuildFlowPromote')])
const validForm = computed(() => Boolean(!versionLoading.value && !versionError.value && versionPreview.value?.version && form.git_ref.trim() && form.targets.length))
const load = async () => {
  loading.value = true
  try {
    const [profileResult, sourceResult, jobResult] = await Promise.all([endpointProfiles(), githubBuildSources(), clientBuildJobs({ limit: 100 })])
    profiles.value = profileResult.data?.list || []; sources.value = sourceResult.data?.list || []; jobs.value = jobResult.data?.list || []
    if (!form.endpoint_profile_id) form.endpoint_profile_id = profiles.value.find(item => item.is_default)?.id || profiles.value[0]?.id || null
    if (!form.build_source_id) form.build_source_id = sources.value.find(item => item.status === 'ready' && item.is_enabled)?.id || sources.value[0]?.id || null
    if (!form.git_ref) form.git_ref = sources.value.find(item => item.id === form.build_source_id)?.branch || ''
    await Promise.all([checkReadiness(), refreshVersion()])
  } finally { loading.value = false }
}
const checkReadiness = async () => {
  readiness.ready = false; readiness.checks = []
  if (!form.build_source_id || !form.endpoint_profile_id) return
  const result = await clientBuildReadiness({ source_id: form.build_source_id, profile_id: form.endpoint_profile_id, targets: form.targets.join(',') }).catch(() => null)
  if (result) Object.assign(readiness, result.data)
}
const selectSource = () => {
  form.git_ref = sources.value.find(item => item.id === form.build_source_id)?.branch || ''
  checkReadiness()
}
const submit = async () => {
  submitting.value = true
  try {
    const key = `web-${Date.now()}-${Math.random().toString(36).slice(2,10)}`
    await createClientBuildJob({ ...form, auto_version: true, expected_commit_sha: versionPreview.value.commit_sha, idempotency_key: key })
    ElMessage.success(T('ClientBuildRequested')); await load()
  } finally { submitting.value = false; await refreshVersion() }
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
const jobDisplayLabel = row => row.status === 'failed' && !row.github_run_id ? T('BuildDispatchFailed') : jobLabel(row.status)
const formatTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(Number(value) < 1e12 ? Number(value) * 1000 : value)) : T('NoData')
let syncTimer
onMounted(async () => { await load(); syncTimer = window.setInterval(autoSync, 15000) })
onBeforeUnmount(() => { if (syncTimer) window.clearInterval(syncTimer); window.clearTimeout(versionTimer); ++versionRequest; versionController?.abort() })
</script>

<style scoped lang="scss">
.build-page{display:grid;gap:16px}.page-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:4px 0 2px}.page-intro h1{margin:0 0 6px;font-size:24px}.page-intro p{margin:0;color:var(--console-muted)}.workspace-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.card-heading strong,.card-heading small{display:block}.card-heading small{margin-top:4px;color:var(--console-muted)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.target-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%}.target-grid :deep(.el-checkbox){width:100%;margin:0}.readiness-list{display:grid;gap:8px;margin:4px 0 18px;padding:14px;border:1px solid var(--console-border);border-radius:8px;background:var(--console-bg)}.readiness-list>p{margin:0;color:var(--console-muted)}.readiness-item{display:flex;align-items:center;gap:8px;color:var(--console-warning)}.readiness-item.ready{color:var(--console-success)}.flow-card{padding:20px;border:1px solid var(--console-border);border-radius:10px;background:var(--console-surface)}.flow-card ol{display:grid;gap:0;margin:18px 0 0;padding:0;list-style:none}.flow-card li{display:grid;grid-template-columns:28px 1fr;gap:10px;min-height:58px;color:var(--console-text)}.flow-card li span{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;color:var(--console-primary);background:var(--console-primary-soft);font-weight:700}.flow-card li:not(:last-child) div{border-bottom:1px solid var(--console-border);padding-bottom:16px}.row-actions{display:flex;justify-content:center;gap:6px}.build-page code{font-size:12px}@media(max-width:960px){.workspace-grid{grid-template-columns:1fr}.flow-card{display:none}}@media(max-width:700px){.page-intro,.form-grid{display:grid;grid-template-columns:1fr}.target-grid{grid-template-columns:1fr}.build-page :deep(.el-card__body){overflow-x:auto}}
</style>

<style scoped>
.build-details{min-height:120px;display:grid;gap:14px;overflow-wrap:anywhere}
.version-preview{width:100%;min-width:0}.version-evidence{display:grid;gap:3px;margin-top:6px;font-size:12px;line-height:1.5;color:var(--console-muted);overflow-wrap:anywhere}.version-error{color:var(--console-danger)}.version-preview>small{display:block;margin-top:6px;line-height:1.5;color:var(--console-muted)}
.details-note{margin:0;color:var(--console-muted)}
.build-task{border:1px solid var(--console-border);border-radius:8px;padding:14px}
.build-task header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.build-task p{font-size:13px;color:var(--console-muted)}
.build-task ol{padding:0;list-style:none;margin:12px 0}
.build-task li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-top:1px solid var(--console-border)}
.build-task li>span:first-child{min-width:0;flex:1}.build-task li>span:last-child{flex-shrink:0}
.failed-step{color:var(--console-danger);font-weight:600}
@media(prefers-reduced-motion:reduce){.version-preview .is-loading{animation:none}}
</style>
