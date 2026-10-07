<!--
#####################################################
# 화면정보 : 시스템 > 장치 관리                     #
#####################################################
-->
<template>
  <div class="peer-management">
    <el-card class="device-filter-card" shadow="never">
      <form class="device-filter-toolbar" role="search" @submit.prevent="handlerQuery">
        <div class="device-filter-primary">
          <el-input v-model="listQuery.id" clearable :placeholder="T('SearchDeviceId')" :aria-label="T('SearchDeviceId')"/>
          <el-input v-model="listQuery.hostname" clearable :placeholder="T('SearchHostname')" :aria-label="T('SearchHostname')"/>
          <el-button native-type="submit" type="primary" :icon="Search">{{ T('Filter') }}</el-button>
          <el-button :icon="RefreshLeft" @click="resetQuery">{{ T('Reset') }}</el-button>
          <el-button :icon="Filter" :class="{ 'is-filter-active': advancedFilterCount }" @click="advancedFiltersVisible = !advancedFiltersVisible">
            {{ T('AdvancedFilters') }}<span v-if="advancedFilterCount">({{ advancedFilterCount }})</span>
          </el-button>
        </div>
        <div class="device-filter-actions">
          <el-button type="primary" :icon="Plus" @click="toAdd">{{ T('AddDevice') }}</el-button>
          <el-popover :visible="showImport" placement="bottom-end" :width="600">
            <el-upload class="upload-demo" drag accept=".csv" :before-upload="parseCsv">
              <el-icon class="el-icon--upload"><UploadFilled/></el-icon>
              <div class="el-upload__text">{{ T('Drop file here or click to upload') }}</div>
              <template #tip>
                <div class="el-upload__tip">
                  {{ T('Please upload csv file') }}<br>
                  {{ T('Columns') }}: <strong>id,cpu,hostname,memory,os,username,uuid,version,group_id</strong><br>
                  {{ T('You can reference export file') }}
                </div>
              </template>
            </el-upload>
            <div class="popover-actions"><el-button @click="showImport=false">{{ T('Cancel') }}</el-button></div>
            <template #reference>
              <el-button :icon="Upload" @click="showImport=true">{{ T('Import') }}</el-button>
            </template>
          </el-popover>
          <el-button :icon="Download" @click="toExport">{{ T('Export') }}</el-button>
        </div>
      </form>

      <el-collapse-transition>
        <div v-show="advancedFiltersVisible" class="device-filter-advanced">
          <label>
            <span>{{ T('LastOnlineTime') }}</span>
            <el-select v-model="listQuery.time_ago" clearable :placeholder="T('PleaseSelect')">
              <el-option v-for="item in timeFilters" :key="item.value" :label="item.text" :value="item.value" :disabled="item.value === 0"/>
            </el-select>
          </label>
          <label>
            <span>{{ T('Username') }}</span>
            <el-input v-model="listQuery.username" clearable :placeholder="T('SearchUsername')"/>
          </label>
          <label>
            <span>IP</span>
            <el-input v-model="listQuery.ip" clearable :placeholder="T('SearchIp')"/>
          </label>
        </div>
      </el-collapse-transition>
    </el-card>

    <el-card class="list-body device-list-card" shadow="never">
      <div class="list-table-toolbar">
        <div class="list-table-summary" aria-live="polite">
          <strong>{{ T('ResultsCount', { param: listRes.total }) }}</strong>
          <span v-if="activeFilterCount">{{ T('ActiveFilterCount', { param: activeFilterCount }) }}</span>
        </div>
        <div class="list-table-tools">
          <el-select v-model="activeView" class="saved-view-select" :aria-label="T('SavedView')" @change="applySelectedView">
            <el-option value="default" :label="T('DefaultView')"/>
            <el-option value="saved" :label="T('MySavedView')" :disabled="!hasSavedView"/>
          </el-select>
          <el-tooltip :content="T('SaveCurrentView')">
            <el-button :icon="CollectionTag" :aria-label="T('SaveCurrentView')" @click="saveCurrentView"/>
          </el-tooltip>
          <el-select v-model="tableDensity" class="density-select" :aria-label="T('RowDensity')">
            <el-option value="comfortable" :label="T('Comfortable')"/>
            <el-option value="compact" :label="T('Compact')"/>
          </el-select>
          <el-button :icon="Setting" @click="showColumnSetting">{{ T('Columns') }}</el-button>
        </div>
      </div>

      <div v-if="multipleSelection.length" class="batch-action-bar" aria-live="polite">
        <strong>{{ T('SelectedCount', { param: multipleSelection.length }) }}</strong>
        <div>
          <el-button type="primary" plain :icon="Notebook" @click="toBatchAddToAB">{{ T('BatchAddToAB') }}</el-button>
          <el-button type="danger" plain :icon="Delete" @click="toBatchDelete">{{ T('BatchDelete') }}</el-button>
        </div>
      </div>

      <el-table
          ref="tableRef"
          :data="listRes.list"
          :class="['device-table', `is-${tableDensity}`]"
          :default-sort="sortState"
          v-loading="listRes.loading"
          row-key="row_id"
          border
          stripe
          scrollbar-always-on
          @selection-change="handleSelectionChange"
          @sort-change="handleSortChange"
          @row-click="openDetails"
      >
        <el-table-column type="selection" width="48" align="center" fixed="left"/>
        <el-table-column prop="last_online_time" :label="T('Status')" width="72" align="center" fixed="left" sortable>
          <template #default="{row}">
            <DevicePresence :online="!!isPeerOnline(row)"/>
          </template>
        </el-table-column>
        <el-table-column prop="id" :label="T('DeviceIdAndOs')" min-width="190" fixed="left" sortable show-overflow-tooltip>
          <template #default="{row}">
            <div class="peer-id-column">
              <PeerOs :os="row.os"/>
              <el-button class="peer-details-button" link :aria-label="`${T('ViewDetails')} ${row.id}`" @click.stop="openDetails(row)">{{ row.id }}</el-button>
              <el-button class="table-copy-button" link :aria-label="T('CopyId')" @click.stop="handleClipboard(row.id, $event)">
                <el-icon aria-hidden="true"><CopyDocument/></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="hostname" :label="T('Hostname')" min-width="145" sortable show-overflow-tooltip/>
        <el-table-column prop="username" :label="T('UserAndGroup')" min-width="165" sortable show-overflow-tooltip>
          <template #default="{row}">
            <div class="device-owner-cell">
              <strong>{{ row.username || '-' }}</strong>
              <span>{{ getGroupName(row.group_id) || T('NotSet') }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="last_online_time" :label="T('LastOnlineTime')" min-width="150" sortable>
          <template #default="{row}">{{ row.last_online_time ? timeAgo(row.last_online_time * 1000) : T('NeverConnected') }}</template>
        </el-table-column>

        <template v-for="column in optionalVisibleColumns" :key="column.name">
          <el-table-column v-if="column.name === 'cpu'" prop="cpu" label="CPU" min-width="130" sortable show-overflow-tooltip/>
          <el-table-column v-else-if="column.name === 'memory'" prop="memory" :label="T('Memory')" min-width="120" sortable show-overflow-tooltip/>
          <el-table-column v-else-if="column.name === 'last_online_ip'" prop="last_online_ip" :label="T('LastOnlineIp')" min-width="145" sortable show-overflow-tooltip/>
          <el-table-column v-else-if="column.name === 'uuid'" prop="uuid" :label="T('Uuid')" min-width="180" sortable show-overflow-tooltip/>
          <el-table-column v-else-if="column.name === 'version'" prop="version" :label="T('Version')" min-width="100" sortable/>
          <el-table-column v-else-if="column.name === 'alias'" prop="alias" :label="T('Alias')" min-width="120" sortable show-overflow-tooltip/>
          <el-table-column v-else-if="column.name === 'created_at'" prop="created_at" :label="T('CreatedAt')" min-width="160" sortable/>
          <el-table-column v-else-if="column.name === 'updated_at'" prop="updated_at" :label="T('UpdatedAt')" min-width="160" sortable/>
        </template>

        <el-table-column :label="T('QuickConnect')" align="center" width="220">
          <template #default="{row}">
            <DeviceConnect :key="row.row_id" :peer="row"/>
          </template>
        </el-table-column>
        <el-table-column :label="T('Actions')" align="center" width="64" class-name="table-actions" fixed="right">
          <template #default="{row}">
            <el-dropdown trigger="click" @click.stop>
              <el-button circle :icon="MoreFilled" :aria-label="T('DeviceActions', { param: row.id })" @click.stop/>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :icon="View" @click="openDetails(row)">{{ T('ViewDetails') }}</el-dropdown-item>
                  <el-dropdown-item :icon="Notebook" @click="toAddressBook(row)">{{ T('AddToAddressBook') }}</el-dropdown-item>
                  <el-dropdown-item :icon="Edit" @click="toEdit(row)">{{ T('Edit') }}</el-dropdown-item>
                  <el-dropdown-item :icon="Delete" class="dropdown-danger" divided @click="del(row)">{{ T('Delete') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="T('NoDevicesFound')">
            <el-button v-if="activeFilterCount" @click="resetQuery">{{ T('ResetFilters') }}</el-button>
            <el-button v-else type="primary" @click="toAdd">{{ T('AddDevice') }}</el-button>
          </el-empty>
        </template>
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
    <DeviceDetailDrawer
        v-model="detailVisible"
        :peer="selectedPeer"
        :group-name="getGroupName(selectedPeer?.group_id)"
          allow-audit
        @connect="connectByClient"
        @update:model-value="handleDetailVisibility"
      >
        <template #connect><DeviceConnect v-if="selectedPeer" :key="selectedPeer.row_id" :peer="selectedPeer"/></template>
      </DeviceDetailDrawer>

    <el-dialog v-model="formVisible" :title="!formData.row_id?T('Create'):T('Update')" width="800">
      <el-form class="dialog-form" ref="form" :model="formData" label-width="120px">
        <el-form-item label="ID" prop="id" required>
          <el-input v-model="formData.id"></el-input>
        </el-form-item>
        <el-form-item :label="T('Group')" prop="group_id">
          <el-select v-model="formData.group_id">
            <el-option
                v-for="item in groupListRes.list"
                :key="item.id"
                :label="item.name"
                :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('Username')" prop="username">
          <el-input v-model="formData.username"></el-input>
        </el-form-item>
        <el-form-item :label="T('Hostname')" prop="hostname">
          <el-input v-model="formData.hostname"></el-input>
        </el-form-item>
        <el-form-item label="CPU" prop="cpu">
          <el-input v-model="formData.cpu"></el-input>
        </el-form-item>
        <el-form-item :label="T('Memory')" prop="memory">
          <el-input v-model="formData.memory"></el-input>
        </el-form-item>
        <el-form-item :label="T('Os')" prop="os">
          <el-input v-model="formData.os"></el-input>
        </el-form-item>
        <el-form-item :label="T('Uuid')" prop="uuid">
          <el-input v-model="formData.uuid"></el-input>
        </el-form-item>
        <el-form-item :label="T('Version')" prop="version">
          <el-input v-model="formData.version"></el-input>
        </el-form-item>
        <el-form-item :label="T('Alias')" prop="alias">
          <el-input v-model="formData.alias"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="formVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="submit" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="ABFormVisible" width="800" :title="T('Create')" destroy-on-close>
      <createABForm :peer="clickRow" @success="ABFormVisible=false" @cancel="ABFormVisible=false"></createABForm>
    </el-dialog>

    <el-dialog v-model="batchABFormVisible" width="800" :title="T('Create')">
      <el-form class="dialog-form" ref="form" :model="batchABFormData" label-width="120px">
        <el-form-item :label="T('Owner')" prop="user_id" required>
          <el-select v-model="batchABFormData.user_id" @change="changeUserForBatchCreateAB">
            <el-option
                v-for="item in allUsers"
                :key="item.id"
                :label="item.username"
                :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('AddressBookName')" required prop="collection_id">
          <el-select v-model="batchABFormData.collection_id" clearable>
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListResForBatchCreateAB.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <!--        <el-form-item :label="T('Tags')" prop="tags">
                  <el-select v-model="batchABFormData.tags" multiple>
                    <el-option
                        v-for="item in tagListRes.list"
                        :key="item.name"
                        :label="item.name"
                        :value="item.name"
                    ></el-option>
                  </el-select>
                </el-form-item>-->
        <el-form-item>
          <el-button @click="batchABFormVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="submitBatchAddToAB" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>

    <el-dialog v-model="columnSettingVisible" class="column-settings-dialog" :title="T('ColumnSettings')" width="560" append-to-body>
      <p class="dialog-description">{{ T('ColumnSettingsDescription') }}</p>
      <div class="column-settings-list">
        <div v-for="(row, key) in visibleColumns" :key="row.name" class="column-settings-row">
          <span class="column-settings-order">{{ key + 1 }}</span>
          <el-checkbox v-model="row.visible">{{ T(row.label) }}</el-checkbox>
          <div class="column-settings-actions">
            <el-button :disabled="key === 0" :aria-label="`${T(row.label)} ${T('MoveUp')}`" @click="upColumn(key)"><el-icon><ArrowUp/></el-icon></el-button>
            <el-button :disabled="key === visibleColumns.length - 1" :aria-label="`${T(row.label)} ${T('MoveDown')}`" @click="downColumn(key)"><el-icon><ArrowDown/></el-icon></el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <el-button @click="columnSettingVisible = false">{{ T('Cancel') }}</el-button>
          <el-button type="primary" @click="saveColumnSetting">{{ T('Save') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
  import { computed, nextTick, onActivated, onMounted, reactive, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { batchRemove, create, detail, list, remove, update } from '@/api/peer'
  import { list as groupList } from '@/api/device_group'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { T } from '@/utils/i18n'
  import { timeAgo } from '@/utils/time'
  import { jsonToCsv, downBlob } from '@/utils/file'
  import { loadAllUsers } from '@/global'
  import { useAppStore } from '@/store/app'
  import { connectByClient } from '@/utils/peer'
  import { handleClipboard } from '@/utils/clipboard'
  import { batchCreateFromPeers } from '@/api/address_book'
  import { useRepositories as useCollectionRepositories } from '@/views/address_book/collection'
  import createABForm from '@/views/peer/createABForm.vue'
  import {
    ArrowDown, ArrowUp, CollectionTag, Connection, CopyDocument, Delete,
    Download, Edit, Filter, Monitor, MoreFilled, Notebook, Plus, RefreshLeft, Search,
    Setting, Upload, UploadFilled, View,
  } from '@element-plus/icons-vue'
  import PeerOs from '@/components/icons/peerOs.vue'
  import DeviceDetailDrawer from '@/components/device/DeviceDetailDrawer.vue'
  import DevicePresence from '@/components/device/DevicePresence.vue'
  import DeviceConnect from '@/components/device/DeviceConnect.vue'
  import { useUserStore } from '@/store/user'

  const appStore = useAppStore()
  const userStore = useUserStore()
  const route = useRoute()
  const router = useRouter()

  //group
  const groupListRes = reactive({
    list: [], total: 0, loading: false,
  })
  const groupListQuery = reactive({
    page: 1,
    page_size: 999,
  })
  const getGroupList = async () => {
    groupListRes.loading = true
    const res = await groupList(groupListQuery).catch(_ => false)
    groupListRes.loading = false
    if (res) {
      groupListRes.list = res.data.list
      groupListRes.total = res.data.total
    }
  }
  onMounted(getGroupList)
  //

  const listRes = reactive({
    list: [], total: 0, loading: false,
  })
  const listQuery = reactive({
    page: 1,
    page_size: 10,
    time_ago: null,
    id: '',
    hostname: '',
    username: '',
    ip: '',
  })
  const advancedFiltersVisible = ref(false)
  const tableRef = ref(null)
  const tableDensity = ref('comfortable')
  const sortState = reactive({ prop: '', order: '' })
  const activeView = ref('default')
  const hasSavedView = ref(false)
  const detailVisible = ref(false)
  const selectedPeer = ref(null)

  const storageIdentity = computed(() => userStore.username || 'anonymous')
  const savedViewKey = computed(() => `peer_saved_view_${storageIdentity.value}`)
  const columnSettingKey = computed(() => `peer_visible_columns_${storageIdentity.value}`)
  const advancedFilterCount = computed(() => ['time_ago', 'username', 'ip'].filter(key => listQuery[key]).length)
  const activeFilterCount = computed(() => ['id', 'hostname', 'time_ago', 'username', 'ip'].filter(key => listQuery[key]).length)

  const readJson = (key, fallback = null) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback
    } catch (_) {
      return fallback
    }
  }

  const syncQueryState = () => {
    const query = {}
    Object.entries(listQuery).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined && !(key === 'page' && value === 1) && !(key === 'page_size' && value === 10)) {
        query[key] = String(value)
      }
    })
    if (sortState.prop && sortState.order) {
      query.sort = sortState.prop
      query.order = sortState.order
    }
    if (selectedPeer.value?.row_id && detailVisible.value) query.device = String(selectedPeer.value.row_id)
    router.replace({ query })
  }

  const restoreQueryState = () => {
    Object.assign(listQuery, {
      page: 1,
      page_size: 10,
      time_ago: null,
      id: '',
      hostname: '',
      username: '',
      ip: '',
    })
    sortState.prop = ''
    sortState.order = ''
    const stringKeys = ['id', 'hostname', 'username', 'ip']
    stringKeys.forEach(key => {
      if (route.query[key] !== undefined) listQuery[key] = String(route.query[key])
    })
    ;['page', 'page_size', 'time_ago'].forEach(key => {
      if (route.query[key] !== undefined && !Number.isNaN(Number(route.query[key]))) listQuery[key] = Number(route.query[key])
    })
    if (route.query.sort && route.query.order) {
      sortState.prop = String(route.query.sort)
      sortState.order = String(route.query.order)
    }
    advancedFiltersVisible.value = advancedFilterCount.value > 0
  }

  const getList = async () => {
    listRes.loading = true
    const res = await list(listQuery).catch(_ => false)
    listRes.loading = false
    if (res) {
      listRes.list = res.data.list
      listRes.total = res.data.total
      if (route.query.device && !detailVisible.value) {
        const rowId = Number(route.query.device)
        const inPage = listRes.list.find(item => item.row_id === rowId)
        if (inPage) {
          selectedPeer.value = inPage
          detailVisible.value = true
        } else if (rowId) {
          const detailResponse = await detail(rowId).catch(() => false)
          if (detailResponse) {
            selectedPeer.value = detailResponse.data
            detailVisible.value = true
          }
        }
      }
    }
  }
  const handlerQuery = () => {
    if (listQuery.page === 1) {
      getList()
    } else {
      listQuery.page = 1
    }
    syncQueryState()
  }
  const resetQuery = () => {
    listQuery.time_ago = null
    listQuery.id = ''
    listQuery.hostname = ''
    listQuery.username = ''
    listQuery.ip = ''
    advancedFiltersVisible.value = false
    handlerQuery()
  }

  const openDetails = (row, column) => {
    if (column?.type === 'selection') return
    selectedPeer.value = row
    detailVisible.value = true
    syncQueryState()
  }
  const handleDetailVisibility = (visible) => {
    if (!visible) {
      detailVisible.value = false
      selectedPeer.value = null
      syncQueryState()
    }
  }
  const isPeerOnline = (peer) => peer?.last_online_time && timeDis(peer.last_online_time) < 60
  const getGroupName = (groupId) => groupListRes.list?.find(group => group.id === groupId)?.name || ''

  const del = async (row) => {
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
  }
  onMounted(() => {
    restoreQueryState()
    restoreViewPreferences()
    getList()
  })
  onActivated(() => {
    restoreQueryState()
    restoreViewPreferences()
    getList()
  })

  watch(() => listQuery.page, () => {
    getList()
    syncQueryState()
  })

  watch(() => listQuery.page_size, handlerQuery)

  const formVisible = ref(false)
  const formData = reactive({
    row_id: 0,
    group_id: null,
    cpu: '',
    hostname: '',
    id: '',
    memory: '',
    os: '',
    username: '',
    uuid: '',
    version: '',
  })

  const toEdit = (row) => {
    formVisible.value = true
    //将row中的数据赋值给formData
    Object.keys(formData).forEach(key => {
      formData[key] = row[key]
    })
  }
  const toAdd = () => {
    formVisible.value = true
    //重置formData
    formData.row_id = 0
    formData.cpu = ''
    formData.hostname = ''
    formData.id = ''
    formData.memory = ''
    formData.os = ''
    formData.username = ''
    formData.uuid = ''
    formData.version = ''
  }
  const submit = async () => {
    const api = formData.row_id ? update : create
    const res = await api(formData).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      formVisible.value = false
      getList()
    }
  }

  const timeDis = (time) => {
    let now = new Date().getTime()
    let after = new Date(time * 1000).getTime()
    return (now - after) / 1000
  }

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

  const showImport = ref(false)
  const canKeys = ['id', 'cpu', 'hostname', 'memory', 'os', 'username', 'uuid', 'version', 'group_id']
  const parseCsv = (file) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const data = e.target.result
      console.log(data)
      //组装数据
      const rows = data.split('\n')
      const keys = rows[0].split(',')
      console.log(keys, rows.slice(1).map(row => row.split(',')))
      const values = rows.slice(1).map(row => {
        const obj = {}
        row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).forEach((v, i) => {
          //去掉两边的"
          obj[keys[i]] = v.trim().replace(/^"|"$/g, '')
        })
        return obj
      }).filter(item => item.id)
      // console.log(values)
      //移除不需要的key
      values.forEach(item => {
        item.group_id = parseInt(item.group_id)
        Object.keys(item).forEach(key => {
          if (!canKeys.includes(key)) {
            delete item[key]
          }
        })
      })
      console.log(values)
      const pa = []
      values.map(item => {
        pa.push(create(item))
      })
      const res = await Promise.all(pa).catch(_ => false)
      if (res) {
        ElMessage.success(T('OperationSuccess'))
        getList()
      }

    }
    reader.readAsText(file)
    return false
  }
  const toImport = () => {
    ElMessage.warning(T('FeatureNotImplemented'))
  }

  const ABFormVisible = ref(false)
  const clickRow = ref({})
  const toAddressBook = (row) => {
    clickRow.value = row
    ABFormVisible.value = true
  }

  const multipleSelection = ref([])
  const handleSelectionChange = (val) => {
    multipleSelection.value = val
  }
  const toBatchDelete = async () => {
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
  }

  // 批量添加到地址簿 start
  const { allUsers, getAllUsers } = loadAllUsers()
  onMounted(getAllUsers)
  const {
    listRes: collectionListResForBatchCreateAB,
    listQuery: collectionListQueryForBatchCreateAB,
    getList: getCollectionListForBatchCreateAB,
  } = useCollectionRepositories('admin')
  collectionListQueryForBatchCreateAB.page_size = 9999
  const changeUserForBatchCreateAB = (val) => {
    batchABFormData.value.collection_id = 0
    collectionListQueryForBatchCreateAB.user_id = val
    getCollectionListForBatchCreateAB()
  }
  const batchABFormVisible = ref(false)
  const toBatchAddToAB = () => {
    batchABFormVisible.value = true
  }
  const batchABFormData = ref({
    collection_id: 0,
    tags: [],
    peer_ids: [],
    user_id: null,
  })
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
  // 批量添加到地址簿 end

  const columnSettingVisible = ref(false)
  const allColumns = [
    { name: 'cpu', visible: false, label: 'Cpu' },
    { name: 'memory', visible: false, label: 'Memory' },
    { name: 'last_online_ip', visible: false, label: 'LastOnlineIp' },
    { name: 'uuid', visible: false, label: 'Uuid' },
    { name: 'version', visible: false, label: 'Version' },
    { name: 'alias', visible: false, label: 'Alias' },
    { name: 'created_at', visible: false, label: 'CreatedAt' },
    { name: 'updated_at', visible: false, label: 'UpdatedAt' },
  ]
  const createDefaultColumns = () => allColumns.map(column => ({ ...column }))
  const visibleColumns = ref(createDefaultColumns())
  const optionalVisibleColumns = computed(() => visibleColumns.value.filter(column => column.visible))

  const normalizeColumns = (storedColumns) => {
    if (!Array.isArray(storedColumns)) return createDefaultColumns()
    const validNames = new Set(allColumns.map(column => column.name))
    const normalized = storedColumns
      .filter(column => validNames.has(column.name))
      .map(column => ({ ...allColumns.find(item => item.name === column.name), visible: Boolean(column.visible) }))
    allColumns.forEach(column => {
      if (!normalized.some(item => item.name === column.name)) normalized.push({ ...column })
    })
    return normalized
  }

  const restoreViewPreferences = () => {
    const storedColumns = readJson(columnSettingKey.value)
    visibleColumns.value = normalizeColumns(storedColumns)
    const savedView = readJson(savedViewKey.value)
    hasSavedView.value = Boolean(savedView)
    if (route.query.sort && route.query.order) {
      nextTick(() => tableRef.value?.sort(sortState.prop, sortState.order))
    }
  }

  const handleSortChange = ({ prop, order }) => {
    sortState.prop = prop || ''
    sortState.order = order || ''
    activeView.value = 'default'
    syncQueryState()
  }

  const saveCurrentView = () => {
    const view = {
      filters: {
        id: listQuery.id,
        hostname: listQuery.hostname,
        time_ago: listQuery.time_ago,
        username: listQuery.username,
        ip: listQuery.ip,
      },
      columns: visibleColumns.value,
      density: tableDensity.value,
      sort: { ...sortState },
    }
    localStorage.setItem(savedViewKey.value, JSON.stringify(view))
    localStorage.setItem(columnSettingKey.value, JSON.stringify(visibleColumns.value))
    hasSavedView.value = true
    activeView.value = 'saved'
    ElMessage.success(T('ViewSaved'))
  }

  const applySelectedView = () => {
    if (activeView.value === 'saved') {
      const savedView = readJson(savedViewKey.value)
      if (!savedView) return
      Object.assign(listQuery, { page: 1, ...savedView.filters })
      visibleColumns.value = normalizeColumns(savedView.columns)
      tableDensity.value = savedView.density === 'compact' ? 'compact' : 'comfortable'
      Object.assign(sortState, savedView.sort || { prop: '', order: '' })
      advancedFiltersVisible.value = advancedFilterCount.value > 0
      nextTick(() => {
        tableRef.value?.clearSort()
        if (sortState.prop && sortState.order) tableRef.value?.sort(sortState.prop, sortState.order)
      })
    } else {
      Object.assign(listQuery, { page: 1, page_size: 10, time_ago: null, id: '', hostname: '', username: '', ip: '' })
      visibleColumns.value = createDefaultColumns()
      tableDensity.value = 'comfortable'
      sortState.prop = ''
      sortState.order = ''
      advancedFiltersVisible.value = false
      nextTick(() => tableRef.value?.clearSort())
    }
    handlerQuery()
  }
  const showColumnSetting = () => {
    columnSettingVisible.value = true
  }
  const saveColumnSetting = () => {
    localStorage.setItem(columnSettingKey.value, JSON.stringify(visibleColumns.value))
    activeView.value = 'default'
    ElMessage.success(T('OperationSuccess'))
    columnSettingVisible.value = false
  }

  const upColumn = (index) => {
    if (index === 0) return
    const col = visibleColumns.value[index]
    visibleColumns.value.splice(index, 1)
    visibleColumns.value.splice(index - 1, 0, col)

  }
  const downColumn = (index) => {
    if (index === visibleColumns.value.length - 1) return
    const col = visibleColumns.value[index]
    visibleColumns.value.splice(index, 1)
    visibleColumns.value.splice(index + 1, 0, col)

  }
</script>

<style scoped lang="scss">
.device-filter-card {
  border-radius: 7px;
}

.device-filter-card :deep(.el-card__body) {
  padding: 14px 16px;
}

.device-filter-toolbar,
.device-filter-primary,
.device-filter-actions,
.list-table-tools,
.batch-action-bar,
.batch-action-bar > div {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-filter-toolbar {
  justify-content: space-between;
  min-width: 0;
}

.device-filter-primary {
  flex: 1 1 auto;
  min-width: 0;
}

.device-filter-primary .el-input {
  width: min(220px, 22vw);
}

.device-filter-actions {
  flex: 0 0 auto;
}

.device-filter-advanced {
  display: grid;
  grid-template-columns: repeat(3, minmax(180px, 1fr));
  gap: 12px;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid var(--console-border);
}

.device-filter-advanced label,
.device-filter-advanced label > span {
  display: block;
}

.device-filter-advanced label > span {
  margin-bottom: 6px;
  color: var(--console-text);
  font-size: 12px;
  font-weight: 700;
}

.device-filter-advanced .el-select,
.device-filter-advanced .el-input {
  width: 100%;
}

.is-filter-active {
  color: var(--console-primary);
  background: var(--console-primary-soft);
  border-color: var(--console-primary-border);
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.device-list-card {
  margin-top: 12px;
}

.saved-view-select {
  width: 138px;
}

.density-select {
  width: 112px;
}

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

.device-table :deep(.el-table__row) {
  cursor: pointer;
}

.device-table.is-compact :deep(td.el-table__cell) {
  height: 38px;
  padding-top: 2px;
  padding-bottom: 2px;
}

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

.device-owner-cell {
  min-width: 0;
}

.device-owner-cell strong,
.device-owner-cell span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-owner-cell strong {
  color: var(--console-text);
  font-size: 13px;
}

.device-owner-cell span {
  margin-top: 2px;
  color: var(--console-muted);
  font-size: 11px;
}

@media (max-width: 1100px) {
  .device-filter-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .device-filter-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 760px) {
  .device-filter-primary,
  .device-filter-actions,
  .list-table-tools {
    flex-wrap: wrap;
  }

  .device-filter-primary .el-input {
    width: calc(50% - 4px);
  }

  .device-filter-primary .el-button,
  .device-filter-actions .el-button {
    flex: 1 1 auto;
  }

  .device-filter-advanced {
    grid-template-columns: minmax(0, 1fr);
  }

  .list-table-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .list-table-tools > .el-select {
    flex: 1 1 120px;
  }

  .batch-action-bar {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 480px) {
  .device-filter-primary .el-input { width: 100%; }
  .device-filter-actions { justify-content: stretch; }
}
</style>
