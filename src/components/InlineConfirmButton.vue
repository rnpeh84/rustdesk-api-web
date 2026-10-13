<template>
  <el-tooltip :content="label" :disabled="armed || loading || pending || disabled" :persistent="false">
    <el-button ref="button" v-bind="$attrs" class="inline-confirm-button" :class="{ 'console-delete-action': tone === 'danger' }" :type="tone" plain :icon="armed ? Check : icon" :loading="loading || pending" :disabled="disabled || loading || pending" :data-confirming="armed" :aria-label="armed ? T('InlineConfirmAction', { param: label }) : label" :aria-pressed="armed" @click.stop="activate" @blur="reset" @keydown.enter.stop.prevent="activateKey" @keydown.space.stop.prevent="activateKey" @keydown.esc.stop.prevent="reset">
      <template v-if="showLabel" #default><span class="query-action-label">{{ label }}</span></template>
    </el-button>
  </el-tooltip>
  <span class="inline-confirm-status" role="status" aria-live="polite">{{ armed ? T('InlineConfirmAction', { param: label }) : '' }}</span>
</template>

<script setup>
import { onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { Check, Delete } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
import { createInlineConfirmation } from '@/utils/inlineConfirmation'
defineOptions({ inheritAttrs: false })
const props = defineProps({ label: { type: String, required: true }, showLabel: Boolean, loading: Boolean, disabled: Boolean, action: Function, confirmKey: [String, Number], tone: { type: String, default: 'danger', validator: value => ['danger', 'primary'].includes(value) }, icon: { type: [Object, Function], default: () => Delete } })
const emit = defineEmits(['confirm'])
const armed = ref(false)
const pending = ref(false)
const button = ref(null)
const { activate, reset } = createInlineConfirmation({
  execute: () => props.action ? props.action() : emit('confirm'),
  disabled: () => props.loading || props.disabled,
  changed: state => { armed.value = state.armed; pending.value = state.pending },
})
// 툴팁의 키보드 처리와 분리하고 키를 누른 채 반복 입력해도 확정하지 않는다.
const activateKey = event => { if (!event.repeat) activate() }
// 목록 갱신이나 선택 변경으로 버튼 대상이 바뀌면 이전 확인을 취소한다.
watch(() => [props.confirmKey, props.disabled, props.loading], reset)
// 모바일처럼 클릭으로 초점을 옮기지 않는 환경에서도 확인을 취소한다.
watch(armed, (value, _, cleanup) => {
  if (!value) return
  const outside = event => { if (!button.value?.$el.contains(event.target)) reset() }
  const escape = event => { if (event.key === 'Escape') reset() }
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('keydown', escape, true)
  cleanup(() => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true) })
})
onBeforeUnmount(reset)
onDeactivated(reset)
</script>

<style scoped>
/* 화면 가장자리에서도 읽기용 확인 문구가 스크롤 영역을 늘리지 않는다. */
.inline-confirm-status { position: fixed; top: 0; left: 0; width: 1px; height: 1px; padding: 0; margin: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; pointer-events: none; }
</style>
