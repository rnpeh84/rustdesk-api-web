<template>
  <el-tooltip :content="armed ? T('InlineConfirmAction', { param: label }) : label">
    <el-button type="danger" plain :icon="armed ? Check : Delete" :loading="loading" :disabled="loading" :aria-label="armed ? T('InlineConfirmAction', { param: label }) : label" :aria-pressed="armed" @click="activate" @blur="reset" @keydown.esc.stop.prevent="reset"/>
  </el-tooltip>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { Check, Delete } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
defineProps({ label: { type: String, required: true }, loading: Boolean })
const emit = defineEmits(['confirm'])
const armed = ref(false)
let timer
const reset = () => { clearTimeout(timer); armed.value = false }
const activate = () => {
  if (armed.value) { reset(); emit('confirm'); return }
  armed.value = true
  // 초점 이탈, Esc 또는 대기 시간 초과 시 다시 첫 단계로 돌아간다.
  timer = setTimeout(reset, 5000)
}
onBeforeUnmount(reset)
</script>
