<template>
  <div>
    <QueryToolbar class="list-query" shadow="hover" :query="listQuery" fields="user_id,collection_id" @query="handlerQuery">
      <el-form inline label-width="120px">
        <el-form-item :label="T('Owner')">
          <el-select v-model="listQuery.user_id" clearable @change="changeUser">
            <el-option
                v-for="item in allUsers"
                :key="item.id"
                :label="item.username"
                :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('AddressBookName')">
          <el-select v-model="listQuery.collection_id" clearable>
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListRes.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button class="query-submit" type="primary" @click="handlerQuery">{{ T('Filter') }}</el-button>
          <el-tooltip :content="T('Add')"><el-button :icon="ToolbarPlus" type="success" @click="toAdd" :aria-label="T('Add')"><span class="query-action-label">{{ T('Add') }}</span></el-button></el-tooltip>
        </el-form-item>
      </el-form>
    </QueryToolbar>
    <el-card class="list-body" shadow="hover">
      <el-table :data="listRes.list" v-loading="listRes.loading" border stripe scrollbar-always-on>
        <el-table-column prop="id" label="ID" align="center" width="90" fixed="left" sortable/>
        <el-table-column prop="user_id" :label="T('Owner')" sortable>
          <template #default="{row}">
            <span v-if="row.user_id"> <el-tag>{{ allUsers?.find(u => u.id === row.user_id)?.username }}</el-tag> </span>
          </template>
        </el-table-column>
        <el-table-column prop="collection_id" :label="T('AddressBookName')" width="180" sortable>
          <template #default="{row}">
            <span v-if="row.collection_id === 0">{{ T('MyAddressBook') }}</span>
            <span v-else>{{ row.collection?.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" :label="T('Name')" sortable/>
        <el-table-column prop="color" :label="T('Color')" align="center">
          <template #default="{row}">
            <div class="colors">
              <div style="background-color: var(--tag-bg-color)" class="colorbox">
                <div :style="{backgroundColor: row.color}" class="dot">
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
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
    <el-dialog v-model="formVisible" :title="`${formData.id ? T('Edit') : T('Add')} · ${T('TagsManage')}`" width="640">
      <el-form class="dialog-form" ref="form" :model="formData" label-width="120px">
        <el-form-item :label="T('Owner')" prop="user_id" required>
          <el-select v-model="formData.user_id" @change="changeUserForUpdate">
            <el-option
                v-for="item in allUsers"
                :key="item.id"
                :label="item.username"
                :value="item.id"
            ></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('AddressBookName')" prop="collection_id" required>
          <el-select v-model="formData.collection_id" clearable>
            <el-option :value="0" :label="T('MyAddressBook')"></el-option>
            <el-option v-for="c in collectionListResForUpdate.list" :key="c.id" :label="c.name" :value="c.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item :label="T('Name')" prop="name" required>
          <el-input v-model="formData.name"></el-input>
        </el-form-item>
        <el-form-item :label="T('Color')" prop="color" required>
          <el-color-picker v-model="formData.color" show-alpha @active-change="activeChange"></el-color-picker>
          <div class="colors">
            <div style="background-color: var(--tag-bg-color)" class="colorbox">
              <div :style="{backgroundColor: currentColor}" class="dot">
              </div>
            </div>
          </div>
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
  import { useRepositories } from '@/views/tag/index'
  import { T } from '@/utils/i18n'
  import { loadAllUsers } from '@/global'
  import { Delete, Edit } from '@element-plus/icons-vue'

  const { allUsers, getAllUsers } = loadAllUsers()
  onMounted(getAllUsers)
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
    activeChange,
    currentColor,

    collectionListRes,
    changeUser,
    // getCollectionList,

    collectionListResForUpdate,
    changeUserForUpdate,
    // getCollectionListForUpdate,
  } = useRepositories('admin')

  onMounted(getList)
  onActivated(getList)

  watch(() => listQuery.page, getList)

  watch(() => listQuery.page_size, handlerQuery)


</script>

<style scoped lang="scss">
.list-query .el-select {
  --el-select-width: 160px;
}

.colors {
  display: flex;
  justify-content: center;
  align-items: center;

  .colorbox {
    width: 50px;
    height: 30px;
    display: flex;
    justify-content: center;
    align-items: center;

    .dot {
      width: 10px;
      height: 10px;
      display: block;
      border-radius: 50%;
    }
  }

}

</style>
