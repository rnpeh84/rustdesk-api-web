<template>
  <div>
    <QueryToolbar class="list-query" shadow="hover" :query="listQuery" fields="" @query="handlerQuery">
      <el-form inline label-width="80px">
        <el-form-item>
          <el-button class="query-submit" type="primary" @click="handlerQuery">{{ T('Filter') }}</el-button>
          <el-tooltip :content="T('Add')"><el-button :icon="ToolbarPlus" type="success" @click="toAdd" :aria-label="T('Add')"><span class="query-action-label">{{ T('Add') }}</span></el-button></el-tooltip>
          <el-tooltip :content="T('ManageSharing')"><router-link class="query-navigation" :aria-label="T('ManageSharing')" to="/my/sharing?kind=address_book"><el-icon aria-hidden="true"><Share /></el-icon></router-link></el-tooltip>
        </el-form-item>
      </el-form>
    </QueryToolbar>
    <el-card class="list-body" shadow="hover">
      <p class="collection-help">{{ T('AddressBookSharingGuide') }}</p>
      <el-table :data="list" v-loading="listRes.loading" border stripe scrollbar-always-on>
        <!--        <el-table-column prop="id" label="ID" align="center"/>-->
        <el-table-column prop="name" :label="T('Name')" sortable/>
        <el-table-column prop="created_at" :label="T('CreatedAt')" align="center" sortable/>
        <!--        <el-table-column prop="updated_at" label="更新时间" align="center"/>-->
        <el-table-column :label="T('Actions')" align="center" class-name="table-actions" width="220" fixed="right">
          <template #default="{row}">
            <template v-if="row.id>0">
              <el-tooltip :content="T('Share')"><el-button circle size="small" type="primary" plain :aria-label="T('Share')" @click="showRules(row)"><el-icon aria-hidden="true"><Share/></el-icon></el-button></el-tooltip>
              <el-tooltip :content="T('Edit')"><el-button circle size="small" :aria-label="T('Edit')" @click="toEdit(row)"><el-icon><Edit/></el-icon></el-button></el-tooltip>
              <InlineConfirmButton circle size="small" :label="T('Delete')" :confirm-key="row.row_id || row.id" :action="() => del(row)"/>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="T('NoAddressBooks')">
            <el-button type="primary" @click="toAdd">{{ T('CreateAddressBook') }}</el-button>
          </el-empty>
        </template>
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
    <el-dialog v-model="formVisible" width="640" :title="`${formData.id ? T('Edit') : T('Add')} · ${T('AddressBookName')}`">
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
    <AddressBookShareDialog v-model="rulesVisible" :collection="clickRow" @saved="getList"/>

  </div>
</template>

<script setup>
import QueryToolbar from '@/components/QueryToolbar.vue'
import { Plus as ToolbarPlus } from '@element-plus/icons-vue'
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
  import { T } from '@/utils/i18n'
  import { computed, ref } from 'vue'
  import { useRepositories } from '@/views/address_book/collection'
  import { onActivated, onMounted, watch } from 'vue'
  import AddressBookShareDialog from '@/components/device/AddressBookShareDialog.vue'
  import { Delete, Edit, Share } from '@element-plus/icons-vue'

  const {
    listRes,
    listQuery,
    getList,
    handlerQuery,
    del,
    formVisible,
    formData,
    toEdit,
    toAdd,
    submit,
  } = useRepositories('my')

  onMounted(getList)

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)
  const list = computed(_ => {
    if (listQuery.page > 1) {
      return listRes.list
    } else {
      return [
        { id: 0, name: T('MyAddressBook') },
        ...listRes.list,
      ]
    }
  })
  const clickRow = ref({})
  const rulesVisible = ref(false)
  const showRules = (row) => {
    clickRow.value = row
    rulesVisible.value = true
  }

</script>

<style scoped lang="scss">
.collection-help { display: block; color: var(--el-text-color-secondary); line-height: 1.6; margin: 8px 0 16px; }
</style>
