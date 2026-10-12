<template>
  <section class="connection-security" v-loading="loading" :aria-label="T('ConnectionSecurity')">
    <header class="security-toolbar">
      <h2>{{ T('ConnectionSecurity') }}</h2>
      <el-button :disabled="saving || loading" :loading="loading" @click="load"><el-icon><Refresh /></el-icon>{{ T('Refresh') }}</el-button>
    </header>
    <el-alert v-if="loadFailed" type="error" :closable="false" show-icon :title="T('ConnectionSecurityLoadFailed')" />
    <template v-if="state">
      <el-alert type="info" :closable="false" show-icon :title="T('ConnectionSecurityReportGuide')" />
      <p class="security-description">{{ T('ApprovedAccountsGuide') }}</p>
      <el-form label-position="top" @submit.prevent="save">
        <div class="security-grid">
          <el-form-item :label="T('RequireClientLogin')">
            <el-switch v-model="form.login_required" :disabled="saving" :aria-label="T('RequireClientLogin')" />
            <small>{{ T('RequireClientLoginImpact') }}</small>
          </el-form-item>
          <el-form-item :label="T('RegisteredDevicesOnly')">
            <el-switch v-model="form.registered_devices_only" :disabled="saving" :aria-label="T('RegisteredDevicesOnly')" />
            <small>{{ T('RegisteredDevicesOnlyImpact') }}</small>
          </el-form-item>
          <el-form-item :label="T('AllowPendingRegistration')">
            <el-switch v-model="form.allow_self_registration" :disabled="saving || !hostRegistrationAllowed" :aria-label="T('AllowPendingRegistration')" />
            <small>{{ T(hostRegistrationAllowed ? 'PendingRegistrationGuide' : 'PendingRegistrationHostDisabled') }}</small>
          </el-form-item>
          <el-form-item :label="T('AllowPendingExternalRegistration')">
            <el-switch v-model="form.allow_external_registration" :disabled="saving" :aria-label="T('AllowPendingExternalRegistration')" />
            <small>{{ T('PendingExternalRegistrationGuide') }}</small>
          </el-form-item>
        </div>
        <div class="security-save">
          <el-tag effect="plain">{{ T('ConnectionSecurityRevision', { param: state.policy.version }) }}</el-tag>
          <el-tag effect="plain" :type="state.self_registration_available ? 'warning' : 'info'">{{ T(state.self_registration_available ? 'RegistrationNeedsApproval' : 'RegistrationClosed') }}</el-tag>
          <el-button type="primary" native-type="submit" :loading="saving" :disabled="loading || loadFailed || !dirty"><el-icon><Check /></el-icon>{{ T('Save') }}</el-button>
        </div>
      </el-form>
      <el-table :data="state.servers" border :aria-label="T('ConnectionSecurityApplication')">
        <el-table-column :label="T('ConnectionSecurityServer')" min-width="160">
          <template #default="{ row }"><span translate="no">{{ row.component }}</span><small v-if="row.node_id" class="server-detail" translate="no">{{ row.node_id }}</small><small v-if="row.build_version" class="server-detail" translate="no">{{ row.build_version }}</small></template>
        </el-table-column>
        <el-table-column :label="T('Status')" min-width="130">
          <template #default="{ row }"><el-tag :type="badge(row)[1]" effect="plain">{{ T(badge(row)[0]) }}</el-tag><small v-if="row.failure_code" class="server-detail">{{ T(connectionSecurityFailure(row.failure_code)) }}</small></template>
        </el-table-column>
        <el-table-column :label="T('ConnectionSecurityAppliedVersion')" min-width="150">
          <template #default="{ row }">{{ row.applied_version ?? T('ConnectionSecurityUnverified') }}</template>
        </el-table-column>
        <el-table-column :label="T('ConnectionSecurityLastChecked')" min-width="160">
          <template #default="{ row }"><time v-if="row.last_checked_at" :datetime="new Date(row.last_checked_at * 1000).toISOString()">{{ new Date(row.last_checked_at * 1000).toLocaleString() }}</time><span v-else>{{ T('ConnectionSecurityUnverified') }}</span></template>
        </el-table-column>
      </el-table>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Check, Refresh } from '@element-plus/icons'
import { ElMessage } from 'element-plus'
import { connectionSecurity, saveConnectionSecurity } from '@/api/config'
import { T } from '@/utils/i18n'
import { connectionSecurityBadge, connectionSecurityFailure } from '@/utils/connectionSecurityState'

const clock = ref(Date.now())
const badge = row => connectionSecurityBadge(row, clock.value)
let timer
let refreshTimer
let alive = true
const loading = ref(false)
const saving = ref(false)
const loadFailed = ref(false)
const state = ref(null)
const editable = value => ({ version: value.version, login_required: value.login_required,
  registered_devices_only: value.registered_devices_only, allow_self_registration: value.allow_self_registration,
  allow_external_registration: value.allow_external_registration })
const form = reactive({ version: 0, login_required: false, registered_devices_only: false,
  allow_self_registration: false, allow_external_registration: false })
const dirty = computed(() => state.value && JSON.stringify(form) !== JSON.stringify(editable(state.value.policy)))
const hostRegistrationAllowed = computed(() => state.value?.public_account_actions_enabled && state.value?.registration_service_enabled)
const apply = data => { state.value = data; Object.assign(form, editable(data.policy)) }
const load = async () => {
  if (loading.value || saving.value) return
  loading.value = true
  try { const data = (await connectionSecurity()).data; if (alive) { apply(data); loadFailed.value = false } }
  catch { loadFailed.value = true }
  finally { loading.value = false }
}
const save = async () => {
  if (saving.value || loading.value || loadFailed.value || !dirty.value) return
  if (form.registered_devices_only && !form.login_required) {
    ElMessage.warning(T('ConnectionSecurityLoginRequired'))
    return
  }
  saving.value = true
  try { apply((await saveConnectionSecurity({ ...form })).data); ElMessage.success(T('ConnectionSecuritySaved')) }
  catch (error) { if (error?.code === 1209) { saving.value = false; await load() } }
  finally { saving.value = false }
}
onMounted(() => { load(); timer = setInterval(() => { clock.value = Date.now() }, 1000); refreshTimer = setInterval(() => { if (!document.hidden && !dirty.value && !loading.value && !saving.value) load() }, 20000) })
onUnmounted(() => { alive = false; clearInterval(timer); clearInterval(refreshTimer) })
</script>

<style scoped lang="scss">
.connection-security{display:grid;gap:12px;padding:16px;border:1px solid var(--console-border);border-radius:6px;background:var(--console-surface)}
.security-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px}.security-toolbar h2{margin:0;font-size:16px;color:var(--console-heading)}
.server-detail{display:block;overflow-wrap:anywhere;color:var(--console-muted);line-height:1.5}.connection-security :deep(.el-table){font-variant-numeric:tabular-nums}
.security-description{margin:0;color:var(--console-muted);line-height:1.6}.security-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 24px}.security-grid small{display:block;width:100%;color:var(--console-muted);line-height:1.6}
.security-save{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:0 0 12px}.security-save .el-button{margin-left:auto}
@media(max-width:700px){.security-grid{grid-template-columns:1fr}.connection-security{padding:12px}.security-save .el-button{margin-left:0}}
</style>
