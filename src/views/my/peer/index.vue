<template>
  <div class="peer-management">
    <el-tabs v-model="listQuery.scope" @tab-change="changeScope">
      <el-tab-pane :label="T('OwnDevices')" name="mine"/>
      <el-tab-pane :label="T('ReceivedDevices')" name="received"/>
    </el-tabs>
    <el-card class="device-filter-card" shadow="never">
      <form class="device-filter-toolbar" role="search" @submit.prevent="handlerQuery">
        <div class="device-filter-primary">
          <el-input v-model="listQuery.id" clearable :placeholder="T('SearchDeviceId')" :aria-label="T('SearchDeviceId')"/>
          <el-input v-model="listQuery.hostname" clearable :placeholder="T('SearchHostname')" :aria-label="T('SearchHostname')"/>
          <el-select v-model="listQuery.time_ago" clearable :placeholder="T('LastOnlineTime')" :aria-label="T('LastOnlineTime')">
            <el-option v-for="item in timeFilters" :key="item.value" :label="item.text" :value="item.value" :disabled="item.value === 0"/>
          </el-select>
          <el-button native-type="submit" type="primary" :icon="Search">{{ T('Filter') }}</el-button>
          <el-button :icon="RefreshLeft" @click="resetQuery">{{ T('Reset') }}</el-button>
        </div>
        <el-button :icon="Download" @click="toExport">{{ T('Export') }}</el-button>
      </form>
    </el-card>
    <el-card class="list-body device-list-card" shadow="never">
      <el-alert v-if="listRes.failed" :title="T('DeviceListLoadFailed')" type="error" :closable="false"><el-button @click="getList">{{ T('Retry') }}</el-button></el-alert>
      <div class="list-table-toolbar">
        <div class="list-table-summary" aria-live="polite">
          <strong>{{ T('ResultsCount', { param: listRes.total }) }}</strong>
          <span v-if="multipleSelection.length" class="list-table-selection">
            {{ T('SelectedCount', { param: multipleSelection.length }) }}
          </span>
        </div>
      </div>
      <div v-if="multipleSelection.length && listQuery.scope === 'mine'" class="batch-action-bar" aria-live="polite">
        <strong>{{ T('SelectedCount', { param: multipleSelection.length }) }}</strong>
        <el-button type="primary" plain :icon="Notebook" @click="toBatchAddToAB">{{ T('BatchAddToAB') }}</el-button>
        <el-button :icon="Share" @click="shareDevices(multipleSelection)">{{ T('ShareDevices') }}</el-button>
      </div>
      <el-table class="device-table" :data="listRes.list" v-loading="listRes.loading" row-key="row_id" border stripe scrollbar-always-on @selection-change="handleSelectionChange" @row-click="openDetails">
        <el-table-column v-if="listQuery.scope === 'mine'" type="selection" width="48" align="center" fixed="left"/>
        <el-table-column prop="last_online_time" :label="T('Status')" width="106" fixed="left" sortable>
          <template #default="{row}">
            <span class="device-status" :class="isPeerOnline(row) ? 'is-online' : 'is-offline'">
              <el-icon aria-hidden="true"><CircleCheck v-if="isPeerOnline(row)"/><Warning v-else/></el-icon>
              {{ isPeerOnline(row) ? T('Online') : T('Offline') }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="id" :label="T('DeviceIdAndOs')" min-width="190" fixed="left" sortable show-overflow-tooltip>
          <template #default="{row}">
            <div class="peer-id-column">
              <PeerOs :os="row.os"/><el-button class="peer-details-button" link :aria-label="`${T('ViewDetails')} ${row.id}`" @click.stop="openDetails(row)">{{ row.id }}</el-button>
              <el-button class="table-copy-button" link :aria-label="T('CopyId')" @click.stop="handleClipboard(row.id, $event)"><el-icon aria-hidden="true"><CopyDocument/></el-icon></el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="hostname" :label="T('Hostname')" min-width="160" sortable show-overflow-tooltip/>
        <el-table-column prop="owner_name" :label="T('DeviceOwner')" min-width="130" show-overflow-tooltip/>
        <el-table-column v-if="listQuery.scope === 'received'" :label="T('ShareSource')" min-width="180" show-overflow-tooltip><template #default="{row}">{{ row.share_sources?.join(', ') }}</template></el-table-column>
        <el-table-column prop="last_online_time" :label="T('LastOnlineTime')" min-width="150" sortable>
          <template #default="{row}">{{ row.last_online_time ? timeAgo(row.last_online_time * 1000) : T('NeverConnected') }}</template>
        </el-table-column>
        <el-table-column :label="T('QuickConnect')" align="center" width="136" fixed="right">
          <template #default="{row}"><DeviceConnect :key="row.row_id" :peer="row" show-client/></template>
        </el-table-column>
        <el-table-column :label="T('Actions')" align="center" width="64" class-name="table-actions" fixed="right">
          <template #default="{row}">
            <el-dropdown trigger="click" @click.stop>
              <el-button circle :icon="MoreFilled" :aria-label="T('DeviceActions', { param: row.id })" @click.stop/>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :icon="View" @click="openDetails(row)">{{ T('ViewDetails') }}</el-dropdown-item>
                  <el-dropdown-item v-if="listQuery.scope === 'mine'" :icon="Notebook" @click="toAddressBook(row)">{{ T('AddToAddressBook') }}</el-dropdown-item>
                  <el-dropdown-item v-if="listQuery.scope === 'mine'" :icon="Share" @click="shareDevices([row])">{{ T('ShareDevices') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty><el-empty :description="T('NoDevicesFound')"><el-button v-if="activeFilterCount" @click="resetQuery">{{ T('ResetFilters') }}</el-button></el-empty></template>
      </el-table>
    </el-card>
    <el-card v-if="listRes.total > 0" class="list-page" shadow="hover">
      <el-pagination background
                     layout="prev, pager, next, sizes, jumper"
                     :page-sizes="[10,20,50,100]"
                     v-model:page-size="listQuery.page_size"
                     v-model:current-page="listQuery.page"
                     :total="listRes.total">
      </el-pagination>
    </el-card>
    <DeviceDetailDrawer v-model="detailVisible" :peer="selectedPeer" @connect="connectByClient">
      <template #connect><DeviceConnect v-if="selectedPeer" :key="selectedPeer.row_id" :peer="selectedPeer" show-client/></template>
    </DeviceDetailDrawer>
    <AddressBookShareDialog v-model="shareVisible" :peer-ids="sharePeerIDs" @saved="getList"/>

    <el-dialog v-model="ABFormVisible" width="800" :title="T('Create')">
      <el-form class="dialog-form" ref="form" :model="ABFormData" label-width="120px">
        <el-form-item :label="T('AddressBookName')" required prop="collection_id">
          <el-select v-model="ABFormData.collection_id" clearable @change="changeCollectionForUpdate">
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListResForUpdate.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="ID" prop="id" required>
          <el-input v-model="ABFormData.id"></el-input>
        </el-form-item>
        <el-form-item :label="T('Username')" prop="username">
          <el-input v-model="ABFormData.username"></el-input>
        </el-form-item>
        <el-form-item :label="T('Alias')" prop="alias">
          <el-input v-model="ABFormData.alias"></el-input>
        </el-form-item>
        <el-form-item :label="T('Hostname')" prop="hostname">
          <el-input v-model="ABFormData.hostname"></el-input>
        </el-form-item>
        <el-form-item :label="T('Platform')" prop="platform">
          <el-select v-model="ABFormData.platform">
            <el-option
                v-for="item in ABPlatformList"
                :key="item.value"
                :label="item.label"
                :value="item.value"
            ></el-option>
          </el-select>
        </el-form-item>

        <el-form-item :label="T('Tags')" prop="tags">
          <el-select v-model="ABFormData.tags" multiple>
            <el-option
                v-for="item in tagListRes.list"
                :key="item.name"
                :label="item.name"
                :value="item.name"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="ABFormVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="ABSubmit" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="batchABFormVisible" width="800" :title="T('Create')">
      <el-form class="dialog-form" ref="form" :model="batchABFormData" label-width="120px">
        <el-form-item :label="T('AddressBookName')" required prop="collection_id">
          <el-select v-model="batchABFormData.collection_id" clearable @change="changeCollectionForBatchCreateAB">
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListResForUpdate.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('Tags')" prop="tags">
          <el-select v-model="batchABFormData.tags" multiple>
            <el-option
                v-for="item in tagListRes.list"
                :key="item.name"
                :label="item.name"
                :value="item.name"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="batchABFormVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="submitBatchAddToAB" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup>
  import { computed, onActivated, onMounted, reactive, ref, watch } from 'vue'
  import { list } from '@/api/my/peer'
  import { ElMessage } from 'element-plus'
  import { T } from '@/utils/i18n'
  import { timeAgo } from '@/utils/time'
  import { jsonToCsv, downBlob } from '@/utils/file'
  import { useRepositories as useABRepositories } from '@/views/address_book/index'
  import { useAppStore } from '@/store/app'
  import { connectByClient } from '@/utils/peer'
  import { CircleCheck, Connection, CopyDocument, Download, Monitor, MoreFilled, Notebook, RefreshLeft, Search, Share, View, Warning } from '@element-plus/icons-vue'
  import { handleClipboard } from '@/utils/clipboard'
  import { batchCreateFromPeers } from '@/api/my/address_book'
  import PeerOs from '@/components/icons/peerOs.vue'
  import DeviceDetailDrawer from '@/components/device/DeviceDetailDrawer.vue'
  import DeviceConnect from '@/components/device/DeviceConnect.vue'
  import AddressBookShareDialog from '@/components/device/AddressBookShareDialog.vue'

  const appStore = useAppStore()
  const listRes = reactive({
    list: [], total: 0, loading: false, failed: false,
  })
  const listQuery = reactive({
    scope: 'mine',
    page: 1,
    page_size: 10,
    time_ago: null,
    id: '',
    hostname: '',
  })
  const detailVisible = ref(false)
  const shareVisible = ref(false), sharePeerIDs = ref([])
  const shareDevices = peers => { sharePeerIDs.value = peers.map(peer => peer.row_id); shareVisible.value = true }
  const changeScope = () => { multipleSelection.value = []; detailVisible.value = false; listRes.list = []; handlerQuery() }
  const selectedPeer = ref(null)
  const activeFilterCount = computed(() => ['id', 'hostname', 'time_ago'].filter(key => listQuery[key]).length)

  let listRequestGeneration = 0
  const getList = async () => {
    const generation = ++listRequestGeneration
    listRes.loading = true
    listRes.failed = false
    const res = await list({ ...listQuery }).catch(_ => false)
    if (generation !== listRequestGeneration) return
    listRes.loading = false
    if (res) {
      listRes.list = res.data.list
      listRes.total = res.data.total
    } else { listRes.list = []; listRes.total = 0; listRes.failed = true }
  }
  const handlerQuery = () => {
    if (listQuery.page === 1) {
      getList()
    } else {
      listQuery.page = 1
    }
  }
  const resetQuery = () => {
    listQuery.time_ago = null
    listQuery.id = ''
    listQuery.hostname = ''
    handlerQuery()
  }

  /*const del = async (row) => {
    const cf = await ElMessageBox.confirm(T('Confirm?', { param: T('Delete') }), {
      confirmButtonText: T('Confirm'),
      cancelButtonText: T('Cancel'),
      type: 'warning',
    }).catch(_ => false)
    if (!cf) {
      return false
    }

    const res = await remove({ row_id: row.row_id }).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      getList()
    }
  }*/
  onMounted(getList)
  onActivated(getList)

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)

  const openDetails = (row, column) => {
    if (column?.type === 'selection') return
    selectedPeer.value = row
    detailVisible.value = true
  }

  const timeDis = (time) => {
    let now = new Date().getTime()
    let after = new Date(time * 1000).getTime()
    return (now - after) / 1000
  }
  const isPeerOnline = (peer) => peer?.last_online_time && timeDis(peer.last_online_time) < 60

  const timeFilters = computed(() => [
    { text: T('MinutesLess', { param: 1 }, 1), value: -60 },
    { text: T('HoursLess', { param: 1 }, 1), value: -3600 },
    { text: T('DaysLess', { param: 1 }, 1), value: -86400 },
    { text: '---------', value: 0 },
    { text: T('MinutesAgo', { param: 1 }, 1), value: 60 },
    { text: T('HoursAgo', { param: 1 }, 1), value: 3600 },
    { text: T('DaysAgo', { param: 1 }, 1), value: 86400 },
    { text: T('MonthsAgo', { param: 1 }, 1), value: 2592000 },
    // { text: T('YearsAgo', { param: 1 }, 1), value: 31536000 },
  ])

  const toExport = async () => {
    const q = { ...listQuery }
    q.page_size = 10000
    q.page = 1
    const res = await list(q).catch(_ => false)
    if (res) {
      const data = res.data.list.map(item => {
        item.last_online_time = item.last_online_time ? new Date(item.last_online_time * 1000).toLocaleString() : '-'
        delete item.user_id
        delete item.user
        return item
      })
      const csv = jsonToCsv(data)
      downBlob(csv, 'peers.csv')
    }
  }

  const {
    platformList: ABPlatformList,
    formVisible: ABFormVisible,
    formData: ABFormData,
    collectionListResForUpdate,
    getCollectionListForUpdate,
    tagListRes,
    changeCollectionForUpdate,
    submit: ABSubmit,
    fromPeer,
  } = useABRepositories('my')
  onMounted(getCollectionListForUpdate)
  const toAddressBook = (peer) => {
    fromPeer(peer)
    ABFormVisible.value = true
  }

  const multipleSelection = ref([])
  const handleSelectionChange = (val) => {
    multipleSelection.value = val
  }
  /*const toBatchDelete = async () => {
    if (!multipleSelection.value.length) {
      ElMessage.warning(T('PleaseSelectData'))
      return false
    }
    const cf = await ElMessageBox.confirm(T('Confirm?', { param: T('BatchDelete') }), {
      confirmButtonText: T('Confirm'),
      cancelButtonText: T('Cancel'),
      type: 'warning',
    }).catch(_ => false)
    if (!cf) {
      return false
    }

    const res = await batchRemove({ row_ids: multipleSelection.value.map(i => i.row_id) }).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      getList()
    }
  }*/

  const batchABFormVisible = ref(false)
  const toBatchAddToAB = () => {
    batchABFormVisible.value = true
  }
  const batchABFormData = ref({
    collection_id: 0,
    tags: [],
    peer_ids: [],
  })
  const changeCollectionForBatchCreateAB = (val) => {
    batchABFormData.value.tags = []
    changeCollectionForUpdate(val)
  }
  const submitBatchAddToAB = async () => {
    if (multipleSelection.value.length === 0) {
      ElMessage.warning(T('PleaseSelectData'))
      return false
    }
    batchABFormData.value.peer_ids = multipleSelection.value.map(i => i.row_id)
    if (!batchABFormData.value.peer_ids.length) {
      ElMessage.warning(T('PleaseSelectData'))
      return false
    }

    const res = await batchCreateFromPeers(batchABFormData.value).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      batchABFormVisible.value = false
    }
  }


</script>

<style scoped lang="scss">
.device-filter-card :deep(.el-card__body) { padding: 14px 16px; }
.device-filter-toolbar,
.device-filter-primary,
.batch-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-filter-toolbar { justify-content: space-between; }
.device-filter-primary { flex: 1 1 auto; min-width: 0; }
.device-filter-primary .el-input { width: min(220px, 23vw); }
.device-filter-primary .el-select { width: min(210px, 22vw); }
.device-list-card { margin-top: 12px; }
.batch-action-bar {
  justify-content: space-between;
  min-height: 46px;
  padding: 7px 10px 7px 14px;
  margin-bottom: 10px;
  color: var(--console-primary);
  background: var(--console-primary-soft);
  border: 1px solid var(--console-primary-border);
  border-radius: 6px;
}
.device-table :deep(.el-table__row) { cursor: pointer; }
.device-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.device-status.is-online { color: var(--console-success); }
.device-status.is-offline { color: var(--console-muted); }
.peer-id-column {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 8px;
}
.peer-id-column > span:nth-child(2) {
  overflow: hidden;
  min-width: 0;
  color: var(--console-heading);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .device-filter-toolbar { align-items: stretch; flex-direction: column; }
  .device-filter-primary { flex-wrap: wrap; }
  .device-filter-toolbar > .el-button { align-self: flex-end; }
}

@media (max-width: 620px) {
  .device-table :deep(.el-table-fixed-column--left) {
    position: static !important;
  }
  .device-filter-primary .el-input,
  .device-filter-primary .el-select {
    width: 100%;
  }
  .device-filter-primary .el-button { flex: 1 1 auto; }
  .batch-action-bar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
