<template>
  <section class="official-install" :aria-label="T('OfficialInstallTitle')" :aria-busy="loading || preparing">
    <div class="install-heading"><strong>{{ T('OfficialInstallTitle') }}</strong><p>{{ T('OfficialInstallHint') }}</p></div>
    <el-alert v-if="loadError" type="error" :closable="false" :title="T('OfficialInstallLoadError')" />
    <el-button v-if="loadError" @click="loadSettings">{{ T('Retry') }}</el-button>
    <template v-else>
      <el-form label-position="top" :disabled="loading || preparing">
        <el-form-item :label="T('OfficialInstallPlatform')" for="official-install-platform">
          <el-select id="official-install-platform" v-model="form.platform" :aria-label="T('OfficialInstallPlatform')">
            <el-option v-for="value in ['linux','windows','macos']" :key="value" :value="value" :label="value==='linux'?'Linux':value==='windows'?'Windows':'macOS'"/>
          </el-select>
          <p class="install-help">{{ T(form.platform==='windows'?'OfficialInstallWindowsHint':form.platform==='macos'?'OfficialInstallMacHint':'OfficialInstallLinuxHint') }}</p>
        </el-form-item>
        <el-form-item :label="T('OfficialInstallPassword')" for="official-install-password">
          <div class="password-row">
            <el-input id="official-install-password" v-model="form.password" name="official-install-password" type="password" show-password autocomplete="new-password" :maxlength="128" :placeholder="T(savedPassword ? 'OfficialInstallKeepPassword' : 'OfficialInstallPasswordHint')" />
            <el-button @click="generatePassword">{{ T('OfficialInstallGenerate') }}</el-button>
            <el-button v-if="savedPassword" :loading="revealing" @click="showSavedPassword">{{ T('OfficialInstallShowSaved') }}</el-button>
          </div>
          <p class="install-help">{{ T('OfficialInstallPasswordHelp') }}</p>
        </el-form-item>
        <el-collapse v-model="expanded">
          <el-collapse-item :title="T('OfficialInstallAdvanced')" name="advanced">
            <el-form-item :label="T('OfficialInstallMode')" for="official-install-mode">
              <el-select id="official-install-mode" v-model="form.mode">
                <el-option v-for="value in ['auto', 'desktop', 'terminal']" :key="value" :value="value" :label="T(`OfficialInstallMode_${value}`)" />
              </el-select>
            </el-form-item>
            <el-form-item :label="T('OfficialInstallShellUser')" for="official-install-shell-user">
              <el-input id="official-install-shell-user" v-model="form.shell_user" name="official-install-shell-user" :maxlength="form.platform==='windows'?96:32" :placeholder="T('OfficialInstallShellDefault')" autocomplete="off" :spellcheck="false" />
              <p class="install-help">{{ T('OfficialInstallShellHint') }}</p>
            </el-form-item>
            <div class="install-choices">
              <el-checkbox v-model="form.replace_password">{{ T('OfficialInstallReplacePassword') }}</el-checkbox>
              <el-checkbox v-model="form.replace_server">{{ T('OfficialInstallReplaceServer') }}</el-checkbox>
              <el-checkbox v-model="form.switch_official">{{ T('OfficialInstallSwitch') }}</el-checkbox>
            </div>
          </el-collapse-item>
        </el-collapse>
        <p class="install-help">{{ T('OfficialInstallPreserve') }}</p>
        <el-button type="primary" :loading="preparing" :disabled="loading || revealing || !serverReady || !validForm" @click="prepare">{{ T(command ? 'OfficialInstallNewCommand' : 'OfficialInstallPrepare') }}</el-button>
        <p v-if="!serverReady" class="install-help">{{ T('OfficialInstallServerMissing') }}</p>
        <p v-else-if="!validForm" class="install-help" role="status">{{ T('OfficialInstallInvalid') }}</p>
      </el-form>
      <div v-if="command" class="install-result" aria-live="polite">
        <p>{{ T(expired ? 'OfficialInstallExpired' : 'OfficialInstallCommandHint') }}</p>
        <el-input :model-value="expired ? '' : command" type="textarea" :rows="4" readonly :aria-label="T('OfficialInstallCommand')" :spellcheck="false" />
        <div class="result-actions"><el-button :disabled="expired" @click="copyCommand">{{ T('OfficialInstallCopy') }}</el-button><span>{{ expiryLabel }}</span></div>
        <small>{{ T('OfficialInstallTokenHint') }}</small>
        <p>{{ T('OfficialInstallRegistrationHint') }} <router-link :to="{ name: 'MyPeer' }">{{ T('OfficialInstallMyDevices') }}</router-link></p>
      </div>
      <p v-if="actionError" class="install-error" role="alert">{{ actionError }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { officialInstallSettings, officialInstallPassword, prepareOfficialInstall } from '@/api/clientRelease'
import { T } from '@/utils/i18n'
import { newInstallPassword,detectInstallPlatform } from '@/utils/officialInstall'

const props = defineProps({ server: { type: Object, default: () => ({}) } })
const form = reactive({ platform:detectInstallPlatform(), password: '', shell_user: '', mode: 'auto', replace_password: false, replace_server: false, switch_official: false })
const loading = ref(true), loadError = ref(false), preparing = ref(false), revealing = ref(false), savedPassword = ref(false)
const command = ref(''), expiresAt = ref(0), now = ref(Date.now()), actionError = ref(''), expanded = ref([])
let alive = true
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => { alive = false; clearInterval(timer); form.password = ''; command.value = '' })
const expired = computed(() => now.value >= expiresAt.value * 1000)
const expiryLabel = computed(() => expiresAt.value ? `${T('OfficialInstallUntil')} ${new Date(expiresAt.value * 1000).toLocaleTimeString()}` : '')
const validForm = computed(() => (!form.password || (Array.from(form.password).length >= 8 && new TextEncoder().encode(form.password).length <= 128 && !/[\u0000-\u001f\u007f-\u009f]/u.test(form.password))) && (!form.shell_user || (form.platform==='windows'? /^[\p{L}\p{N}_. \\-]{1,96}$/u.test(form.shell_user)&&new TextEncoder().encode(form.shell_user).length<=96 : form.shell_user !== 'root' && /^[a-z_][a-z0-9_.-]{0,31}$/.test(form.shell_user))))
const serverReady = computed(() => {
  try { const url = new URL(props.server.api_server); return !!props.server.id_server && !!props.server.key && url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash }
  catch { return false }
})
const loadSettings = async () => {
  loading.value = true; loadError.value = false
  try {
    const { data } = await officialInstallSettings()
    if (!alive) return
    savedPassword.value = data.has_password
    form.mode = data.mode || 'auto'; form.shell_user = data.shell_user || ''
    form.password = data.has_password ? '' : newInstallPassword()
  } catch { if (alive) loadError.value = true }
  finally { if (alive) loading.value = false }
}
const generatePassword = () => {
  try { form.password = newInstallPassword(); actionError.value = '' }
  catch { actionError.value = T('OfficialInstallGenerateError') }
}
const showSavedPassword = async () => {
  revealing.value = true; actionError.value = ''
  try { const { data } = await officialInstallPassword(); if (alive) form.password = data.password }
  catch { if (alive) actionError.value = T('OfficialInstallLoadError') }
  finally { if (alive) revealing.value = false }
}
const prepare = async () => {
  preparing.value = true; actionError.value = ''; command.value = ''
  try {
    const { data } = await prepareOfficialInstall({ ...form })
    if (!alive) return
    command.value = data.command; expiresAt.value = data.expires_at; savedPassword.value = true
  } catch { if (alive) actionError.value = T('OfficialInstallPrepareError') }
  finally { if (alive) preparing.value = false }
}
const copyCommand = async () => {
  if (expired.value) return
  try { await navigator.clipboard.writeText(command.value); ElMessage.success(T('Copied')) }
  catch { actionError.value = T('OfficialInstallCopyFallback') }
}
// 수정한 설정과 이전 명령이 섞이지 않도록 결과를 즉시 비운다.
watch(form, () => { command.value = ''; actionError.value = '' })
watch(() => JSON.stringify([props.server.id_server, props.server.key, props.server.api_server, props.server.relay_server]), () => { command.value = '' })
onMounted(loadSettings)
</script>

<style scoped>
.official-install{display:grid;gap:14px;margin-top:20px;padding-top:20px;border-top:1px solid var(--console-border);min-width:0}.install-heading strong{font-size:15px;color:var(--console-heading)}.install-heading p,.install-help,.install-result p{font-size:13px;line-height:1.7;color:var(--console-muted);margin:6px 0 12px}.password-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%}.password-row :deep(.el-input){flex:1 1 230px}.password-row :deep(.el-button){margin:0}.install-choices{display:grid;gap:8px}.install-choices :deep(.el-checkbox){white-space:normal;height:auto;margin:0}.install-choices :deep(.el-checkbox__label){white-space:normal;line-height:1.6}.official-install :deep(.el-select){width:100%}.install-help{width:100%;margin:6px 0}.install-result{display:grid;gap:10px;min-width:0}.install-result :deep(textarea){font-family:monospace;font-size:12px;overflow-wrap:anywhere}.result-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.result-actions span,.install-result small{font-size:12px;color:var(--console-muted);line-height:1.7}.install-error{color:var(--el-color-danger);margin:0;font-size:13px;line-height:1.7}@media(max-width:600px){.password-row :deep(.el-input){flex-basis:100%}.official-install :deep(.el-form-item__label){line-height:1.6;height:auto}}
</style>
