<template>
  <section class="server-config-share" :aria-label="T('DeploymentString')">
    <div class="share-toolbar">
      <div><strong>{{ T('DeploymentString') }}</strong><p>{{ T('DeploymentStringHint') }}</p></div>
      <div class="share-actions">
        <el-button :disabled="!configString" @click="copyConfig"><el-icon aria-hidden="true"><CopyDocument /></el-icon><span>{{ T('CopyDeploymentString') }}</span></el-button>
        <el-button :disabled="!configString" @click="showQr"><el-icon aria-hidden="true"><Grid /></el-icon><span>{{ T('ShowConnectionQr') }}</span></el-button>
      </div>
    </div>
    <el-input v-if="configString" :model-value="configString" type="textarea" :rows="2" readonly :aria-label="T('DeploymentString')" :spellcheck="false" />
    <p v-else class="share-empty">{{ T('DeploymentConfigMissing') }}</p>
    <el-dialog v-model="qrDialog" :title="T('ConnectionQrTitle')" width="min(400px, 94vw)" append-to-body destroy-on-close @closed="clearQr">
      <div class="qr-content" :aria-busy="qrLoading" aria-live="polite">
        <p>{{ T('ConnectionQrHint') }}</p>
        <div class="qr-image" v-loading="qrLoading">
          <img v-if="qrImage" :src="qrImage" :alt="T('ConnectionQrTitle')" width="280" height="280" />
          <el-alert v-else-if="qrError" type="warning" :closable="false" :title="T('ConnectionQrFailed')" />
        </div>
        <small>{{ T('ConnectionShareSafety') }}</small>
      </div>
      <template #footer><el-button @click="qrDialog=false">{{ T('Close') }}</el-button><el-button :disabled="!configString" @click="copyConfig">{{ T('CopyDeploymentString') }}</el-button></template>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { CopyDocument, Grid } from '@element-plus/icons'
import { ElMessage } from 'element-plus'
import { encodeRustDeskConfig, rustDeskQrPayload } from '@/utils/rustdeskConfig'
import { T } from '@/utils/i18n'

const props = defineProps({ server: { type: Object, default: () => ({}) } })
const configString = computed(() => encodeRustDeskConfig(props.server))
const qrDialog = ref(false), qrLoading = ref(false), qrError = ref(false), qrImage = ref('')
let qrVersion = 0
const clearQr = () => { qrVersion++; qrImage.value = ''; qrLoading.value = false; qrError.value = false }
const generateQr = async () => {
  const version = ++qrVersion
  const value = configString.value
  qrImage.value = ''; qrError.value = false
  if (!value) { qrLoading.value = false; return }
  qrLoading.value = true
  try {
    const { default: QRCode } = await import('qrcode')
    const image = await QRCode.toDataURL(rustDeskQrPayload(props.server), { errorCorrectionLevel: 'M', margin: 4, width: 560, color: { dark: '#000000', light: '#ffffff' } })
    if (version === qrVersion) qrImage.value = image
  } catch {
    if (version === qrVersion) qrError.value = true
  } finally {
    if (version === qrVersion) qrLoading.value = false
  }
}
const showQr = () => { qrDialog.value = true; generateQr() }
const copyConfig = async () => {
  if (!configString.value) return
  try { await navigator.clipboard.writeText(configString.value); ElMessage.success(T('Copied')) }
  catch { ElMessage.error(T('CopyFailed')) }
}
watch(configString, () => { if (qrDialog.value) generateQr() })
</script>

<style scoped>
.server-config-share{display:grid;gap:12px;padding-top:16px;border-top:1px solid var(--console-border)}.share-toolbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.share-toolbar strong{font-size:14px;color:var(--console-heading)}.share-toolbar p,.share-empty{margin:5px 0 0;font-size:13px;line-height:1.6;color:var(--console-muted)}.share-actions{display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0}.share-actions :deep(.el-button){margin-left:0}.server-config-share :deep(textarea){font-family:monospace;font-size:12px;overflow-wrap:anywhere}.qr-content{text-align:center;display:grid;gap:14px}.qr-content p{margin:0;line-height:1.7}.qr-content small{color:var(--console-muted);line-height:1.6}.qr-image{min-height:280px;display:grid;place-items:center}.qr-image img{max-width:100%;height:auto;background:#ffffff;border-radius:4px}@media(max-width:800px){.share-toolbar{flex-direction:column}.share-actions{width:100%}}
</style>
