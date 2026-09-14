<template>
  <el-dialog
    v-model="dialogVisible"
    class="console-dialog console-dialog--compact"
    :title="T('ResetPassword')"
    width="520"
    append-to-body
    destroy-on-close
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <p class="dialog-description">{{ T('ResetPasswordDescription', { param: user?.username || '-' }) }}</p>
    <el-form ref="formRef" class="dialog-form" label-position="top" :model="form" :rules="rules">
      <el-form-item :label="T('NewPassword')" prop="password">
        <el-input v-model="form.password" name="new-password" type="password" autocomplete="new-password" show-password />
      </el-form-item>
      <el-form-item :label="T('ConfirmPassword')" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" name="confirm-password" type="password" autocomplete="new-password" show-password />
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-actions">
        <el-button @click="dialogVisible = false">{{ T('Cancel') }}</el-button>
        <el-button type="warning" :loading="submitting" @click="submit">{{ T('ResetPassword') }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { changePwd } from '@/api/user'
import { T } from '@/utils/i18n'

const props = defineProps({ visible: Boolean, user: { type: Object, default: null } })
const emit = defineEmits(['update:visible'])
const formRef = ref(null)
const submitting = ref(false)
const form = reactive({ password: '', confirmPassword: '' })
const dialogVisible = computed({ get: () => props.visible, set: value => emit('update:visible', value) })
const rules = computed(() => ({
  password: [{ required: true, message: T('ParamRequired', { param: T('NewPassword') }), trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: T('ParamRequired', { param: T('ConfirmPassword') }), trigger: 'blur' },
    { validator: (_rule, value, callback) => value === form.password ? callback() : callback(new Error(T('PasswordNotMatchConfirmPassword'))), trigger: 'blur' },
  ],
}))
const resetForm = () => {
  form.password = ''
  form.confirmPassword = ''
  formRef.value?.clearValidate()
}
const submit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !props.user?.id) return
  submitting.value = true
  const res = await changePwd({ id: props.user.id, password: form.password }).catch(() => false)
  submitting.value = false
  if (!res) return
  ElMessage.success(T('OperationSuccess'))
  dialogVisible.value = false
}
</script>
