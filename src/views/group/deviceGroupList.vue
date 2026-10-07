<template>
  <div>
    <QueryToolbar class="list-query" shadow="hover" :query="listQuery" fields="" @query="handlerQuery">
      <el-form inline label-width="80px">
        <!--        <el-form-item label="名称">
                  <el-input v-model="listQuery.name"></el-input>
                </el-form-item>-->
        <el-form-item>
          <el-button class="query-submit" type="primary" @click="handlerQuery">{{ T('Filter') }}</el-button>
          <el-tooltip :content="T('Add')"><el-button :icon="ToolbarPlus" type="success" @click="toAdd" :aria-label="T('Add')"><span class="query-action-label">{{ T('Add') }}</span></el-button></el-tooltip>
        </el-form-item>
      </el-form>
    </QueryToolbar>
    <el-card class="list-body" shadow="hover">
      <el-table :data="listRes.list" v-loading="listRes.loading" border stripe scrollbar-always-on>
        <el-table-column prop="id" label="ID" align="center" width="90" fixed="left" sortable/>
        <el-table-column prop="name" :label="T('Name')" sortable/>
        <el-table-column prop="created_at" :label="T('CreatedAt')" align="center" sortable/>
        <el-table-column prop="updated_at" :label="T('UpdatedAt')" align="center" sortable/>
        <el-table-column :label="T('Actions')" align="center" width="112" class-name="table-actions" fixed="right">
          <template #default="{row}">
            <el-tooltip :content="T('Edit')"><el-button circle size="small" :aria-label="T('Edit')" @click="toEdit(row)"><el-icon><Edit/></el-icon></el-button></el-tooltip>
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
    <el-dialog v-model="formVisible" :title="`${formData.id ? T('Edit') : T('Add')} · ${T('DeviceGroupManage')}`" width="640">
      <el-form class="dialog-form" ref="form" :model="formData" label-width="120px">
        <el-form-item :label="T('Name')" prop="name" required>
          <el-input v-model="formData.name"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="formVisible = false">{{ T('Cancel') }}</el-button>
          <el-button @click="submit" type="primary">{{ T('Submit') }}</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup>
import QueryToolbar from '@/components/QueryToolbar.vue'
import { Plus as ToolbarPlus } from '@element-plus/icons-vue'
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
  import { onMounted, reactive, watch, ref, onActivated } from 'vue'
  import { list, create, update, detail, remove } from '@/api/device_group'
  import { ElMessage } from 'element-plus'
  import { T } from '@/utils/i18n'
  import { Delete, Edit } from '@element-plus/icons-vue'

  const listRes = reactive({
    list: [], total: 0, loading: false,
  })
  const listQuery = reactive({
    page: 1,
    page_size: 10,
  })

  const getList = async () => {
    listRes.loading = true
    const res = await list(listQuery).catch(_ => false)
    listRes.loading = false
    if (res) {
      listRes.list = res.data.list
      listRes.total = res.data.total
    }
  }
  const handlerQuery = () => {
    if (listQuery.page === 1) {
      getList()
    } else {
      listQuery.page = 1
    }
  }

  const del = async (row) => {
    const res = await remove({ id: row.id }).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      getList()
    }
  }
  onMounted(getList)
  onActivated(getList)

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)

  const formVisible = ref(false)
  const formData = reactive({
    id: 0,
    name: '',
    type: 1,
  })

  const toEdit = (row) => {
    formVisible.value = true
    formData.id = row.id
    formData.name = row.name
    formData.type = row.type
  }
  const toAdd = () => {
    formVisible.value = true
    formData.id = 0
    formData.name = ''
    formData.type = 1
  }
  const submit = async () => {
    const api = formData.id ? update : create
    const res = await api(formData).catch(_ => false)
    if (res) {
      ElMessage.success(T('OperationSuccess'))
      formVisible.value = false
      getList()
    }
  }

</script>

<style scoped lang="scss">

</style>
