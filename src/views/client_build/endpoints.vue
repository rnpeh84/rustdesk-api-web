<template>
  <section class="build-settings-page" v-loading="loading">
    <header class="page-intro">
      <div>
        <span class="eyebrow">{{ T('ClientDistribution') }}</span>
        <h1>{{ T('ClientEndpointProfiles') }}</h1>
        <p>{{ T('ClientEndpointProfilesDescription') }}</p>
      </div>
      <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>{{ T('AddEndpointProfile') }}</el-button>
    </header>

    <el-alert type="info" :closable="false" show-icon :title="T('EndpointRevisionGuide')" />

    <div v-if="profiles.length" class="profile-grid">
      <article v-for="profile in profiles" :key="profile.id" class="profile-card">
        <div class="card-top">
          <div><strong>{{ profile.name }}</strong><span>{{ profile.environment }} · r{{ profile.revision }}</span></div>
          <el-tag v-if="profile.is_default" type="success" effect="plain">{{ T('DefaultProfile') }}</el-tag>
        </div>
        <dl>
          <div><dt>ID</dt><dd>{{ profile.id_server }}</dd></div>
          <div><dt>Relay</dt><dd>{{ profile.relay_server }}</dd></div>
          <div><dt>API</dt><dd>{{ profile.api_server }}</dd></div>
          <div><dt>WebSocket</dt><dd>{{ profile.ws_host || T('NoData') }}</dd></div>
        </dl>
        <div class="key-row"><el-icon><Key /></el-icon><span>{{ shortKey(profile.public_key) }}</span></div>
        <el-button plain @click="openEdit(profile)"><el-icon><Edit /></el-icon>{{ T('CreateNewRevision') }}</el-button>
      </article>
    </div>
    <el-empty v-else :description="T('NoEndpointProfiles')"><el-button type="primary" @click="openCreate">{{ T('AddEndpointProfile') }}</el-button></el-empty>

    <el-dialog v-model="dialog" :title="form.profile_key ? T('CreateNewRevision') : T('AddEndpointProfile')" width="min(680px, 94vw)" destroy-on-close>
      <el-form label-position="top" @submit.prevent="save">
        <div class="form-grid">
          <el-form-item :label="T('ProfileKey')"><el-input v-model="form.profile_key" :disabled="editing" placeholder="production" /></el-form-item>
          <el-form-item :label="T('ProfileName')"><el-input v-model="form.name" placeholder="운영 환경" /></el-form-item>
          <el-form-item :label="T('Environment')"><el-select v-model="form.environment"><el-option label="운영" value="production"/><el-option label="테스트" value="staging"/></el-select></el-form-item>
          <el-form-item class="switch-item"><el-switch v-model="form.is_default" :active-text="T('SetDefaultProfile')" /></el-form-item>
          <el-form-item label="ID Server"><el-input v-model="form.id_server" placeholder="rust.example.com:21116" /></el-form-item>
          <el-form-item label="Relay Server"><el-input v-model="form.relay_server" placeholder="rust.example.com:21117" /></el-form-item>
          <el-form-item label="API Server"><el-input v-model="form.api_server" placeholder="https://rust.example.com" /></el-form-item>
          <el-form-item label="WebSocket"><el-input v-model="form.ws_host" placeholder="wss://rust.example.com" /></el-form-item>
        </div>
        <el-form-item :label="T('RustDeskPublicKey')"><el-input v-model="form.public_key" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog=false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" @click="save">{{ T('Save') }}</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { Edit, Key, Plus } from '@element-plus/icons'
import { ElMessage } from 'element-plus'
import { endpointProfiles, saveEndpointProfile } from '@/api/clientRelease'
import { T } from '@/utils/i18n'

const loading = ref(false)
const saving = ref(false)
const dialog = ref(false)
const editing = ref(false)
const profiles = ref([])
const emptyForm = () => ({ profile_key: '', name: '', environment: 'production', id_server: '', relay_server: '', api_server: '', ws_host: '', public_key: '', is_default: false })
const form = reactive(emptyForm())
const load = async () => { loading.value = true; try { profiles.value = (await endpointProfiles()).data?.list || [] } finally { loading.value = false } }
const assignForm = value => Object.assign(form, emptyForm(), value || {})
const openCreate = () => { editing.value = false; assignForm(); dialog.value = true }
const openEdit = profile => { editing.value = true; assignForm(profile); dialog.value = true }
const save = async () => {
  saving.value = true
  try { await saveEndpointProfile({ ...form }); ElMessage.success(T('EndpointProfileSaved')); dialog.value = false; await load() } finally { saving.value = false }
}
const shortKey = value => value?.length > 38 ? `${value.slice(0, 18)}…${value.slice(-12)}` : value
onMounted(load)
</script>

<style scoped lang="scss">
.build-settings-page{display:grid;gap:16px}.page-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:4px 0 2px}.page-intro h1{margin:4px 0 6px;font-size:24px;color:var(--console-text)}.page-intro p{margin:0;color:var(--console-muted)}.eyebrow{color:var(--console-primary);font-size:12px;font-weight:700;letter-spacing:.08em}.profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.profile-card{display:grid;gap:16px;padding:20px;border:1px solid var(--console-border);border-radius:10px;background:var(--console-surface);box-shadow:var(--console-shadow-sm)}.card-top{display:flex;justify-content:space-between;gap:12px}.card-top strong,.card-top span{display:block}.card-top span{margin-top:4px;color:var(--console-muted);font-size:13px}.profile-card dl{display:grid;gap:9px;margin:0}.profile-card dl div{display:grid;grid-template-columns:88px minmax(0,1fr);gap:10px}.profile-card dt{color:var(--console-muted)}.profile-card dd{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.key-row{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:6px;background:var(--console-bg);color:var(--console-muted);font-family:monospace}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.switch-item{display:flex;align-items:flex-end;padding-bottom:4px}@media(max-width:700px){.page-intro{display:grid}.profile-grid,.form-grid{grid-template-columns:1fr}.profile-card dl div{grid-template-columns:72px minmax(0,1fr)}}
</style>
