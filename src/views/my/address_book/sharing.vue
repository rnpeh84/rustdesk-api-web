<template>
  <section class="sharing-center">
    <el-tabs v-model="kind" @tab-change="changeKind"><el-tab-pane :label="T('DeviceSharing')" name="device"/><el-tab-pane :label="T('AddressBookSharing')" name="address_book"/></el-tabs>
    <p class="sharing-help">{{ T(kind === 'device' ? 'DirectDeviceShareHelp' : 'WholeAddressBookShare') }}</p>
    <el-card shadow="never">
      <div class="sharing-toolbar">
        <el-radio-group v-model="scope" @change="load"><el-radio-button value="sent">{{ T('SharedByMe') }}</el-radio-button><el-radio-button value="received">{{ T('SharedWithMe') }}</el-radio-button></el-radio-group>
        <div class="sharing-actions"><el-button v-if="scope === 'sent'" type="primary" :icon="Share" @click="createShare">{{ T(kind === 'device' ? 'ShareDevices' : 'ShareAddressBook') }}</el-button><el-button :icon="Refresh" :aria-label="T('Refresh')" @click="load"/></div>
      </div>
      <el-alert v-if="failed" :title="T('ShareLoadFailed')" type="error" :closable="false"><el-button @click="load">{{ T('Retry') }}</el-button></el-alert>
      <div v-else v-loading="loading">
      <div class="sharing-cards">
        <article v-for="book in shownBooks" :key="book.id" class="sharing-card">
          <h2>{{ book.name }}</h2>
          <p class="card-owner">{{ T('DeviceOwner') }}: {{ book.owner }} · {{ T('DeviceCount') }}: {{ book.device_count }}</p>
          <div v-for="recipient in book.recipients" :key="recipient.type + '-' + recipient.to_id" class="recipient-line"><el-icon :aria-label="T(recipient.type === 1 ? 'User' : 'Group')" role="img" :title="T(recipient.type === 1 ? 'User' : 'Group')"><User v-if="recipient.type === 1"/><UserFilled v-else/></el-icon><span class="recipient-name" :title="recipient.name">{{ recipient.name }}</span><span class="expiry" :class="{ expired: isExpired(recipient) }">{{ expiryLabel(recipient) }}</span></div>
          <div class="card-actions"><el-tooltip :content="T('ViewItems')"><el-button type="primary" plain :icon="List" :aria-label="T('ViewItems') + ' ' + book.name" @click="openEntries(book)"/></el-tooltip><template v-if="scope === 'sent'"><el-tooltip :content="T('Edit')"><el-button type="primary" plain :icon="Edit" :aria-label="T('Edit') + ' ' + book.name" @click="manage(book)"/></el-tooltip><InlineConfirmButton :label="T('StopSharing') + ' ' + book.name" :loading="removingID === book.id" @confirm="removeShare(book)"/></template></div>
        </article>
        <el-empty v-if="!loading && !shownBooks.length" :description="T(scope === 'sent' ? 'NoSentShares' : 'NoReceivedShares')"/>
      </div>
      <el-table class="sharing-table" :data="shownBooks" row-key="id" stripe>
        <el-table-column prop="name" :label="T(kind === 'device' ? 'SharedDevices' : 'ShareBookLabel')" min-width="180" show-overflow-tooltip/>
        <el-table-column prop="owner" :label="T('DeviceOwner')" min-width="130" show-overflow-tooltip/>
        <el-table-column prop="device_count" :label="T('DeviceCount')" width="100"/>
        <el-table-column :label="T(scope === 'sent' ? 'ShareRecipients' : 'ShareSource')" min-width="260"><template #default="{row}">
          <div v-for="r in row.recipients" :key="r.type + '-' + r.to_id" class="recipient-line"><el-icon :aria-label="T(r.type === 1 ? 'User' : 'Group')" role="img" :title="T(r.type === 1 ? 'User' : 'Group')"><User v-if="r.type === 1"/><UserFilled v-else/></el-icon><span class="recipient-name" :title="r.name">{{ r.name }}</span><span class="expiry" :class="{ expired: isExpired(r) }">{{ expiryLabel(r) }}</span></div>
        </template></el-table-column>
        <el-table-column :label="T('Actions')" width="160" fixed="right"><template #default="{row}"><div class="row-actions"><el-tooltip :content="T('ViewItems')"><el-button type="primary" plain :icon="List" :aria-label="T('ViewItems') + ' ' + row.name" @click="openEntries(row)"/></el-tooltip><template v-if="scope === 'sent'"><el-tooltip :content="T('Edit')"><el-button type="primary" plain :icon="Edit" :aria-label="T('Edit') + ' ' + row.name" @click="manage(row)"/></el-tooltip><InlineConfirmButton :label="T('StopSharing') + ' ' + row.name" :loading="removingID === row.id" @confirm="removeShare(row)"/></template></div></template></el-table-column>
        <template #empty><el-empty :description="T(scope === 'sent' ? 'NoSentShares' : 'NoReceivedShares')"/></template>
      </el-table>
      </div>
    </el-card>
    <AddressBookShareDialog v-model="shareVisible" :collection="shareBook" :share-kind="kind" @saved="load"/>
    <el-dialog v-model="entriesVisible" append-to-body :title="entryBook?.name || T('AddressBooks')" width="clamp(560px, 50vw, 800px)" destroy-on-close @closed="entryVersion++">
      <el-alert v-if="entriesFailed" :title="T('ShareLoadFailed')" type="error" :closable="false"><el-button @click="loadEntries">{{ T('Retry') }}</el-button></el-alert>
      <el-table v-else :data="bookEntries" v-loading="entriesLoading" stripe>
        <el-table-column :label="T('DeviceId')" min-width="160"><template #default="{row}"><div class="entry-id"><PeerOs :os="row.peer?.os || row.platform"/><span>{{ row.id }}</span></div></template></el-table-column>
        <el-table-column :label="T('Hostname')" min-width="150" show-overflow-tooltip><template #default="{row}">{{ row.peer?.hostname || row.hostname || row.alias || '-' }}</template></el-table-column>
        <el-table-column :label="T('DeviceOwner')" min-width="130"><template #default="{row}">{{ row.owner || T('UnverifiedDeviceOwner') }}</template></el-table-column>
        <el-table-column :label="T('QuickConnect')" width="130"><template #default="{row}"><DeviceConnect v-if="row.peer" :peer="row.peer" show-client/><span v-else>{{ T('ExternalDevice') }}</span></template></el-table-column>
      </el-table>
      <el-pagination v-if="entryTotal > 50" v-model:current-page="entryPage" :page-size="50" :total="entryTotal" layout="prev, pager, next" @current-change="loadEntries"/>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Refresh, Share, List, Edit, User, UserFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { T } from '@/utils/i18n'
import { books, entries, remove } from '@/api/my/sharing'
import AddressBookShareDialog from '@/components/device/AddressBookShareDialog.vue'
import DeviceConnect from '@/components/device/DeviceConnect.vue'
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
import PeerOs from '@/components/icons/peerOs.vue'
const route = useRoute(), router = useRouter()
const kind = ref(route.query.kind === 'address_book' ? 'address_book' : 'device')
const scope = ref('sent'), allBooks = ref([]), loading = ref(false), failed = ref(false), shareVisible = ref(false), shareBook = ref(null)
const now = ref(Math.floor(Date.now() / 1000)), timer = setInterval(() => { now.value = Math.floor(Date.now() / 1000) }, 1000)
const shownBooks = computed(() => allBooks.value.filter(book => (book.share_kind || 'address_book') === kind.value && (scope.value === 'sent' ? book.recipients.length : book.recipients.some(r => !r.expires_at || r.expires_at > now.value))))
const isExpired = r => r.expires_at > 0 && r.expires_at <= now.value
const expiryLabel = r => r.expires_at ? new Date(r.expires_at * 1000).toLocaleString() + ' · ' + T(isExpired(r) ? 'ShareExpired' : 'ShareExpiresOn') : T('ShareIndefinite')
const changeKind = () => router.replace({ query: { ...route.query, kind: kind.value } })
let version = 0
const load = async () => { const current = ++version; loading.value = true; failed.value = false; try { const res = await books({ scope: scope.value }); if (current === version) allBooks.value = res.data.list } catch { if (current === version) { allBooks.value = []; failed.value = true } } finally { if (current === version) loading.value = false } }
const manage = row => { shareBook.value = row; shareVisible.value = true }
const createShare = () => { shareBook.value = null; shareVisible.value = true }
const removingID = ref(null)
const removeShare = async row => {
  if (removingID.value !== null) return
  removingID.value = row.id
  try { await remove({ collection_id: row.id }); ElMessage.success(T('SharingStopped')); await load() } catch { /* 실패한 목록을 유지한다. */ } finally { removingID.value = null }
}
const entriesVisible = ref(false), entryBook = ref(null), bookEntries = ref([]), entryPage = ref(1), entryTotal = ref(0), entriesLoading = ref(false), entriesFailed = ref(false)
const openEntries = row => { entryBook.value = row; entryPage.value = 1; bookEntries.value = []; entryTotal.value = 0; entriesVisible.value = true; loadEntries() }
let entryVersion = 0
const loadEntries = async () => { const current = ++entryVersion; entriesLoading.value = true; entriesFailed.value = false; try { const res = await entries({ collection_id: entryBook.value.id, page: entryPage.value }); if (current === entryVersion) { bookEntries.value = res.data.list; entryTotal.value = res.data.total } } catch { if (current === entryVersion) { bookEntries.value = []; entriesFailed.value = true } } finally { if (current === entryVersion) entriesLoading.value = false } }
onMounted(load)
onBeforeUnmount(() => { clearInterval(timer); version++; entryVersion++ })
</script>

<style scoped>
.sharing-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.sharing-actions { display: flex; gap: 8px; }
.sharing-actions > .el-button { margin: 0; }
.sharing-help, .expiry { color: var(--el-text-color-secondary); line-height: 1.6; }
.recipient-line { display: flex; align-items: center; gap: 8px; padding: 4px 0; min-width: 0; white-space: nowrap; }
.recipient-line > .el-icon, .expiry { flex-shrink: 0; }
.recipient-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.expiry { font-size: 12px; }
.expired { color: var(--el-color-danger); }
.entry-id { display: inline-flex; align-items: center; gap: 8px; }
.sharing-center :deep(.el-pagination) { margin-top: 16px; }
.sharing-cards { display: none; }
.sharing-card { border-top: 1px solid var(--el-border-color-lighter); padding: 16px 0; overflow-wrap: anywhere; }
.sharing-card h2 { font-size: 15px; margin: 0 0 8px; }
.card-owner { color: var(--el-text-color-secondary); font-size: 12px; margin: 0 0 8px; }
.card-actions { display: flex; gap: 8px; margin-top: 12px; }
.row-actions { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.row-actions :deep(.el-button), .card-actions :deep(.el-button) { margin: 0; width: 32px; height: 32px; padding: 6px; }
@media (max-width: 899px) { .sharing-table { display: none; } .sharing-cards { display: block; } }
@media (max-width: 600px) { .sharing-toolbar { flex-wrap: wrap; } .sharing-actions { width: 100%; justify-content: flex-end; } }
</style>
