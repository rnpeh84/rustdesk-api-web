<template>
  <el-dialog
    v-model="dialogVisible"
    class="console-dialog"
    :title="T(isEdit ? 'UserEdit' : 'UserAdd')"
    width="720"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <p class="dialog-description">{{ T(isEdit ? 'UserEditDescription' : 'UserAddDescription') }}</p>
    <el-form
      ref="formRef"
      v-loading="loading"
      class="dialog-form dialog-form--grid"
      label-position="top"
      :model="form"
      :rules="rules"
    >
      <el-form-item :label="T('Username')" prop="username">
        <el-input v-model="form.username" name="username" autocomplete="off" spellcheck="false" />
      </el-form-item>
      <el-form-item :label="T('Email')" prop="email">
        <el-input v-model="form.email" name="email" type="email" autocomplete="off" spellcheck="false" />
      </el-form-item>
      <el-form-item :label="T('Nickname')" prop="nickname">
        <el-input v-model="form.nickname" name="nickname" autocomplete="off" />
      </el-form-item>
      <el-form-item :label="T('Group')" prop="group_id">
        <el-select v-model="form.group_id" :placeholder="T('PleaseSelect')">
          <el-option v-for="item in groupsList" :key="item.id" :label="displayGroupName(item)" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item class="dialog-form__wide" :label="T('Remark')" prop="remark">
        <el-input v-model="form.remark" name="remark" autocomplete="off" />
      </el-form-item>
      <div class="dialog-switches dialog-form__wide">
        <div class="dialog-switch-row">
          <span><strong>{{ T('IsAdmin') }}</strong><small>{{ T('AdministratorDescription') }}</small></span>
          <el-switch v-model="form.is_admin" :aria-label="T('IsAdmin')" />
        </div>
        <div class="dialog-switch-row">
          <span><strong>{{ T('Status') }}</strong><small>{{ T('UserStatusDescription') }}</small></span>
          <el-switch v-model="form.status" :active-value="ENABLE_STATUS" :inactive-value="DISABLE_STATUS" :aria-label="T('Status')" />
        </div>
      </div>
    </el-form>
    <template #footer>
      <div class="dialog-actions">
        <el-button @click="dialogVisible = false">{{ T('Cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">{{ T(isEdit ? 'SaveChanges' : 'CreateUser') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { create, detail, update } from '@/api/user'
import { list as groups } from '@/api/group'
import { DISABLE_STATUS, ENABLE_STATUS } from '@/utils/common_options'
import { T } from '@/utils/i18n'
import { displayGroupName } from '@/utils/group'

const props = defineProps({ visible: Boolean, userId: { type: Number, default: 0 } })
const emit = defineEmits(['update:visible', 'saved'])
const formRef = ref(null)
const groupsList = ref([])
const loading = ref(false)
const submitting = ref(false)
const isEdit = computed(() => props.userId > 0)
const dialogVisible = computed({ get: () => props.visible, set: value => emit('update:visible', value) })
const emptyForm = () => ({ id: 0, username: '', email: '', nickname: '', group_id: null, is_admin: false, status: ENABLE_STATUS, remark: '' })
const form = reactive(emptyForm())
const rules = computed(() => ({
  username: [{ required: true, message: T('ParamRequired', { param: T('Username') }), trigger: 'blur' }],
  group_id: [{ required: true, message: T('ParamRequired', { param: T('Group') }), trigger: 'change' }],
  status: [{ required: true, message: T('ParamRequired', { param: T('Status') }), trigger: 'change' }],
}))
const resetForm = () => {
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
}
const loadGroups = async () => {
  if (groupsList.value.length) return
  const res = await groups({ page_size: 9999 }).catch(() => false)
  if (res) groupsList.value = res.data.list || []
}
const loadUser = async () => {
  if (!isEdit.value) return
  const res = await detail(props.userId).catch(() => false)
  if (res) Object.assign(form, emptyForm(), res.data)
}
watch(() => props.visible, async visible => {
  if (!visible) return
  resetForm()
  loading.value = true
  await Promise.all([loadGroups(), loadUser()])
  loading.value = false
})
const submit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  const request = isEdit.value ? update : create
  const res = await request({ ...form }).catch(() => false)
  submitting.value = false
  if (!res) return
  ElMessage.success(T('OperationSuccess'))
  emit('saved')
  dialogVisible.value = false
}
</script>
