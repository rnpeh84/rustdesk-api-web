<template>
  <section class="client-installation" v-loading="loading">
    <el-alert v-if="failed" :title="T('OfficialInstallLoadError')" type="error" :closable="false"><el-button @click="load">{{ T('Retry') }}</el-button></el-alert>
    <template v-else-if="!loading">
      <el-card shadow="never"><OfficialClientInstall :server="server" compact/></el-card>
      <el-card shadow="never">
        <template #header><div class="connection-heading"><h2>{{ T('DashboardServerInfo') }}</h2><span>{{ T('DashboardReadOnly') }}</span></div></template>
        <dl class="connection-facts">
          <div><dt>{{ T('DashboardServerProfile') }}</dt><dd>{{ server.name || '-' }} <small v-if="server.revision">r{{ server.revision }}</small></dd></div>
          <div><dt>{{ T('DashboardIdServer') }}</dt><dd><code>{{ server.id_server || '-' }}</code></dd></div>
          <div><dt>{{ T('DashboardRelayServer') }}</dt><dd><code>{{ server.relay_server || '-' }}</code></dd></div>
          <div><dt>{{ T('DashboardApiServer') }}</dt><dd><code>{{ server.api_server || '-' }}</code></dd></div>
        </dl>
        <ServerConfigShare :server="server" compact minimal/>
        <router-link class="client-guide" to="/my/client">{{ T('DashboardClientGuide') }}<el-icon><ArrowRight/></el-icon></router-link>
      </el-card>
    </template>
  </section>
</template>
<script setup>
import { onActivated, onBeforeUnmount, ref } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { clientReleases } from '@/api/clientRelease'
import OfficialClientInstall from '@/components/client/OfficialClientInstall.vue'
import ServerConfigShare from '@/components/client/ServerConfigShare.vue'
import { T } from '@/utils/i18n'
const server = ref({}), loading = ref(true), failed = ref(false)
let generation = 0, loadedAt = 0
const load = async () => {
  const current = ++generation
  loading.value = true; failed.value = false
  try { const result = await clientReleases(); if (current === generation) { server.value = result.data.server || {}; loadedAt = Date.now() } }
  catch { if (current === generation) failed.value = true }
  finally { if (current === generation) loading.value = false }
}
load()
onActivated(() => { if (loadedAt && Date.now() - loadedAt > 30000) load() })
onBeforeUnmount(() => { generation += 1 })
</script>
<style scoped>
.client-installation { display: grid; gap: 12px; }
.connection-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.connection-heading h2 { margin: 0; font-size: 14px; }
.connection-heading span { color: var(--console-muted); font-size: 11px; }
.connection-facts { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 16px; margin: 0 0 16px; padding-bottom: 16px; border-bottom: 1px solid var(--console-border); }
.connection-facts dt { color: var(--console-muted); font-size: 12px; margin-bottom: 6px; }
.connection-facts dd { margin: 0; color: var(--console-heading); font-size: 13px; overflow-wrap: anywhere; }
.connection-facts small { color: var(--console-muted); }
.client-guide { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--console-border); color: var(--console-primary); font-size: 13px; }
@media(max-width:900px) { .connection-facts { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:500px) { .connection-facts { grid-template-columns: 1fr; } }
</style>
