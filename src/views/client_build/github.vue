<template>
  <section class="source-page" v-loading="loading">
    <header class="page-intro">
      <div><h1>{{ T('ClientSourceConnection') }}</h1><p>{{ T('ClientSourceConnectionDescription') }}</p></div>
      <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>{{ T('AddGitHubConnection') }}</el-button>
    </header>
    <el-alert type="warning" :closable="false" show-icon :title="T('GitHubPrivateKeyStorageGuide')" />

    <el-card v-for="connection in connections" :key="connection.id" shadow="never" class="connection-card">
      <div class="connection-main">
        <div class="source-icon"><el-icon><Link /></el-icon></div>
        <div class="connection-copy"><div><strong>{{ connection.name }}</strong><el-tag :type="statusType(connection.status)" effect="plain">{{ statusLabel(connection.status) }}</el-tag></div><p>{{ connection.owner }}/{{ connection.repository }} · {{ connection.default_branch }} · {{ connection.workflow_file }}</p><small>{{ connection.status_message }}</small></div>
        <div class="connection-actions"><el-button :loading="testingId===connection.id" @click="testConnection(connection)"><el-icon><CircleCheck /></el-icon>{{ T('ConnectionTest') }}</el-button><el-button plain @click="openEdit(connection)"><el-icon><Edit /></el-icon>{{ T('Edit') }}</el-button></div>
      </div>
      <div class="connection-meta"><span>App ID <strong>{{ connection.app_id }}</strong></span><span>Installation ID <strong>{{ connection.installation_id }}</strong></span><span>{{ T('KeyFingerprint') }} <code>{{ connection.private_key_fingerprint }}</code></span><span>{{ T('LastCheckedAt') }} <strong>{{ formatTime(connection.last_checked_at) }}</strong></span></div>
    </el-card>
    <el-empty v-if="!connections.length" :description="T('NoGitHubConnections')"><el-button type="primary" @click="openCreate">{{ T('AddGitHubConnection') }}</el-button></el-empty>

    <el-dialog v-model="dialog" :title="editing ? T('EditGitHubConnection') : T('AddGitHubConnection')" width="min(720px, 94vw)" destroy-on-close>
      <el-form label-position="top">
        <div class="form-grid">
          <el-form-item :label="T('ConnectionName')"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="App ID"><el-input-number v-model="form.app_id" :min="1" controls-position="right" /></el-form-item>
          <el-form-item label="Installation ID"><el-input-number v-model="form.installation_id" :min="1" controls-position="right" /></el-form-item>
          <el-form-item :label="T('RepositoryOwner')"><el-input v-model="form.owner" placeholder="company" /></el-form-item>
          <el-form-item :label="T('Repository')"><el-input v-model="form.repository" placeholder="rustdesk" /></el-form-item>
          <el-form-item :label="T('DefaultBranch')"><el-input v-model="form.default_branch" placeholder="master" /></el-form-item>
          <el-form-item :label="T('WorkflowFile')"><el-input v-model="form.workflow_file" placeholder="build-client.yml" /></el-form-item>
          <el-form-item :label="T('RequiredRunnerLabels')"><el-input v-model="form.required_runner_labels" placeholder="self-hosted,macos,arm64" /></el-form-item>
        </div>
        <el-form-item :label="editing ? T('ReplaceGitHubPrivateKey') : T('GitHubPrivateKey')">
          <div class="key-input">
            <el-upload action="#" accept=".pem,.key" :auto-upload="false" :limit="1" :show-file-list="true" :on-change="readPrivateKey"><el-button><el-icon><Upload /></el-icon>{{ T('SelectPrivateKeyFile') }}</el-button></el-upload>
            <el-input v-model="form.private_key" type="textarea" :rows="7" autocomplete="off" :placeholder="editing ? T('KeepExistingPrivateKeyGuide') : '-----BEGIN RSA PRIVATE KEY-----'" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog=false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" @click="save">{{ T('Save') }}</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { CircleCheck, Edit, Link, Plus, Upload } from '@element-plus/icons'
import { ElMessage } from 'element-plus'
import { githubConnections, saveGithubConnection, testGithubConnection } from '@/api/clientRelease'
import { T } from '@/utils/i18n'

const connections = ref([]), loading = ref(false), dialog = ref(false), editing = ref(false), saving = ref(false), testingId = ref(0)
const blank = () => ({ id: 0, name: '', app_id: 1, installation_id: 1, owner: '', repository: '', default_branch: 'master', workflow_file: 'build-client.yml', required_runner_labels: 'self-hosted', private_key: '' })
const form = reactive(blank())
const load = async () => { loading.value = true; try { connections.value = (await githubConnections()).data?.list || [] } finally { loading.value = false } }
const openCreate = () => { editing.value = false; Object.assign(form, blank()); dialog.value = true }
const openEdit = value => { editing.value = true; Object.assign(form, blank(), value, { private_key: '' }); dialog.value = true }
const readPrivateKey = async file => { form.private_key = await file.raw.text() }
const save = async () => { saving.value = true; try { await saveGithubConnection({ ...form }); ElMessage.success(T('GitHubConnectionSaved')); dialog.value = false; await load() } finally { form.private_key = ''; saving.value = false } }
const testConnection = async connection => { testingId.value = connection.id; try { await testGithubConnection(connection.id); ElMessage.success(T('GitHubConnectionReady')); await load() } finally { testingId.value = 0 } }
const statusType = value => value === 'ready' ? 'success' : value === 'failed' ? 'danger' : 'warning'
const statusLabel = value => T(value === 'ready' ? 'ConnectionReady' : value === 'failed' ? 'ConnectionFailed' : 'ConnectionUnchecked')
const formatTime = value => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value * 1000)) : T('NeverChecked')
onMounted(load)
</script>

<style scoped lang="scss">
.source-page{display:grid;gap:16px}.page-intro{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:4px 0 2px}.page-intro h1{margin:0 0 6px;font-size:24px}.page-intro p{margin:0;color:var(--console-muted)}.connection-main{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:14px}.source-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:9px;color:var(--console-primary);background:var(--console-primary-soft);font-size:22px}.connection-copy>div{display:flex;align-items:center;gap:10px}.connection-copy p,.connection-copy small{display:block;margin:5px 0 0;color:var(--console-muted)}.connection-actions{display:flex;gap:8px}.connection-meta{display:flex;flex-wrap:wrap;gap:10px 24px;margin-top:16px;padding-top:14px;border-top:1px solid var(--console-border);color:var(--console-muted);font-size:13px}.connection-meta strong{color:var(--console-text);font-weight:600}.connection-meta code{color:var(--console-text)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.form-grid :deep(.el-input-number){width:100%}.key-input{display:grid;gap:10px;width:100%}@media(max-width:760px){.page-intro,.connection-main{display:grid;grid-template-columns:1fr}.connection-actions{flex-wrap:wrap}.form-grid{grid-template-columns:1fr}}
</style>
