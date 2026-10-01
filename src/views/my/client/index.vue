<template>
  <section class="client-center" v-loading="loading" aria-live="polite">
    <h1 class="sr-only">{{ T('ClientCenter') }}</h1>
    <el-alert v-if="error" type="error" :closable="false" show-icon>
      <template #title>{{ T('ClientReleaseLoadFailed') }}</template>
      <el-button class="retry-button" size="small" @click="load">
        <el-icon><Refresh /></el-icon>{{ T('Retry') }}
      </el-button>
    </el-alert>

    <template v-else-if="release">
      <section class="recommendation" aria-labelledby="client-recommendation-title">
        <div class="recommendation__copy">
          <h2 id="client-recommendation-title">{{ recommendationTitle }}</h2>
          <p>{{ recommendationDescription }}</p>
          <div v-if="!detected.mobile" class="environment-selectors">
            <el-select v-model="selectedOs" :aria-label="T('OperatingSystem')">
              <el-option v-for="item in desktopSystems" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
            <el-select v-model="selectedArch" :aria-label="T('CpuArchitecture')">
              <el-option label="x86_64" value="x86_64" />
              <el-option label="ARM64" value="aarch64" />
            </el-select>
          </div>
        </div>
        <div class="recommendation__action">
          <template v-if="detected.mobile">
            <el-icon class="platform-mark"><Iphone /></el-icon>
            <strong>{{ T('UseOfficialMobileStore') }}</strong>
            <span>{{ T('MobileStoreOnlyDescription') }}</span>
          </template>
          <template v-else-if="recommendedArtifact">
            <el-icon class="platform-mark"><Monitor /></el-icon>
            <span class="artifact-version">RustDesk {{ release.manifest.version }}</span>
            <strong>{{ recommendedArtifact.filename }}</strong>
            <span>{{ formatBytes(recommendedArtifact.size) }} · {{ selectedArchLabel }}</span>
            <el-button type="primary" :loading="downloading === recommendedArtifact.filename" @click="download(recommendedArtifact)">
              <el-icon><Download /></el-icon>{{ T('DownloadRecommended') }}
            </el-button>
          </template>
          <el-empty v-else :description="T('NoCompatibleInstaller')" :image-size="56" />
        </div>
      </section>

      <section v-if="!detected.mobile" class="install-section" aria-labelledby="all-installers-title">
        <div class="section-heading">
          <div>
            <h2 id="all-installers-title">{{ T('AllDesktopInstallers') }}</h2>
            <p>{{ T('AllDesktopInstallersDescription') }}</p>
          </div>
          <el-tag type="success" effect="plain"><el-icon><Checked /></el-icon>{{ T('StableRelease') }}</el-tag>
        </div>
        <el-tabs v-model="selectedOs" class="platform-tabs">
          <el-tab-pane v-for="system in desktopSystems" :key="system.value" :name="system.value" :label="system.label">
            <div v-if="artifactsByOs(system.value).length" class="artifact-list">
              <article v-for="artifact in artifactsByOs(system.value)" :key="artifact.filename" class="artifact-row">
                <div class="artifact-row__identity">
                  <strong>{{ packageLabel(artifact.package) }}</strong>
                  <span>{{ artifact.arch }} · {{ formatBytes(artifact.size) }}</span>
                </div>
                <code :title="artifact.filename">{{ artifact.filename }}</code>
                <el-button :loading="downloading === artifact.filename" @click="download(artifact)">
                  <el-icon><Download /></el-icon>{{ T('Download') }}
                </el-button>
              </article>
            </div>
            <el-empty v-else :description="T('NoCompatibleInstaller')" :image-size="56" />
          </el-tab-pane>
        </el-tabs>
      </section>

      <section class="guide-grid" :aria-label="T('InstallGuideRegion')">
        <article class="guide-panel guide-panel--steps">
          <h2>{{ T('InstallAndConfigure') }}</h2>
          <ol>
            <li><strong>{{ T('InstallStepDownload') }}</strong><span>{{ T('InstallStepDownloadDescription') }}</span></li>
            <li><strong>{{ T('InstallStepVerify') }}</strong><span>{{ checksumCommand }}</span></li>
            <li><strong>{{ T('InstallStepConfigure') }}</strong><span>{{ T('InstallStepConfigureDescription') }}</span></li>
          </ol>
          <el-collapse>
            <el-collapse-item :title="T('SignatureVerification')" name="signature">
              <pre><code>{{ signatureCommand }}</code></pre>
            </el-collapse-item>
            <el-collapse-item title="명령줄 자동 설치" name="command">
              <p>{{ T('LinuxTokenSafetyDescription') }}</p>
              <div class="copy-line"><code>{{ installCommand }}</code><el-button circle :aria-label="T('CopyInstallCommand')" @click="copy(installCommand)"><el-icon><CopyDocument /></el-icon></el-button></div>
            </el-collapse-item>
          </el-collapse>
        </article>

        <article class="guide-panel guide-panel--server">
          <h2>{{ T('ServerConnectionSettings') }}</h2>
          <p>{{ T('ServerConnectionSettingsDescription') }}</p>
          <dl>
            <div><dt>ID Server</dt><dd><code>{{ server.id_server || T('NotSet') }}</code><el-button circle :aria-label="T('CopyIdServer')" @click="copy(server.id_server)"><el-icon><CopyDocument /></el-icon></el-button></dd></div>
            <div><dt>Relay Server</dt><dd><code>{{ server.relay_server || T('NotSet') }}</code><el-button circle :aria-label="T('CopyRelayServer')" @click="copy(server.relay_server)"><el-icon><CopyDocument /></el-icon></el-button></dd></div>
            <div><dt>API Server</dt><dd><code>{{ server.api_server || T('NotSet') }}</code><el-button circle :aria-label="T('CopyApiServer')" @click="copy(server.api_server)"><el-icon><CopyDocument /></el-icon></el-button></dd></div>
            <div><dt>{{ T('PublicKey') }}</dt><dd><code class="key-value">{{ server.key || T('NotSet') }}</code><el-button circle :aria-label="T('CopyPublicKey')" @click="copy(server.key)"><el-icon><CopyDocument /></el-icon></el-button></dd></div>
          </dl>
        </article>
      </section>
    </template>

    <el-empty v-else :description="T('NoStableClientRelease')" />
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Checked, CopyDocument, Download, Iphone, Monitor, Refresh } from '@element-plus/icons'
import { clientReleases, downloadClientArtifact } from '@/api/clientRelease'
import { T } from '@/utils/i18n'

const desktopSystems = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
]
const detected = ref({ os: 'windows', arch: 'x86_64', mobile: false })
const selectedOs = ref('windows')
const selectedArch = ref('x86_64')
const release = ref(null)
const server = ref({})
const loading = ref(false)
const error = ref(false)
const downloading = ref('')

const detectEnvironment = async () => {
  const userAgent = navigator.userAgent || ''
  const mobile = /Android|iPhone|iPad|iPod/i.test(userAgent)
  let os = /Mac/i.test(userAgent) ? 'macos' : /Linux/i.test(userAgent) ? 'linux' : 'windows'
  let arch = /arm64|aarch64/i.test(userAgent) ? 'aarch64' : 'x86_64'
  if (navigator.userAgentData?.getHighEntropyValues) {
    const values = await navigator.userAgentData.getHighEntropyValues(['architecture', 'platform']).catch(() => null)
    if (values?.architecture === 'arm') arch = 'aarch64'
    if (/mac/i.test(values?.platform || '')) os = 'macos'
    if (/linux/i.test(values?.platform || '')) os = 'linux'
    if (/win/i.test(values?.platform || '')) os = 'windows'
  }
  detected.value = { os, arch, mobile }
  selectedOs.value = os
  selectedArch.value = arch
}

const artifactsByOs = os => release.value?.manifest?.artifacts?.filter(item => item.os === os) || []
const preferredPackages = { windows: ['msi', 'exe'], macos: ['dmg'], linux: ['deb', 'rpm', 'appimage'] }
const recommendedArtifact = computed(() => {
  const candidates = artifactsByOs(selectedOs.value).filter(item => item.arch === selectedArch.value)
  return preferredPackages[selectedOs.value]?.map(kind => candidates.find(item => item.package === kind)).find(Boolean) || candidates[0]
})
const selectedArchLabel = computed(() => selectedArch.value === 'aarch64' ? 'ARM64' : 'x86_64')
const recommendationTitle = computed(() => detected.value.mobile ? T('MobileClientGuide') : T('RecommendedForEnvironment', { param: `${desktopSystems.find(item => item.value === selectedOs.value)?.label} ${selectedArchLabel.value}` }))
const recommendationDescription = computed(() => detected.value.mobile ? T('MobileStoreOnlyDescription') : T('RecommendedInstallerDescription'))
const checksumCommand = computed(() => selectedOs.value === 'windows' ? 'Get-FileHash .\\installer -Algorithm SHA256' : selectedOs.value === 'macos' ? 'shasum -a 256 ./installer.dmg' : 'sha256sum ./installer')
const signatureCommand = computed(() => selectedOs.value === 'windows' ? 'Get-AuthenticodeSignature .\\installer.msi' : selectedOs.value === 'macos' ? 'spctl -a -vv -t install ./installer.dmg' : 'sha256sum --check SHA256SUMS')
const installCommand = computed(() => {
  const origin = window.location.origin
  if (selectedOs.value === 'windows') return `curl.exe -fsS ${origin}/api/client/install/windows.ps1 -o install-rustdesk-client.ps1; powershell -ExecutionPolicy Bypass -File .\\install-rustdesk-client.ps1`
  if (selectedOs.value === 'macos') return `curl -fsS ${origin}/api/client/install/macos.sh -o install-rustdesk-client.sh && sh install-rustdesk-client.sh`
  return `curl -fsS ${origin}/api/client/install/linux.sh -o install-rustdesk-client.sh && sh install-rustdesk-client.sh`
})

const load = async () => {
  loading.value = true
  error.value = false
  const result = await clientReleases().catch(() => null)
  release.value = result?.data?.list?.[0] || null
  server.value = result?.data?.server || {}
  error.value = !result
  loading.value = false
}
const download = async artifact => {
  downloading.value = artifact.filename
  try {
    await downloadClientArtifact(artifact)
  } catch (downloadError) {
    ElMessage.error(downloadError.status === 403 ? T('ClientReleaseUnavailable') : T('ClientDownloadFailed'))
  } finally {
    downloading.value = ''
  }
}
const copy = async value => {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success(T('Copied'))
  } catch {
    ElMessage.error(T('CopyFailed'))
  }
}
const packageLabel = value => ({ msi: 'MSI', exe: 'EXE', dmg: 'DMG', deb: 'DEB', rpm: 'RPM', appimage: 'AppImage' }[value] || value)
const formatBytes = value => new Intl.NumberFormat(undefined, { style: 'unit', unit: value >= 1024 ** 3 ? 'gigabyte' : 'megabyte', maximumFractionDigits: 1 }).format(value >= 1024 ** 3 ? value / 1024 ** 3 : value / 1024 ** 2)

onMounted(async () => {
  await detectEnvironment()
  await load()
})
</script>

<style scoped lang="scss">
.client-center{display:grid;max-width:1180px;margin:0 auto;gap:16px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.retry-button{margin-top:10px}.recommendation{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);border:1px solid var(--console-primary-border);border-radius:6px;background:var(--console-surface);overflow:hidden}.recommendation__copy{padding:32px}.recommendation__copy h2,.section-heading h2,.guide-panel h2{margin:0;color:var(--console-heading);font-size:22px;line-height:1.3;text-wrap:balance}.recommendation__copy>p:not(.recommendation__context),.section-heading p,.guide-panel>p{max-width:68ch;margin:8px 0 0;color:var(--console-muted)}.recommendation__context{margin:0 0 10px;color:var(--console-primary);font-weight:700}.environment-selectors{display:flex;max-width:430px;margin-top:22px;gap:10px}.recommendation__action{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:28px;background:var(--console-primary-soft);border-left:1px solid var(--console-primary-border);gap:7px;min-width:0}.recommendation__action strong{max-width:100%;color:var(--console-heading);font-size:16px;overflow-wrap:anywhere}.recommendation__action>span{color:var(--console-muted)}.recommendation__action .el-button{margin-top:10px}.platform-mark{color:var(--console-primary);font-size:32px}.artifact-version{font-variant-numeric:tabular-nums}.install-section,.guide-panel{padding:24px;border:1px solid var(--console-border);border-radius:6px;background:var(--console-surface)}.section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}.platform-tabs{margin-top:18px}.artifact-list{display:grid}.artifact-row{display:grid;grid-template-columns:160px minmax(0,1fr) auto;align-items:center;min-height:64px;padding:10px 0;border-bottom:1px solid var(--console-border);gap:16px}.artifact-row:last-child{border-bottom:0}.artifact-row__identity{display:flex;flex-direction:column}.artifact-row__identity span{color:var(--console-muted);font-size:12px;font-variant-numeric:tabular-nums}.artifact-row code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guide-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}.guide-panel--steps ol{display:grid;margin:20px 0;padding:0;counter-reset:step;gap:16px;list-style:none}.guide-panel--steps li{display:grid;grid-template-columns:32px minmax(0,1fr);gap:2px 10px}.guide-panel--steps li::before{display:grid;grid-row:1/3;width:26px;height:26px;border-radius:50%;color:#fff;background:var(--console-primary);place-items:center;counter-increment:step;content:counter(step);font-weight:700}.guide-panel--steps li span{color:var(--console-muted);overflow-wrap:anywhere}.guide-panel pre{padding:12px;overflow:auto;border-radius:5px;background:var(--console-canvas);white-space:pre-wrap}.copy-line{display:flex;align-items:center;gap:8px}.copy-line code{min-width:0;overflow-wrap:anywhere}.guide-panel dl{display:grid;margin:18px 0 0;gap:0}.guide-panel dl>div{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;min-height:48px;border-bottom:1px solid var(--console-border);gap:12px}.guide-panel dl>div:last-child{border-bottom:0}.guide-panel dt{color:var(--console-muted)}.guide-panel dd{display:flex;align-items:center;min-width:0;margin:0;gap:8px}.guide-panel dd code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guide-panel dd .key-value{white-space:normal;overflow-wrap:anywhere}.guide-panel .el-button.is-circle{flex:0 0 auto}.guide-panel :deep(.el-collapse){margin-top:14px;border-bottom:0}.guide-panel :deep(.el-collapse-item__header){font-weight:600}.guide-panel :deep(.el-collapse-item__wrap){border-bottom:0}@media(max-width:800px){.recommendation,.guide-grid{grid-template-columns:1fr}.recommendation__copy{padding:22px}.recommendation__action{padding:22px;border-top:1px solid var(--console-primary-border);border-left:0}.artifact-row{grid-template-columns:minmax(0,1fr) auto}.artifact-row code{grid-column:1/-1;grid-row:2}.section-heading{align-items:flex-start}.guide-panel{padding:20px}}@media(max-width:520px){.environment-selectors{flex-direction:column}.artifact-row{gap:8px}.artifact-row .el-button{grid-column:2;grid-row:1}.guide-panel dl>div{grid-template-columns:1fr;align-items:start;padding:10px 0;gap:4px}}
</style>
