<template>
  <section class="sharing-center">
    <el-card shadow="never">
      <div class="sharing-toolbar"><el-radio-group v-model="scope" @change="load"><el-radio-button value="sent">{{ T('SharedByMe') }}</el-radio-button><el-radio-button value="received">{{ T('SharedWithMe') }}</el-radio-button></el-radio-group><el-button :icon="Refresh" :aria-label="T('Refresh')" @click="load"/></div>
      <el-alert v-if="failed" :title="T('ShareLoadFailed')" type="error" :closable="false"><el-button @click="load">{{ T('Retry') }}</el-button></el-alert>
      <el-table v-else :data="shownBooks" v-loading="loading" row-key="id" stripe>
        <el-table-column prop="name" :label="T('Name')" min-width="180" show-overflow-tooltip/>
        <el-table-column prop="owner" :label="T('AddressBookOwner')" min-width="130" show-overflow-tooltip/>
        <el-table-column prop="device_count" :label="T('DeviceCount')" width="100"/>
        <el-table-column :label="T(scope === 'sent' ? 'ShareRecipients' : 'ShareSource')" min-width="230"><template #default="{row}"><div v-for="r in row.recipients" :key="`${r.type}-${r.to_id}`">{{ T(r.type === 1 ? 'User' : 'Group') }}: {{ r.name }} ({{ T(`ShareEditRule${r.rule}`) }})</div></template></el-table-column>
        <el-table-column :label="T('Actions')" width="180" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openEntries(row)">{{ T('ViewItems') }}</el-button><el-button v-if="scope === 'sent'" link type="primary" @click="manage(row)">{{ T('ManageSharing') }}</el-button></template></el-table-column>
        <template #empty><el-empty :description="T(scope === 'sent' ? 'NoSentAddressBooks' : 'NoReceivedAddressBooks')"/></template>
      </el-table>
    </el-card>
    <AddressBookShareDialog v-model="shareVisible" :collection="selected" @saved="load"/>
    <el-dialog v-model="entriesVisible" append-to-body :title="selected?.name || T('AddressBooks')" width="min(800px, calc(100vw - 24px))" destroy-on-close>
      <el-alert v-if="entriesFailed" :title="T('ShareLoadFailed')" type="error" :closable="false"><el-button @click="loadEntries">{{ T('Retry') }}</el-button></el-alert>
      <el-table v-else :data="bookEntries" v-loading="entriesLoading" stripe>
        <el-table-column prop="id" :label="T('DeviceId')" min-width="130"/>
        <el-table-column :label="T('Hostname')" min-width="150" show-overflow-tooltip><template #default="{row}">{{ row.peer?.hostname || row.hostname || row.alias || '-' }}</template></el-table-column>
        <el-table-column :label="T('DeviceOwner')" min-width="130"><template #default="{row}">{{ row.owner || T('UnverifiedDeviceOwner') }}</template></el-table-column>
        <el-table-column :label="T('QuickConnect')" width="110"><template #default="{row}"><DeviceConnect v-if="row.peer" :peer="row.peer"/><span v-else>{{ T('ExternalDevice') }}</span></template></el-table-column>
      </el-table>
      <el-pagination v-if="entryTotal > 50" v-model:current-page="entryPage" :page-size="50" :total="entryTotal" layout="prev, pager, next" @current-change="loadEntries"/>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
import { books, entries } from '@/api/my/sharing'
import AddressBookShareDialog from '@/components/device/AddressBookShareDialog.vue'
import DeviceConnect from '@/components/device/DeviceConnect.vue'
const scope = ref('sent'), allBooks = ref([]), loading = ref(false), failed = ref(false), shareVisible = ref(false), selected = ref(null)
const shownBooks = computed(() => scope.value === 'sent' ? allBooks.value.filter(book => book.recipients.length) : allBooks.value)
let version = 0
const load = async () => { const current = ++version; loading.value = true; failed.value = false; try { const res = await books({ scope: scope.value }); if (current === version) allBooks.value = res.data.list } catch { if (current === version) { allBooks.value = []; failed.value = true } } finally { if (current === version) loading.value = false } }
const manage = row => { selected.value = row; shareVisible.value = true }
const entriesVisible = ref(false), bookEntries = ref([]), entryPage = ref(1), entryTotal = ref(0), entriesLoading = ref(false), entriesFailed = ref(false)
const openEntries = row => { selected.value = row; entryPage.value = 1; bookEntries.value = []; entriesVisible.value = true; loadEntries() }
let entryVersion = 0
const loadEntries = async () => { const current = ++entryVersion; entriesLoading.value = true; entriesFailed.value = false; try { const res = await entries({ collection_id: selected.value.id, page: entryPage.value }); if (current === entryVersion) { bookEntries.value = res.data.list; entryTotal.value = res.data.total } } catch { if (current === entryVersion) { bookEntries.value = []; entriesFailed.value = true } } finally { if (current === entryVersion) entriesLoading.value = false } }
onMounted(load)
</script>

<style scoped>
.sharing-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.sharing-center :deep(.el-pagination) { margin-top: 16px; }
@media (max-width: 480px) { .sharing-toolbar { flex-wrap: wrap; } }
</style>
