<template>
  <div>
    <QueryToolbar class="list-query" shadow="hover" :query="listQuery" fields="peer_id,from_peer" @query="handlerQuery">
      <el-form inline label-width="80px">
        <el-form-item :label="T('Peer')">
          <el-input v-model="listQuery.peer_id" clearable class="query-search-field" :placeholder="T('Peer')" :aria-label="T('Peer')"></el-input>
        </el-form-item>
        <el-form-item :label="T('FromPeer')">
          <el-input v-model="listQuery.from_peer" clearable class="query-search-field" :placeholder="T('FromPeer')" :aria-label="T('FromPeer')"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button class="query-submit" type="primary" @click="handlerQuery">{{ T('Filter') }}</el-button>
          <InlineConfirmButton show-label :label="T('BatchDelete')" :confirm-key="multipleSelection.map(item => item.row_id || item.id).join(',')" :action="() => toBatchDelete()"/>
          <el-tooltip :content="T('Export')"><el-button type="info" plain @click="toExport" :icon="ToolbarDownload" :aria-label="T('Export')"><span class="query-action-label">{{ T('Export') }}</span></el-button></el-tooltip>
        </el-form-item>
      </el-form>
    </QueryToolbar>
    <el-card class="list-body" shadow="hover">
      <el-table :data="listRes.list" v-loading="listRes.loading" border @selection-change="handleSelectionChange">
        <el-table-column type="selection" align="center" width="50" fixed="left"/>
        <el-table-column prop="id" label="ID" align="center" width="100" fixed="left"/>
        <el-table-column :label="T('Peer')" prop="peer_id" align="center" width="120"/>
        <el-table-column :label="T('FromPeer')" prop="from_peer" align="center" width="120"/>
        <el-table-column :label="T('FromName')" prop="from_name" align="center" width="120"/>
        <el-table-column :label="T('Ip')" prop="ip" align="center" width="120"/>
        <el-table-column pop="type" :label="T('Type')" align="center" width="120">
          <template #default="{row}">
            <el-tag v-if="row.type === 1" type="warning">{{ T('File') }}</el-tag>
            <el-tag v-else>{{ T('Common') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="uuid" label="uuid" align="center" width="120" show-overflow-tooltip/>
        <el-table-column prop="created_at" :label="T('CreatedAt')" align="center"/>
        <el-table-column :label="T('CloseTime')" prop="close_time" align="center"/>
        <el-table-column :label="T('Actions')" align="center" width="120" class-name="table-actions" fixed="right">
          <template #default="{row}">
            <InlineConfirmButton circle size="small" :label="T('Delete')" :confirm-key="row.row_id || row.id" :action="() => del(row)"/>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card class="list-page" shadow="hover">
      <el-pagination background
                     layout="prev, pager, next, sizes, jumper"
                     :page-sizes="[10,20,50,100]"
                     v-model:page-size="listQuery.page_size"
                     v-model:current-page="listQuery.page"
                     :total="listRes.total">
      </el-pagination>
    </el-card>
  </div>
</template>

<script setup>
import { Download as ToolbarDownload } from '@element-plus/icons-vue'
import QueryToolbar from '@/components/QueryToolbar.vue'
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
  import { onActivated, onMounted, ref, watch } from 'vue'
  import { useRepositories } from '@/views/audit/reponsitories'
  import { T } from '@/utils/i18n'

  const {
    listRes,
    listQuery,
    getList,
    handlerQuery,
    del,
    batchdel,
    toExport,
  } = useRepositories()

  onMounted(getList)
  onActivated(getList)

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)
  const multipleSelection = ref([])
  const handleSelectionChange = (val) => {
    multipleSelection.value = val
  }
  const toBatchDelete = () => {
    if (multipleSelection.value.length === 0) {
      return
    }
    return batchdel(multipleSelection.value)
  }
</script>

<style scoped lang="scss">

</style>
