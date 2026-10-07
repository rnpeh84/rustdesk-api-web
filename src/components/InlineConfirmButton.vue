<template>
  <el-tooltip :content="armed ? T('InlineConfirmAction', { param: label }) : label">
    <el-button v-bind="$attrs" type="danger" plain :icon="armed ? Check : icon" :loading="loading || pending" :disabled="disabled || loading || pending" :aria-label="armed ? T('InlineConfirmAction', { param: label }) : label" :aria-pressed="armed" @click="activate" @blur="reset" @keydown.esc.stop.prevent="reset"><span v-if="showLabel" class="query-action-label">{{ label }}</span></el-button>
  </el-tooltip>
</template>

<script setup>
import { onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { Check, Delete } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
import { createInlineConfirmation } from '@/utils/inlineConfirmation'
defineOptions({ inheritAttrs: false })
const props = defineProps({ label: { type: String, required: true }, showLabel: Boolean, loading: Boolean, disabled: Boolean, action: Function, confirmKey: [String, Number], icon: { type: [Object, Function], default: () => Delete } })
const emit = defineEmits(['confirm'])
const armed = ref(false)
const pending = ref(false)
const { activate, reset } = createInlineConfirmation({
  execute: () => props.action ? props.action() : emit('confirm'),
  disabled: () => props.loading || props.disabled,
  changed: state => { armed.value = state.armed; pending.value = state.pending },
})
// 목록 갱신이나 선택 변경으로 버튼 대상이 바뀌면 이전 확인을 취소한다.
watch(() => [props.confirmKey, props.disabled], reset)
onBeforeUnmount(reset)
onDeactivated(reset)
</script>
