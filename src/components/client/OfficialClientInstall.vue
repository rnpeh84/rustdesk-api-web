<template>
  <section class="official-install" :class="{ 'is-compact': compact }" :aria-label="T('OfficialInstallTitle')" :aria-busy="loading || preparing">
    <div class="install-heading"><h2>{{ T('OfficialInstallTitle') }}</h2><p v-if="!compact">{{ T('OfficialInstallShortHint') }}</p></div>
    <el-alert v-if="loadError" type="error" :closable="false" :title="T('OfficialInstallLoadError')" />
    <el-button v-if="loadError" @click="loadSettings">{{ T('Retry') }}</el-button>
    <template v-else>
      <section class="install-settings" :aria-label="T('OfficialInstallSettingsTitle')">
        <div v-if="!compact" class="settings-heading"><h3>{{ T('OfficialInstallSettingsTitle') }}</h3><p>{{ T('OfficialInstallSettingsApplyHint') }}</p></div>
        <el-form label-position="top" :disabled="loading || preparing">
        <el-form-item :label="T('OfficialInstallPassword')" for="official-install-password">
          <div class="password-row">
            <el-input id="official-install-password" v-model="form.password" name="official-install-password" type="password" show-password autocomplete="new-password" :maxlength="128" :placeholder="T(savedPassword ? 'OfficialInstallKeepPassword' : 'OfficialInstallPasswordHint')" />
            <el-button @click="generatePassword">{{ T('OfficialInstallGenerate') }}</el-button>
            <el-button v-if="savedPassword" :loading="revealing" @click="showSavedPassword">{{ T('OfficialInstallShowSaved') }}</el-button>
          </div>
          <p v-if="!compact" class="install-help">{{ T('OfficialInstallPasswordHelp') }}</p>
        </el-form-item>
        <details class="install-settings-details">
          <summary><span><strong>{{ T('OfficialInstallAdvanced') }}</strong><small>{{ settingsSummary }}</small><small>{{ overrideSummary }}</small></span><el-icon aria-hidden="true"><ArrowDown /></el-icon></summary>
          <div class="settings-content">
            <div class="settings-fields">
            <el-form-item :label="T('OfficialInstallMode')" for="official-install-mode">
              <el-select id="official-install-mode" v-model="form.mode">
                <el-option v-for="value in ['auto', 'desktop', 'terminal']" :key="value" :value="value" :label="T(`OfficialInstallMode_${value}`)" />
              </el-select>
            </el-form-item>
            <el-form-item :label="T('OfficialInstallShellUser')" for="official-install-shell-user">
              <el-input id="official-install-shell-user" v-model="form.shell_user" name="official-install-shell-user" :maxlength="96" :placeholder="T('OfficialInstallShellDefault')" autocomplete="off" :spellcheck="false" />
              <p class="install-help">{{ T('OfficialInstallShellHint') }}</p>
            </el-form-item>
            </div>
            <fieldset class="install-choices">
              <legend>{{ T('OfficialInstallReinstallOptions') }}</legend>
              <p class="install-help">{{ T('OfficialInstallPreserve') }}</p>
              <el-checkbox v-model="form.replace_password">{{ T('OfficialInstallReplacePassword') }}</el-checkbox>
              <el-checkbox v-model="form.replace_server">{{ T('OfficialInstallReplaceServer') }}</el-checkbox>
              <el-checkbox v-model="form.switch_official">{{ T('OfficialInstallSwitch') }}</el-checkbox>
            </fieldset>
          </div>
        </details>
        </el-form>
      </section>
      <section class="install-targets" :aria-label="T('OfficialInstallCopy')">
        <div class="targets-heading"><h3>{{ T('OfficialInstallCopy') }}</h3><p>{{ T(compact ? 'OfficialInstallSettingsApplyHint' : 'OfficialInstallChooseTarget') }}</p></div>
      <div class="install-platforms">
        <div v-for="platform in platforms" :key="platform.id" class="install-platform" role="group" :aria-label="platform.label">
          <div class="platform-heading"><PlatformIcons :name="platform.icon" aria-hidden="true" /><span translate="no">{{ platform.label }}</span></div>
          <div class="install-architectures"><div v-for="arch in platform.architectures" :key="arch.id" class="install-architecture">
            <div class="architecture-label" translate="no" :title="arch.detail"><strong>{{ arch.id }}</strong><small v-if="arch.detail && !compact">{{ arch.detail }}</small></div>
            <button type="button" class="install-copy-icon" :class="{ 'is-copied': copied && commandTarget?.key === targetKey(platform, arch) && !expired }"
              :aria-label="copyLabel(platform, arch)" :title="copyLabel(platform, arch)"
              :disabled="loading || preparing || revealing || !serverReady || !validForPlatform(platform.id)"
              @click="prepareAndCopy(platform, arch)">
              <el-icon aria-hidden="true"><Loading v-if="preparing && busyTarget === targetKey(platform, arch)" class="is-loading" /><Check v-else-if="copied && commandTarget?.key === targetKey(platform, arch) && !expired" /><DocumentCopy v-else /></el-icon>
            </button>
          </div></div>
        </div>
      </div>
      </section>
      <details class="install-instructions">
        <summary>{{ T('OfficialInstallBeforeRun') }}</summary>
        <p class="install-help">{{ T('OfficialInstallHint') }}</p>
        <p class="install-help">{{ T('OfficialInstallArchitectureHint') }}</p>
        <p class="install-help">{{ T('OfficialInstallPreserve') }}</p>
        <dl><div v-for="platform in platforms" :key="platform.id"><dt translate="no">{{ platform.label }}</dt><dd>{{ T(platform.hint) }}</dd></div></dl>
      </details>
      <p v-if="!serverReady && !compact" class="install-help">{{ T('OfficialInstallServerMissing') }}</p>
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
import { ArrowDown, Check, DocumentCopy, Loading } from '@element-plus/icons-vue'
import PlatformIcons from '@/components/icons/platform.vue'
import { officialInstallSettings, officialInstallPassword, prepareOfficialInstall } from '@/api/clientRelease'
import { T } from '@/utils/i18n'
import { newInstallPassword, beginInstallCommandCopy } from '@/utils/officialInstall'

const props = defineProps({ server: { type: Object, default: () => ({}) }, compact: Boolean })
const form = reactive({ password: '', shell_user: '', mode: 'auto', replace_password: false, replace_server: false, switch_official: false })
const platforms = [
  { id: 'linux', label: 'Linux', icon: 'linux', hint: 'OfficialInstallLinuxHint', architectures: [{ id: 'x64', detail: 'Intel / AMD' }, { id: 'ARM64' }] },
  { id: 'windows', label: 'Windows', icon: 'windows', hint: 'OfficialInstallWindowsHint', architectures: [{ id: 'x64', detail: 'Intel / AMD' }, { id: 'ARM64' }] },
  { id: 'macos', label: 'macOS', icon: 'mac', hint: 'OfficialInstallMacHint', architectures: [{ id: 'x64', detail: 'Intel' }, { id: 'ARM64', detail: 'Apple Silicon' }] },
]
const targetKey = (platform, arch) => `${platform.id}-${arch.id}`
const copyLabel = (platform, arch) => `${platform.label} ${arch.id} ${T('OfficialInstallCopy')}`
const loading = ref(true), loadError = ref(false), preparing = ref(false), revealing = ref(false), savedPassword = ref(false)
const command = ref(''), expiresAt = ref(0), now = ref(Date.now()), actionError = ref('')
const selectedTarget = ref(null), commandTarget = ref(null), busyTarget = ref(''), copied = ref(false), copyFailed = ref(false)
let alive = true
let revision = 0
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onUnmounted(() => { alive = false; clearInterval(timer); form.password = ''; command.value = '' })
const expired = computed(() => now.value >= expiresAt.value * 1000)
const expiryLabel = computed(() => expiresAt.value ? `${T('OfficialInstallUntil')} ${new Date(expiresAt.value * 1000).toLocaleTimeString()}` : '')
const settingsSummary = computed(() => T('OfficialInstallSettingsSummary', { mode: T(`OfficialInstallMode_${form.mode}`), account: form.shell_user || T('OfficialInstallShellDefault') }))
const overrideSummary = computed(() => {
  const count = [form.replace_password, form.replace_server, form.switch_official].filter(Boolean).length
  return T(count ? 'OfficialInstallOverridesSelected' : 'OfficialInstallKeepExisting', { count })
})
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
.official-install{display:grid;gap:18px;min-width:0}.install-heading h2{margin:0;font-size:15px;line-height:1.5;color:var(--console-heading)}.install-heading p,.install-help,.install-result p{font-size:13px;line-height:1.7;color:var(--console-muted);margin:6px 0 12px}.password-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%}.password-row :deep(.el-input){flex:1 1 230px}.password-row :deep(.el-button){margin:0}.install-choices{display:grid;gap:8px;min-width:0;border:0;padding:0;margin:0}.install-choices legend{padding:0;font-size:13px;font-weight:600;color:var(--console-heading)}.install-choices :deep(.el-checkbox){white-space:normal;height:auto;margin:0}.install-choices :deep(.el-checkbox__label){white-space:normal;line-height:1.6}.official-install :deep(.el-select){width:100%}.install-help{width:100%;margin:6px 0}.install-result{display:grid;gap:10px;min-width:0;padding-top:16px;border-top:1px solid var(--console-border)}.install-result :deep(textarea){font-family:monospace;font-size:12px;overflow-wrap:anywhere}.install-expiry,.install-result small{font-size:12px;color:var(--console-muted);line-height:1.7}.install-error{color:var(--el-color-danger);margin:0;font-size:13px;line-height:1.7}
.install-settings{padding:16px;border:1px solid var(--console-border);border-radius:6px;background:var(--console-canvas)}.settings-heading h3,.targets-heading h3{margin:0;color:var(--console-heading);font-size:13px;line-height:1.6}.settings-heading p,.targets-heading p{margin:4px 0 14px;color:var(--console-muted);font-size:12px;line-height:1.7}.install-settings :deep(.el-form-item__label){font-size:12px;color:var(--console-text)}.install-settings :deep(.el-form-item){margin-bottom:14px}.install-settings-details{border-top:1px solid var(--console-border)}.install-settings-details summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0 0;cursor:pointer;list-style:none;touch-action:manipulation}.install-settings-details summary::-webkit-details-marker{display:none}.install-settings-details summary strong,.install-settings-details summary small{display:block}.install-settings-details summary strong{font-size:13px;color:var(--console-heading)}.install-settings-details summary small{margin-top:4px;font-size:12px;line-height:1.6;color:var(--console-muted);overflow-wrap:anywhere}.install-settings-details summary .el-icon{flex-shrink:0;color:var(--console-muted)}.install-settings-details[open] summary .el-icon{transform:rotate(180deg)}.install-settings-details summary:focus-visible,.install-instructions summary:focus-visible{outline:2px solid var(--console-primary);outline-offset:4px;border-radius:2px}.settings-content{padding-top:18px}.settings-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.settings-fields .install-help{font-size:12px}.install-instructions{border-top:1px solid var(--console-border);padding-top:12px}.install-instructions summary{font-size:12px;line-height:1.6;color:var(--console-text);cursor:pointer}.install-instructions dl{display:grid;gap:12px;margin:12px 0 0}.install-instructions dt{font-size:12px;font-weight:600;color:var(--console-heading)}.install-instructions dd{margin:3px 0 0;font-size:12px;color:var(--console-muted);line-height:1.7}.install-feedback:empty{display:none}
.install-platforms{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.install-platform{min-width:0;padding:0;margin:0;border:0}.install-platform .platform-heading{display:flex;align-items:center;gap:8px;padding:0;margin-bottom:10px;font-size:14px;font-weight:600;color:var(--console-heading)}.install-platform .platform-heading svg{width:20px;height:20px}.install-architecture{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--console-border)}.architecture-label{display:grid;gap:4px;min-width:0}.architecture-label strong{font-size:13px;color:var(--console-heading)}.architecture-label small{font-size:12px;color:var(--console-muted);overflow-wrap:anywhere}.install-copy-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 44px;width:44px;height:44px;border:1px solid transparent;border-radius:6px;color:var(--console-muted);background:transparent;cursor:pointer;touch-action:manipulation}.install-copy-icon .el-icon{font-size:19px}.install-copy-icon:hover:not(:disabled),.install-copy-icon:focus-visible{color:var(--console-heading);background:var(--console-neutral-soft)}.install-copy-icon:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.install-copy-icon:disabled{opacity:.4;cursor:not-allowed}.install-copy-icon.is-copied{color:var(--el-color-success)}.install-feedback{min-height:20px;margin:0;font-size:13px;line-height:1.6;color:var(--console-heading)}
@media(max-width:700px){.password-row :deep(.el-input){flex-basis:100%}.official-install :deep(.el-form-item__label){line-height:1.6;height:auto}.settings-fields{grid-template-columns:1fr;gap:0}.install-platforms{grid-template-columns:1fr;gap:16px}.install-architectures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.install-settings{padding:12px}}@media(prefers-reduced-motion:reduce){.install-copy-icon .is-loading{animation:none}}
.is-compact{grid-template-columns:minmax(260px,.8fr) minmax(380px,1.2fr);gap:14px 24px;align-items:start}.is-compact .install-heading,.is-compact .install-instructions,.is-compact .install-feedback,.is-compact .install-result,.is-compact .install-error,.is-compact>.install-help{grid-column:1/-1}.is-compact .install-settings{padding:0;border:0;background:transparent}.is-compact .install-platforms{grid-template-columns:1fr;gap:0}.is-compact .install-platform{display:grid;grid-template-columns:90px minmax(0,1fr);align-items:center;gap:12px;border-top:1px solid var(--console-border);padding:4px 0}.is-compact .platform-heading{margin:0;font-size:13px}.is-compact .platform-heading svg{width:18px;height:18px;flex-shrink:0}.is-compact .install-architectures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.is-compact .install-architecture{padding:0;border:0}.is-compact .install-copy-icon{width:32px;height:32px;flex-basis:32px;color:var(--console-primary)}.is-compact .install-copy-icon:disabled{color:var(--console-muted)}.is-compact .targets-heading p{margin-bottom:8px}.is-compact .install-settings-details summary{padding-top:10px}.is-compact .install-settings-details summary small{font-size:11px}.is-compact .install-instructions{padding-top:8px}.is-compact .install-feedback:empty{display:none}@media(max-width:1000px){.is-compact{grid-template-columns:1fr}}@media(max-width:450px){.is-compact .install-platform{grid-template-columns:90px minmax(0,1fr);gap:8px}.is-compact .install-architectures{gap:8px}}
</style>
