<template>
  <div>
    <el-card class="list-query" shadow="never">
      <el-form inline @keyup.enter="handlerQuery">
        <el-form-item :label="T('Username')">
          <el-input v-model="listQuery.username" name="user-search" clearable autocomplete="off" spellcheck="false" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handlerQuery">{{ T('Filter') }}</el-button>
          <el-button plain @click="resetQuery">{{ T('Reset') }}</el-button>
          <el-button type="success" @click="openCreate">{{ T('Add') }}</el-button>
          <el-button type="info" plain @click="toExport">{{ T('Export') }}</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="list-body" shadow="never">
      <div class="list-table-toolbar">
        <div class="list-table-summary" aria-live="polite">
          <strong>{{ T('ResultsCount', { param: listRes.total }) }}</strong>
        </div>
      </div>
      <el-table :data="listRes.list" v-loading="listRes.loading" border scrollbar-always-on>
        <el-table-column prop="id" label="ID" align="center" width="90" fixed="left" sortable />
        <el-table-column prop="username" :label="T('Username')" min-width="140" sortable show-overflow-tooltip />
        <el-table-column prop="email" :label="T('Email')" min-width="180" sortable show-overflow-tooltip />
        <el-table-column prop="nickname" :label="T('Nickname')" min-width="130" sortable show-overflow-tooltip />
        <el-table-column prop="group_id" :label="T('Group')" min-width="130" sortable>
          <template #default="{row}">
            <el-tag v-if="row.group_id" effect="plain">{{ displayGroupName(listRes.groups?.find(g => g.id === row.group_id)) }}</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" :label="T('Status')" align="center" width="96" sortable>
          <template #default="{row}">
            <el-switch
              v-model="row.status"
              :active-value="ENABLE_STATUS"
              :inactive-value="DISABLE_STATUS"
              :aria-label="`${row.username} ${T('Status')}`"
              @change="changeStatus(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="remark" :label="T('Remark')" min-width="140" sortable show-overflow-tooltip />
        <el-table-column prop="created_at" :label="T('CreatedAt')" min-width="160" sortable />
        <el-table-column prop="updated_at" :label="T('UpdatedAt')" min-width="160" sortable />
        <el-table-column :label="T('Actions')" align="center" width="152" class-name="table-actions" fixed="right">
          <template #default="{row}">
            <el-tooltip :content="T('Edit')">
              <el-button circle :icon="Edit" :aria-label="T('Edit')" @click="openEdit(row)" />
            </el-tooltip>
            <el-tooltip :content="T('ResetPassword')">
              <el-button circle type="warning" plain :icon="Key" :aria-label="T('ResetPassword')" @click="openPasswordReset(row)" />
            </el-tooltip>
            <el-dropdown trigger="click">
              <el-button circle :icon="MoreFilled" :aria-label="T('More')" />
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item :icon="CollectionTag" @click="toTag(row)">{{ T('UserTags') }}</el-dropdown-item>
                  <el-dropdown-item :icon="Notebook" @click="toAddressBook(row)">{{ T('UserAddressBook') }}</el-dropdown-item>
                  <el-dropdown-item class="dropdown-danger" :icon="Delete" divided @click="remove(row)">{{ T('Delete') }}</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="list-page" shadow="never">
      <el-pagination
        v-model:page-size="listQuery.page_size"
        v-model:current-page="listQuery.page"
        background
        layout="prev, pager, next, sizes, jumper"
        :page-sizes="[10,20,50,100]"
        :total="listRes.total"
      />
    </el-card>

    <user-form-dialog v-model:visible="userDialogVisible" :user-id="selectedUserId" @saved="getList" />
    <reset-password-dialog v-model:visible="passwordDialogVisible" :user="selectedUser" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { CollectionTag, Delete, Edit, Key, MoreFilled, Notebook } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRepositories, useDel, useToEditOrAdd } from '@/views/user/composables'
import { T } from '@/utils/i18n'
import { displayGroupName } from '@/utils/group'
import { DISABLE_STATUS, ENABLE_STATUS } from '@/utils/common_options'
import { update } from '@/api/user'
import UserFormDialog from '@/views/user/UserFormDialog.vue'
import ResetPasswordDialog from '@/views/user/ResetPasswordDialog.vue'

const { listRes, listQuery, handlerQuery, getList, getGroups, toExport } = useRepositories()
const { toAddressBook, toTag } = useToEditOrAdd()
const { del } = useDel()
const userDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const selectedUserId = ref(0)
const selectedUser = ref(null)

onMounted(getGroups)
onMounted(getList)
watch(() => listQuery.page, getList)
watch(() => listQuery.page_size, handlerQuery)

const resetQuery = () => {
  listQuery.username = ''
  handlerQuery()
}
const openCreate = () => {
  selectedUserId.value = 0
  userDialogVisible.value = true
}
const openEdit = row => {
  selectedUserId.value = row.id
  userDialogVisible.value = true
}
const openPasswordReset = row => {
  selectedUser.value = row
  passwordDialogVisible.value = true
}
const remove = async row => {
  const res = await del(row.id)
  if (res) getList()
}
const changeStatus = async row => {
  const res = await update(row).catch(() => false)
  if (!res) return
  ElMessage.success(T('OperationSuccess'))
  getList()
}
</script>
