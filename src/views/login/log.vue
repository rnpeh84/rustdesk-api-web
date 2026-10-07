<!--
#####################################################
# 화면정보 : 시스템 > 로그인 로그                   #
#####################################################
-->
<template>
  <div>
    <QueryToolbar class="list-query" shadow="hover" :query="listQuery" fields="user_id" @query="handlerQuery">
      <el-form inline label-width="80px">
        <el-form-item :label="T('User')">
          <el-select v-model="listQuery.user_id" clearable>
            <el-option
                v-for="item in allUsers"
                :key="item.id"
                :label="item.username"
                :value="item.id"
            ></el-option>
          </el-select>
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
        <el-table-column :label="T('Owner')" align="center" width="120">
          <template #default="{row}">
            <span v-if="row.user_id"> <el-tag>{{ allUsers?.find(u => u.id === row.user_id)?.username }}</el-tag> </span>
          </template>
        </el-table-column>
        <el-table-column prop="client" label="client" align="center" width="120"/>
        <el-table-column prop="peer.id" :label="T('Peer')" align="center">
          <template #default="{row}">
            {{ row.device_id ? row.device_id : peer?.id }}
          </template>
        </el-table-column>
        <el-table-column prop="uuid" label="uuid" align="center"/>
        <el-table-column prop="ip" label="ip" align="center" width="150"/>
        <el-table-column prop="type" label="type" align="center" width="100"/>
        <el-table-column prop="platform" label="Platform/UA" align="center" width="120" show-overflow-tooltip/>
        <el-table-column prop="created_at" :label="T('CreatedAt')" align="center"/>
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
  import { loadAllUsers } from '@/global'
  import { useRepositories } from '@/views/login/log.js'
  import { T } from '@/utils/i18n'
  import { list } from '@/api/peer'
  import { downBlob, jsonToCsv } from '@/utils/file'

  const { allUsers, getAllUsers } = loadAllUsers()
  getAllUsers()

  const {
    listRes,
    listQuery,
    getList,
    handlerQuery,
    del,
    batchdel,
    toExport,
  } = useRepositories('admin')

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
.list-query .el-select {
  --el-select-width: 160px;
}


</style>
