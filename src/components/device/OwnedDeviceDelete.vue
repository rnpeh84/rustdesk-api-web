<template>
  <el-tooltip :content="T('Delete')" :disabled="armed || pending" :persistent="false">
    <el-button ref="button" class="inline-confirm-button console-delete-action" circle type="danger" plain :icon="armed ? Check : Delete" :loading="pending" :data-confirming="armed" :aria-label="armed ? T('InlineConfirmAction', { param: T('Delete') }) : T('Delete')" :aria-pressed="armed" @click.stop="activate" @blur="armed && reset()" @keydown.enter.stop.prevent="activateKey" @keydown.space.stop.prevent="activateKey" @keydown.esc.stop.prevent="reset"/>
  </el-tooltip>
  <span class="inline-confirm-status" role="status" aria-live="polite">{{ armed ? T('InlineConfirmAction', { param: T('Delete') }) : '' }}</span>
  <el-dialog v-model="visible" :title="T('SharedDeviceDeleteTitle')" width="520px" class="shared-device-delete" append-to-body :close-on-click-modal="!pending" :close-on-press-escape="!pending" :show-close="!pending" @closed="reset">
    <p>{{ peer.hostname || peer.id }} · {{ peer.id }}</p>
    <p>{{ T('SharedDeviceDeleteHint') }}</p>
    <ul class="delete-share-list">
      <li v-for="share in preview?.shares" :key="`${share.kind}-${share.id}-${share.target_id}`">
        <strong>{{ share.kind === 'link' ? T('ShareLink') : share.name }}</strong>
        <span>{{ share.kind === 'group' ? T('SharedGroup') : share.target_type === 2 ? T('Group') : T('User') }} · {{ share.recipient || T('Unknown') }}</span>
      </li>
    </ul>
    <template #footer>
      <el-button :disabled="pending" @click.stop="visible = false">{{ T('Cancel') }}</el-button>
      <el-button type="danger" :loading="pending" @click.stop="confirmDelete">{{ T('DeleteDeviceAndShares') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { Check, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { deletePreview, remove } from '@/api/my/peer'
import { T } from '@/utils/i18n'

const props = defineProps({ peer: { type: Object, required: true } })
const emit = defineEmits(['deleted'])
const armed = ref(false), pending = ref(false), visible = ref(false), preview = ref(null)
const button = ref(null)
let timer, generation = 0
const reset = () => { clearTimeout(timer); armed.value = false; generation += 1 }
const fetchPreview = async () => { preview.value = (await deletePreview(props.peer.row_id)).data }
const activate = async () => {
  if (pending.value) return
  if (armed.value) { reset(); await confirmDelete(); return }
  pending.value = true
  const current = ++generation
  try {
    await fetchPreview()
    if (current !== generation) return
    if (preview.value.shares.length) visible.value = true
    else { armed.value = true; timer = setTimeout(reset, 5000) }
  } catch { reset() }
  finally { pending.value = false }
}
const activateKey = event => { if (!event.repeat) activate() }
const confirmDelete = async () => {
  if (pending.value) return
  pending.value = true
  try {
    await remove({ row_id: props.peer.row_id, revision: preview.value?.revision })
    visible.value = false
    ElMessage.success(T('OperationSuccess'))
    emit('deleted', props.peer.row_id)
  } catch (error) {
    if (error?.code === 409) {
      try { await fetchPreview(); visible.value = true } catch { visible.value = false }
    }
  } finally { pending.value = false; reset() }
}
watch(() => props.peer.row_id, () => { reset(); visible.value = false; preview.value = null })
watch(armed, (value, _, cleanup) => {
  if (!value) return
  const outside = event => { if (!button.value?.$el.contains(event.target)) reset() }
  const escape = event => { if (event.key === 'Escape') reset() }
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('keydown', escape, true)
  cleanup(() => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape, true) })
})
onBeforeUnmount(reset)
onDeactivated(() => { reset(); visible.value = false })
</script>

<style scoped>
.inline-confirm-status { position: fixed; top: 0; left: 0; width: 1px; height: 1px; padding: 0; margin: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; pointer-events: none; }
.delete-share-list { display: grid; gap: 8px; padding: 0; margin: 16px 0; list-style: none; max-height: 300px; overflow: auto; }
.delete-share-list li { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid var(--el-border-color); border-radius: 6px; overflow-wrap: anywhere; }
.delete-share-list strong { color: var(--el-text-color-primary); }
.delete-share-list span { color: var(--el-text-color-secondary); font-size: 12px; }
</style>
