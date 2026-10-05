<template>
  <section class="official-install" :aria-label="T('OfficialInstallTitle')" :aria-busy="loading || preparing">
    <div class="install-heading"><strong>{{ T('OfficialInstallTitle') }}</strong><p>{{ T('OfficialInstallHint') }}</p></div>
    <el-alert v-if="loadError" type="error" :closable="false" :title="T('OfficialInstallLoadError')" />
    <el-button v-if="loadError" @click="loadSettings">{{ T('Retry') }}</el-button>
    <template v-else>
      <el-form label-position="top" :disabled="loading || preparing">
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
              <el-input id="official-install-shell-user" v-model="form.shell_user" name="official-install-shell-user" :maxlength="96" :placeholder="T('OfficialInstallShellDefault')" autocomplete="off" :spellcheck="false" />
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
      </el-form>
      <div class="install-platforms">
        <fieldset v-for="platform in platforms" :key="platform.id" class="install-platform" :aria-label="platform.label">
          <legend><PlatformIcons :name="platform.icon" aria-hidden="true" /><span translate="no">{{ platform.label }}</span></legend>
          <div v-for="arch in platform.architectures" :key="arch.id" class="install-architecture">
            <div class="architecture-label" translate="no"><strong>{{ arch.id }}</strong><small v-if="arch.detail">{{ arch.detail }}</small></div>
            <button type="button" class="install-copy-icon" :class="{ 'is-copied': copied && commandTarget?.key === targetKey(platform, arch) && !expired }"
              :aria-label="copyLabel(platform, arch)" :title="copyLabel(platform, arch)"
              :disabled="loading || preparing || revealing || !serverReady || !validForPlatform(platform.id)"
              @click="prepareAndCopy(platform, arch)">
              <el-icon aria-hidden="true"><Loading v-if="preparing && busyTarget === targetKey(platform, arch)" class="is-loading" /><Check v-else-if="copied && commandTarget?.key === targetKey(platform, arch) && !expired" /><DocumentCopy v-else /></el-icon>
            </button>
          </div>
        </fieldset>
      </div>
      <p class="install-help">{{ T('OfficialInstallArchitectureHint') }}</p>
      <p v-if="!serverReady" class="install-help">{{ T('OfficialInstallServerMissing') }}</p>
      <p v-else-if="platforms.some(platform => !validForPlatform(platform.id))" class="install-help" role="status">{{ T('OfficialInstallInvalid') }}</p>
      <p class="install-feedback" role="status" aria-live="polite">{{ preparing ? T('OfficialInstallCopying', { target: selectedTarget?.label }) : copied && !expired ? T('OfficialInstallCopiedTarget', { target: commandTarget?.label }) : '' }}</p>
      <div v-if="command" class="install-result">
        <p>{{ T(expired ? 'OfficialInstallExpired' : 'OfficialInstallCommandHint') }}</p>
        <p v-if="commandTarget">{{ T(commandTarget.hint) }}</p>
        <el-input :model-value="expired ? '' : command" type="textarea" :rows="4" readonly :aria-label="T('OfficialInstallCommand')" :spellcheck="false" />
        <span class="install-expiry">{{ expiryLabel }}</span>
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
import { Check, DocumentCopy, Loading } from '@element-plus/icons-vue'
import PlatformIcons from '@/components/icons/platform.vue'
import { officialInstallSettings, officialInstallPassword, prepareOfficialInstall } from '@/api/clientRelease'
import { T } from '@/utils/i18n'
import { newInstallPassword, beginInstallCommandCopy } from '@/utils/officialInstall'

const props = defineProps({ server: { type: Object, default: () => ({}) } })
const form = reactive({ password: '', shell_user: '', mode: 'auto', replace_password: false, replace_server: false, switch_official: false })
const platforms = [
  { id: 'linux', label: 'Linux', icon: 'linux', hint: 'OfficialInstallLinuxHint', architectures: [{ id: 'x64', detail: 'Intel / AMD' }, { id: 'ARM64' }] },
  { id: 'windows', label: 'Windows', icon: 'windows', hint: 'OfficialInstallWindowsHint', architectures: [{ id: 'x64', detail: 'Intel / AMD' }, { id: 'ARM64' }] },
  { id: 'macos', label: 'macOS', icon: 'mac', hint: 'OfficialInstallMacHint', architectures: [{ id: 'x64', detail: 'Intel' }, { id: 'ARM64', detail: 'Apple Silicon' }] },
]
const targetKey = (platform, arch) => `${platform.id}-${arch.id}`
const copyLabel = (platform, arch) => `${platform.label} ${arch.id} ${T('OfficialInstallCopy')}`
const loading = ref(true), loadError = ref(false), preparing = ref(false), revealing = ref(false), savedPassword = ref(false)
const command = ref(''), expiresAt = ref(0), now = ref(Date.now()), actionError = ref(''), expanded = ref([])
const selectedTarget = ref(null), commandTarget = ref(null), busyTarget = ref(''), copied = ref(false), copyFailed = ref(false)
let alive = true
let revision = 0
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => { alive = false; clearInterval(timer); form.password = ''; command.value = '' })
const expired = computed(() => now.value >= expiresAt.value * 1000)
const expiryLabel = computed(() => expiresAt.value ? `${T('OfficialInstallUntil')} ${new Date(expiresAt.value * 1000).toLocaleTimeString()}` : '')
const validForPlatform = platform => (!form.password || (Array.from(form.password).length >= 8 && new TextEncoder().encode(form.password).length <= 128 && !/[\u0000-\u001f\u007f-\u009f]/u.test(form.password))) && (!form.shell_user || (platform === 'windows' ? /^[\p{L}\p{N}_. \\-]{1,96}$/u.test(form.shell_user) && new TextEncoder().encode(form.shell_user).length <= 96 : form.shell_user !== 'root' && /^[a-z_][a-z0-9_.-]{0,31}$/.test(form.shell_user)))
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
const clearResult = () => {
  revision++; command.value = ''; commandTarget.value = null; copied.value = false; copyFailed.value = false; actionError.value = ''
}
const prepareAndCopy = async (platform, arch) => {
  if (loading.value || preparing.value || revealing.value || !serverReady.value || !validForPlatform(platform.id)) return
  const target = { key: targetKey(platform, arch), label: `${platform.label} ${arch.id}`, hint: platform.hint }
  selectedTarget.value = target
  // 복사 실패 후 같은 아이콘으로 재시도할 때는 아직 유효한 명령을 폐기하지 않는다.
  const retryCopy = copyFailed.value && commandTarget.value?.key === target.key && !expired.value && command.value
  if (!retryCopy) clearResult()
  const requestRevision = revision
  preparing.value = true; busyTarget.value = target.key; actionError.value = ''; copied.value = false
  const getCommand = async () => {
    if (!retryCopy) {
      const { data } = await prepareOfficialInstall({ ...form, platform: platform.id })
      if (!alive || revision !== requestRevision) return null
      command.value = data.command; expiresAt.value = data.expires_at; commandTarget.value = target; savedPassword.value = true
    }
    now.value = Date.now()
    return expired.value ? null : command.value
  }
  const commandPromise = getCommand()
  const copyResult = beginInstallCommandCopy(commandPromise)
  try {
    const value = await commandPromise
    if (!value || !alive || revision !== requestRevision) return
    const success = await copyResult
    if (!alive || revision !== requestRevision) return
    if (success) {
      copied.value = true; copyFailed.value = false
      ElMessage.success(T('OfficialInstallCopiedTarget', { target: target.label }))
    } else {
      copyFailed.value = true; actionError.value = T('OfficialInstallCopyFallback')
    }
  } catch { if (alive && revision === requestRevision) actionError.value = T('OfficialInstallPrepareError') }
  finally { if (alive) { preparing.value = false; busyTarget.value = '' } }
}
// 수정한 설정과 이전 명령이 섞이지 않도록 결과를 즉시 비운다.
watch(form, clearResult, { flush: 'sync' })
watch(() => JSON.stringify([props.server.id_server, props.server.key, props.server.api_server, props.server.relay_server]), clearResult, { flush: 'sync' })
onMounted(loadSettings)
</script>

<style scoped>
.official-install{display:grid;gap:14px;margin-top:20px;padding-top:20px;border-top:1px solid var(--console-border);min-width:0}.install-heading strong{font-size:15px;color:var(--console-heading)}.install-heading p,.install-help,.install-result p{font-size:13px;line-height:1.7;color:var(--console-muted);margin:6px 0 12px}.password-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%}.password-row :deep(.el-input){flex:1 1 230px}.password-row :deep(.el-button){margin:0}.install-choices{display:grid;gap:8px}.install-choices :deep(.el-checkbox){white-space:normal;height:auto;margin:0}.install-choices :deep(.el-checkbox__label){white-space:normal;line-height:1.6}.official-install :deep(.el-select){width:100%}.install-help{width:100%;margin:6px 0}.install-result{display:grid;gap:10px;min-width:0}.install-result :deep(textarea){font-family:monospace;font-size:12px;overflow-wrap:anywhere}.install-expiry,.install-result small{font-size:12px;color:var(--console-muted);line-height:1.7}.install-error{color:var(--el-color-danger);margin:0;font-size:13px;line-height:1.7}
.install-platforms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.install-platform{min-width:0;padding:0;margin:0;border:0}.install-platform legend{display:flex;align-items:center;gap:8px;padding:0;margin-bottom:10px;font-size:14px;font-weight:600;color:var(--console-heading)}.install-platform legend svg{width:20px;height:20px}.install-architecture{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--console-border)}.architecture-label{display:grid;gap:4px;min-width:0}.architecture-label strong{font-size:13px;color:var(--console-heading)}.architecture-label small{font-size:12px;color:var(--console-muted);overflow-wrap:anywhere}.install-copy-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;border:1px solid transparent;border-radius:6px;color:var(--console-muted);background:transparent;cursor:pointer;touch-action:manipulation}.install-copy-icon .el-icon{font-size:19px}.install-copy-icon:hover:not(:disabled),.install-copy-icon:focus-visible{color:var(--console-heading);background:var(--console-neutral-soft)}.install-copy-icon:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.install-copy-icon:disabled{opacity:.4;cursor:not-allowed}.install-copy-icon.is-copied{color:var(--el-color-success)}.install-feedback{min-height:20px;margin:0;font-size:13px;line-height:1.6;color:var(--console-heading)}
@media(max-width:600px){.password-row :deep(.el-input){flex-basis:100%}.official-install :deep(.el-form-item__label){line-height:1.6;height:auto}.install-platforms{grid-template-columns:1fr;gap:16px}}@media(prefers-reduced-motion:reduce){.install-copy-icon .is-loading{animation:none}}
</style>
