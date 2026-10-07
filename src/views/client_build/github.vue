<template>
  <section class="source-page" v-loading="loading">
    <header class="page-intro">
      <div><p>{{ T('GitHubConnectIntro') }}</p></div>
      <el-button type="primary" @click="openConnection()"><el-icon><Plus /></el-icon>{{ T('GitHubConnectAdd') }}</el-button>
    </header>
    <el-alert type="info" :closable="false" show-icon :title="T('GitHubSecretNotice')" />

    <section class="stage">
      <div class="stage-heading"><span>1</span><div><h2>{{ T('GitHubAccountTitle') }}</h2><p>{{ T('GitHubAccountIntro') }}</p></div></div>
      <div class="card-list">
        <el-card v-for="connection in connections" :key="connection.id" shadow="never">
          <div class="connection-main">
            <div class="source-icon"><el-icon><Link /></el-icon></div>
            <div class="connection-copy"><div><strong>{{ connection.name }}</strong><el-tag :type="statusType(connection.status)" effect="plain">{{ statusLabel(connection.status) }}</el-tag></div><p>{{ connection.account_login || T('GitHubAccountPending') }} · {{ connection.auth_type === 'pat' ? T('GitHubPAT') : `App ${connection.app_id} · Installation ${connection.installation_id}` }}</p><small>{{ connection.status_message }}</small></div>
<div class="connection-actions"><el-button :loading="testingKey===`connection-${connection.id}`" @click="testConnection(connection)"><el-icon><CircleCheck /></el-icon>{{ T('GitHubCheck') }}</el-button><el-button plain @click="openConnection(connection)"><el-icon><Edit /></el-icon>{{ T('Edit') }}</el-button><el-button v-if="connection.status==='ready'" type="primary" plain @click="openSource(connection)"><el-icon><Plus /></el-icon>{{ T('GitHubSourceAdd') }}</el-button><InlineConfirmButton circle :disabled="!!deletingKey || !!testingKey" :loading="deletingKey===`connection-${connection.id}`" :label="T('Delete')" :confirm-key="`connection-${connection.id}`" :action="() => removeSetting(`connection-${connection.id}`, connection.name, () => deleteGithubConnection(connection.id), T('DeleteConnectionHint'))"/></div>
          </div>
        </el-card>
        <el-empty v-if="!connections.length" :description="T('GitHubEmptyConnections')" />
      </div>
    </section>

    <section class="stage">
      <div class="stage-heading"><span>2</span><div><h2>{{ T('GitHubSourcesTitle') }}</h2><p>{{ T('GitHubSourcesIntro') }}</p></div></div>
      <el-table :data="sources" stripe :empty-text="T('GitHubEmptySources')">
        <el-table-column prop="name" :label="T('GitHubName')" min-width="150" fixed="left" />
        <el-table-column :label="T('GitHubRepository')" min-width="210"><template #default="{row}"><strong>{{ row.owner }}/{{ row.repository }}</strong><small class="cell-note">{{ row.branch }}</small></template></el-table-column>
        <el-table-column prop="workflow_file" :label="T('GitHubWorkflow')" min-width="180" show-overflow-tooltip />
        <el-table-column :label="T('GitHubRunnerLabels')" min-width="220"><template #default="{row}"><code>{{ row.required_runner_labels || '-' }}</code></template></el-table-column>
        <el-table-column :label="T('GitHubStatus')" width="120"><template #default="{row}"><el-tag :type="statusType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column :label="T('GitHubActions')" width="170" fixed="right" align="center"><template #default="{row}"><div class="row-actions"><el-tooltip :content="T('GitHubSourceCheck')"><el-button circle :aria-label="T('GitHubSourceCheck')" :loading="testingKey===`source-${row.id}`" @click="testSource(row)"><el-icon><CircleCheck /></el-icon></el-button></el-tooltip><el-tooltip :content="T('Edit')"><el-button circle :aria-label="T('Edit')" @click="editSource(row)"><el-icon><Edit /></el-icon></el-button></el-tooltip><el-tooltip :content="T('Delete')"><InlineConfirmButton circle :disabled="!!deletingKey || !!testingKey" :loading="deletingKey===`source-${row.id}`" :label="T('Delete')" :confirm-key="`source-${row.id}`" :action="() => removeSetting(`source-${row.id}`, row.name, () => deleteGithubBuildSource(row.id), T('DeleteSourceHint'))"/></el-tooltip></div></template></el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="connectionDialog" :title="connectionForm.id ? T('GitHubConnectEdit') : T('GitHubConnectAdd')" width="min(620px, 94vw)" destroy-on-close @closed="clearConnectionSecrets">
      <el-form label-position="top">
        <el-form-item :label="T('GitHubConnectName')"><el-input v-model="connectionForm.name" name="github_connection_name" autocomplete="off" :placeholder="T('GitHubConnectNameHint')" maxlength="128" /></el-form-item>
        <el-form-item :label="T('GitHubAuthType')"><el-radio-group v-model="connectionForm.auth_type" @change="clearConnectionSecrets"><el-radio-button value="pat">{{ T('GitHubPAT') }}</el-radio-button><el-radio-button value="github_app">{{ T('GitHubApp') }}</el-radio-button></el-radio-group></el-form-item>
        <template v-if="connectionForm.auth_type === 'pat'">
          <el-form-item :label="T('GitHubToken')"><el-input v-model="connectionForm.token" name="github_api_token" :spellcheck="false" type="password" show-password autocomplete="new-password" :placeholder="connectionForm.id ? T('GitHubTokenKeep') : T('GitHubTokenHint')" /></el-form-item>
          <p><el-link href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens" target="_blank" rel="noopener noreferrer" type="primary">{{ T('GitHubTokenGuide') }}</el-link></p>
        </template>
        <template v-else>
          <div class="form-grid"><el-form-item label="App ID"><el-input-number v-model="connectionForm.app_id" :min="1" controls-position="right" /></el-form-item><el-form-item label="Installation ID"><el-input-number v-model="connectionForm.installation_id" :min="1" controls-position="right" /></el-form-item></div>
          <el-form-item :label="connectionForm.id ? T('GitHubKeyReplace') : T('GitHubKey')"><div class="key-input"><el-upload action="#" accept=".pem,.key" :auto-upload="false" :limit="1" :on-change="readPrivateKey"><el-button><el-icon><Upload /></el-icon>{{ T('SelectPrivateKeyFile') }}</el-button></el-upload><el-input v-model="connectionForm.private_key" name="github_private_key" :spellcheck="false" type="textarea" :rows="6" autocomplete="off" :placeholder="connectionForm.id ? T('GitHubKeyKeep') : '-----BEGIN RSA PRIVATE KEY-----'" /></div></el-form-item>
        </template>
        <section class="permission-guide" :aria-label="T('GitHubPermissionsTitle')">
          <h3>{{ T('GitHubPermissionsTitle') }}</h3>
          <p>{{ T('GitHubPermissionSelection') }}</p>
          <dl>
            <div><dt>{{ T('GitHubRepositoryPermissions') }}</dt><dd>{{ T('GitHubPermissionHint') }}</dd></div>
            <div><dt>{{ T('GitHubOrganizationPermissions') }}</dt><dd>{{ T('GitHubOrgPermissionHint') }}</dd></div>
          </dl>
          <small>{{ T('GitHubPermissionApproval') }}</small>
        </section>
      </el-form>
      <template #footer><el-button @click="connectionDialog=false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" @click="saveConnection">{{ T('Save') }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="sourceDialog" :title="sourceForm.id ? T('GitHubSourceEdit') : T('GitHubSourceAdd')" width="min(720px, 94vw)" destroy-on-close>
<el-form label-position="top" v-loading="optionsLoading"><div class="form-grid"><el-form-item :label="T('GitHubAccountTitle')"><el-select v-model="sourceForm.connection_id" disabled><el-option v-for="item in connections" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item><el-form-item :label="T('GitHubSourceName')"><el-input v-model="sourceForm.name" :placeholder="T('GitHubSourceNameHint')" /></el-form-item><el-form-item :label="T('GitHubRepository')"><el-select v-model="sourceForm.repository_full_name" filterable @change="selectRepository"><el-option v-for="item in repositories" :key="item.id" :label="item.full_name" :value="item.full_name" /></el-select></el-form-item><el-form-item :label="T('GitHubBranch')"><el-select v-model="sourceForm.branch" filterable><el-option v-for="item in branches" :key="item.name" :label="item.name" :value="item.name" /></el-select></el-form-item><el-form-item :label="T('GitHubWorkflow')"><el-select v-model="sourceForm.workflow_file"><el-option v-for="item in workflows" :key="item.id" :label="`${item.name} · ${item.path}`" :value="item.path" /></el-select></el-form-item><el-form-item :label="T('GitHubRunnerChoose')"><el-select v-model="selectedRunnerIds" multiple filterable @change="applyRunnerLabels" :placeholder="T('GitHubRunnerAutomatic')"><el-option v-for="item in runners" :key="item.id" :value="item.id" :label="runnerLabel(item)" :disabled="item.status !== 'online' || !runnerAllowed(item)" /></el-select></el-form-item><el-form-item :label="T('GitHubRunnerLabels')"><el-select v-model="sourceForm.runner_labels" multiple filterable allow-create><el-option v-for="label in runnerLabels" :key="label" :label="label" :value="label" /></el-select></el-form-item></div><p class="runner-note">{{ T('GitHubRunnerHint') }}</p><el-alert v-if="sourceForm.repository && (runnerError || !runners.length)" type="warning" :closable="false" show-icon :title="runnerError || T('GitHubRunnerEmpty')" /></el-form>
      <template #footer><el-button @click="sourceDialog=false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" :disabled="optionsLoading || !branches.length || !workflows.length || !!runnerError" @click="saveSource">{{ T('Save') }}</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
import { computed, onMounted, reactive, ref } from 'vue'
import { CircleCheck, Delete, Edit, Link, Plus, Upload } from '@element-plus/icons'
import { ElMessage } from 'element-plus'
import { deleteGithubBuildSource, deleteGithubConnection, githubBranches, githubBuildSources, githubConnections, githubRepositories, githubRunners, githubWorkflows, saveGithubBuildSource, saveGithubConnection, testGithubBuildSource, testGithubConnection } from '@/api/github'
import { T } from '@/utils/i18n'
import { useSettingDeletion } from '@/utils/settingDeletion'

const connections = ref([]), sources = ref([]), repositories = ref([]), branches = ref([]), workflows = ref([]), runners = ref([])
const loading = ref(false), optionsLoading = ref(false), saving = ref(false), testingKey = ref(''), connectionDialog = ref(false), sourceDialog = ref(false)
const blankConnection = () => ({ id: 0, name: '', auth_type: 'pat', token: '', app_id: 1, installation_id: 1, private_key: '' })
const blankSource = () => ({ id: 0, connection_id: null, name: '', repository_id: 0, repository_full_name: '', owner: '', repository: '', branch: '', workflow_id: 0, workflow_file: '', runner_labels: ['self-hosted'], is_enabled: true })
const connectionForm = reactive(blankConnection()), sourceForm = reactive(blankSource())
const selectedRunnerIds = ref([]), runnerError = ref('')
const runnerAllowed = runner => !runner.restricted_to_workflows || (runner.selected_workflows || []).includes(`${sourceForm.owner}/${sourceForm.repository}/.github/workflows/${sourceForm.workflow_file}@refs/heads/${sourceForm.branch}`)
const runnerLabel = runner => `${runner.name} · ${runner.labels.filter(label => ['macos', 'windows', 'linux', 'x64', 'arm64'].includes(label)).join(' / ')} · ${runner.status === 'online' ? (runner.busy ? T('GitHubRunnerBusy') : T('GitHubRunnerIdle')) : T('GitHubRunnerOffline')}${runner.group ? ' · ' + runner.group : ''}${!runnerAllowed(runner) ? ' · ' + T('GitHubRunnerRestricted') : ''}`
const applyRunnerLabels = ids => {
  const selected = runners.value.filter(runner => ids.includes(runner.id))
  sourceForm.runner_labels = selected.length ? selected[0].labels.filter(label => selected.every(runner => runner.labels.includes(label))) : ['self-hosted']
}
const runnerLabels = computed(() => [...new Set(runners.value.flatMap(item => item.labels || []))].sort())
const load = async () => { loading.value = true; try { const [c, s] = await Promise.all([githubConnections(), githubBuildSources()]); connections.value = c.data?.list || []; sources.value = s.data?.list || [] } finally { loading.value = false } }
const { deletingKey, removeSetting } = useSettingDeletion(load)
const openConnection = value => { Object.assign(connectionForm, blankConnection(), value || {}, { auth_type: value?.auth_type || (value ? 'github_app' : 'pat'), private_key: '', token: '' }); connectionDialog.value = true }
const clearConnectionSecrets = () => { connectionForm.token = ''; connectionForm.private_key = '' }
const readPrivateKey = async file => { connectionForm.private_key = await file.raw.text() }
const saveConnection = async () => { if (!connectionForm.name.trim() || (!connectionForm.id && !(connectionForm.auth_type === 'pat' ? connectionForm.token : connectionForm.private_key))) { ElMessage.warning(T('GitHubRequired')); return } saving.value = true; try { await saveGithubConnection({ ...connectionForm }); clearConnectionSecrets(); connectionDialog.value = false; ElMessage.success(T('GitHubSaved')); await load() } finally { clearConnectionSecrets(); saving.value = false } }
const testConnection = async value => { testingKey.value = `connection-${value.id}`; try { await testGithubConnection(value.id); ElMessage.success(T('GitHubVerified')) } finally { testingKey.value = ''; await load() } }
const openSource = async connection => { Object.assign(sourceForm, blankSource(), { connection_id: connection.id }); selectedRunnerIds.value = []; runnerError.value = ''; sourceDialog.value = true; await loadRepositories() }
const editSource = async value => { Object.assign(sourceForm, blankSource(), value, { repository_full_name: `${value.owner}/${value.repository}`, runner_labels: (value.required_runner_labels || '').split(',').filter(Boolean) }); selectedRunnerIds.value = []; runnerError.value = ''; sourceDialog.value = true; await loadRepositories(); await loadRepositoryOptions() }
const loadRepositories = async () => { optionsLoading.value = true; try { repositories.value = (await githubRepositories(sourceForm.connection_id)).data?.list || [] } finally { optionsLoading.value = false } }
const selectRepository = async () => { const selected = repositories.value.find(item => item.full_name === sourceForm.repository_full_name); if (!selected) return; Object.assign(sourceForm, { repository_id: selected.id, owner: selected.owner, repository: selected.name, branch: selected.default_branch || '', workflow_id: 0, workflow_file: '', runner_labels: ['self-hosted'] }); selectedRunnerIds.value = []; await loadRepositoryOptions() }
const loadRepositoryOptions = async () => { branches.value = []; workflows.value = []; runners.value = []; runnerError.value = ''; if (!sourceForm.owner || !sourceForm.repository) return; optionsLoading.value = true; const params = { owner: sourceForm.owner, repository: sourceForm.repository }; try { const [b, w, r] = await Promise.all([githubBranches(sourceForm.connection_id, params), githubWorkflows(sourceForm.connection_id, params), githubRunners(sourceForm.connection_id, params).catch(() => { runnerError.value = T('GitHubRunnerPermissionError'); return { data: { list: [] } } })]); branches.value = b.data?.list || []; workflows.value = w.data?.list || []; runners.value = r.data?.list || []; if (sourceForm.id && sourceForm.runner_labels.some(label => label !== 'self-hosted')) selectedRunnerIds.value = runners.value.filter(runner => sourceForm.runner_labels.every(label => runner.labels.includes(label))).map(runner => runner.id); if (!sourceForm.branch) sourceForm.branch = branches.value[0]?.name || ''; if (!sourceForm.workflow_file) sourceForm.workflow_file = workflows.value[0]?.path || '' } finally { optionsLoading.value = false } }
const saveSource = async () => { if (!sourceForm.owner || !sourceForm.branch || !sourceForm.workflow_file) { ElMessage.warning(T('GitHubSourceRequired')); return } if (selectedRunnerIds.value.some(id => !runners.value.some(runner => runner.id === id && runner.status === 'online' && runnerAllowed(runner)))) { ElMessage.warning(T('GitHubRunnerRestricted')); return } const workflow = workflows.value.find(item => item.path === sourceForm.workflow_file); saving.value = true; try { await saveGithubBuildSource({ ...sourceForm, workflow_id: workflow?.id || sourceForm.workflow_id, required_runner_labels: sourceForm.runner_labels.join(',') }); sourceDialog.value = false; ElMessage.success(T('GitHubSourceSaved')); await load() } finally { saving.value = false } }
const testSource = async value => { testingKey.value = `source-${value.id}`; try { await testGithubBuildSource(value.id); ElMessage.success(T('GitHubSourceReady')) } finally { testingKey.value = ''; await load() } }
const statusType = value => value === 'ready' ? 'success' : value === 'failed' ? 'danger' : 'warning'
const statusLabel = value => value === 'ready' ? T('GitHubReady') : value === 'failed' ? T('GitHubCheckNeeded') : T('GitHubUnchecked')
onMounted(load)
</script>

<style scoped lang="scss">
.connection-actions{flex-wrap:wrap;justify-content:flex-end}.connection-actions :deep(.el-button),.row-actions :deep(.el-button){margin-left:0}
.permission-guide{padding:14px 16px;background:var(--console-neutral-soft);border:1px solid var(--console-border);border-radius:6px}.permission-guide h3{margin:0;font-size:14px;color:var(--console-heading)}.permission-guide p{margin:6px 0 10px;line-height:1.6}.permission-guide dl{display:grid;gap:9px;margin:0 0 10px}.permission-guide dl>div{display:grid;grid-template-columns:90px minmax(0,1fr);gap:10px}.permission-guide dt{font-weight:600}.permission-guide dd{margin:0;line-height:1.6;overflow-wrap:anywhere}.permission-guide small{color:var(--console-muted);line-height:1.6}@media(max-width:480px){.permission-guide dl>div{grid-template-columns:1fr;gap:2px}}
.runner-note{margin:8px 0;color:var(--console-muted);font-size:12px;line-height:1.6}
.source-page{display:grid;gap:18px}.page-intro{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:4px 0}.stage-heading h2{margin:0;color:var(--console-heading)}.page-intro p{margin:0;color:var(--console-muted)}.stage-heading p{margin:5px 0 0;color:var(--console-muted)}.stage{display:grid;gap:12px}.stage-heading{display:flex;align-items:flex-start;gap:11px}.stage-heading>span{display:grid;place-items:center;width:28px;height:28px;color:var(--console-primary);background:var(--console-primary-soft);border-radius:50%;font-weight:700}.stage-heading h2{font-size:16px}.stage-heading p{font-size:13px}.card-list{display:grid;gap:10px}.connection-main{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:14px}.source-icon{display:grid;place-items:center;width:44px;height:44px;color:var(--console-primary);background:var(--console-primary-soft);border-radius:8px;font-size:21px}.connection-copy>div{display:flex;align-items:center;gap:9px}.connection-copy p,.connection-copy small{display:block;margin:4px 0 0;color:var(--console-muted)}.connection-actions,.row-actions{display:flex;gap:7px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.form-grid :deep(.el-select),.form-grid :deep(.el-input-number){width:100%}.key-input{display:grid;gap:10px;width:100%}.cell-note{display:block;margin-top:3px;color:var(--console-muted)}code{font-size:12px}@media(max-width:800px){.page-intro,.connection-main,.form-grid{display:grid;grid-template-columns:1fr}.connection-actions{flex-wrap:wrap}}
</style>
