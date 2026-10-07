<template>
  <section v-if="preview" v-bind="$attrs" class="query-toolbar" :aria-label="T('Filter')"
           @keydown.enter="preventSearchSubmit" @keyup.enter.capture="submitSearch"
           @compositionstart="composing = true" @compositionend="compositionEnd" @click="cancelExplicitQuery">
    <slot />
  </section>
  <el-card v-else v-bind="$attrs" :shadow="shadow"><slot /></el-card>
</template>

<script setup>
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, watch } from 'vue'
import { T } from '@/utils/i18n'
import { createQueryScheduler } from '@/utils/queryScheduler'

const props = defineProps({ query: Object, fields: { type: String, default: '' }, shadow: { type: String, default: 'never' } })
defineOptions({ inheritAttrs: false })
const emit = defineEmits(['query'])
const preview = document.documentElement.classList.contains('portainer-ui')
let active = true
let composing = false
const scheduler = createQueryScheduler(() => emit('query'))
const flush = () => { if (active && !composing && props.fields) scheduler.flush() }
const isSearchInput = event => event.target?.matches('input, textarea, select')
const preventSearchSubmit = event => { if (isSearchInput(event)) event.preventDefault() }
const submitSearch = event => {
  if (!isSearchInput(event)) return
  event.preventDefault()
  event.stopPropagation()
  flush()
}
const compositionEnd = () => { composing = false; if (active && props.fields) scheduler.queue() }
const cancelExplicitQuery = event => {
  const button = event.target?.closest('button')
  if (button?.getAttribute('aria-label') === T('Reset') || button?.classList.contains('query-submit')) nextTick(scheduler.cancel)
}

// 페이지 이동은 기존 조회 흐름을 유지하고 실제 검색 조건만 자동 적용한다.
watch(() => props.fields.split(',').filter(Boolean).map(key => props.query?.[key]), () => {
  if (preview && active && !composing) scheduler.queue()
}, { deep: true })
onActivated(() => { active = true })
onDeactivated(() => { active = false; scheduler.cancel() })
onBeforeUnmount(scheduler.cancel)
</script>
