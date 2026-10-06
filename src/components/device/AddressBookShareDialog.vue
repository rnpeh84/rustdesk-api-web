<template>
  <el-dialog v-model="visible" append-to-body :title="T('ShareAddressBook')" width="min(680px, calc(100vw - 24px))" destroy-on-close @open="load" :close-on-click-modal="false">
    <div v-loading="loading" class="share-form">
      <el-alert v-if="failed" type="error" :closable="false" :title="T('ShareLoadFailed')"><el-button @click="load">{{ T('Retry') }}</el-button></el-alert>
      <el-form v-else label-position="top" @submit.prevent="submit">
        <el-form-item v-if="!collection" :label="T('Name')" required>
          <el-radio-group v-model="createNew" @change="changeBook"><el-radio-button :value="true">{{ T('NewAddressBook') }}</el-radio-button><el-radio-button :value="false">{{ T('ExistingAddressBook') }}</el-radio-button></el-radio-group>
          <el-input v-if="createNew" v-model="name" name="address-book-name" autocomplete="off" :maxlength="50" :placeholder="T('Name')" class="book-input" :aria-label="T('Name')"/>
          <el-select v-else v-model="collectionID" filterable class="book-input" :aria-label="T('Name')" @change="changeBook"><el-option v-for="book in ownBooks" :key="book.id" :label="book.name" :value="book.id"/></el-select>
        </el-form-item>
        <p v-else class="book-name">{{ collection.name }}</p>
        <p class="share-help">{{ T('WholeAddressBookShare') }}</p>
        <p v-if="autoGroup" class="share-help">{{ T('SharedGroupAlreadyVisible', { param: autoGroup }) }}</p>
        <p v-if="peerIds.length" class="share-help">{{ T('ShareSelectedDevices', { param: peerIds.length }) }}</p>
        <el-form-item :label="T('ShareRecipients')">
          <el-select v-model="selected" multiple filterable remote :remote-method="search" :loading="searching" :aria-label="T('ShareRecipients')" :placeholder="T('SearchShareRecipients')" @change="syncRules">
            <el-option-group :label="T('Users')"><el-option v-for="target in targets.users" :key="`1-${target.id}`" :label="`${T('User')}: ${target.name}`" :value="`1-${target.id}`"/></el-option-group>
            <el-option-group :label="T('Groups')"><el-option v-for="target in targets.groups" :key="`2-${target.id}`" :label="`${T('Group')}: ${target.name}`" :value="`2-${target.id}`"/></el-option-group>
          </el-select>
        </el-form-item>
        <p v-if="directoryFailed" role="alert" class="share-help">{{ T('ShareDirectoryFailed') }}</p>
        <div v-for="key in selected" :key="key" class="share-target">
          <span class="target-name">{{ targetName(key) }}</span>
          <el-select v-model="rules[key]" :aria-label="`${targetName(key)} ${T('AddressBookEditRule')}`"><el-option v-for="rule in [1, 2, 3]" :key="rule" :value="rule" :label="T(`ShareEditRule${rule}`)"/></el-select>
          <el-button :icon="Close" text :aria-label="`${T('RemoveRecipient')} ${targetName(key)}`" @click="selected = selected.filter(item => item !== key)"/>
        </div>
        <p class="share-help">{{ T('ShareCredentialNotice') }}</p>
      </el-form>
    </div>
    <template #footer><el-button @click="visible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" :disabled="loading || failed || (!collection && (createNew ? !name.trim() : !collectionID))" @click="submit">{{ T('SaveSharing') }}</el-button></template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
import { books, recipients, save } from '@/api/my/sharing'

const visible = defineModel({ type: Boolean, default: false })
const props = defineProps({ collection: { type: Object, default: null }, peerIds: { type: Array, default: () => [] } })
const emit = defineEmits(['saved'])
const loading = ref(false), saving = ref(false), searching = ref(false), failed = ref(false)
const ownBooks = ref([]), createNew = ref(true), name = ref(''), collectionID = ref(null), selected = ref([])
const rules = reactive({}), targets = reactive({ users: [], groups: [] })
const directoryFailed = ref(false), autoGroup = ref('')
let searchVersion = 0
const targetName = key => {
  const [type, id] = key.split('-').map(Number)
  const target = (type === 1 ? targets.users : targets.groups).find(item => item.id === id)
  return `${T(type === 1 ? 'User' : 'Group')}: ${target?.name || id}`
}
const syncRules = () => { selected.value.forEach(key => { if (!rules[key]) rules[key] = 1 }) }
const changeBook = () => {
  const book = props.collection || (!createNew.value && ownBooks.value.find(item => item.id === collectionID.value))
  selected.value = (book?.recipients || []).map(r => `${r.type}-${r.to_id}`)
  for (const r of book?.recipients || []) {
    const list = r.type === 1 ? targets.users : targets.groups
    if (!list.some(item => item.id === r.to_id)) list.push({ id: r.to_id, name: r.name })
    rules[`${r.type}-${r.to_id}`] = r.rule
  }
}
const search = async keyword => {
  const version = ++searchVersion; searching.value = true; directoryFailed.value = false
  try {
    const res = await recipients({ keyword })
    if (version !== searchVersion) return
    autoGroup.value = res.data.auto_shared_group?.name || ''
    for (const type of ['users', 'groups']) {
      const prefix = type === 'users' ? '1-' : '2-'
      const kept = targets[type].filter(item => selected.value.includes(`${prefix}${item.id}`))
      targets[type] = [...new Map([...kept, ...res.data[type]].map(item => [item.id, item])).values()]
    }
  } catch { if (version === searchVersion) directoryFailed.value = true } finally { if (version === searchVersion) searching.value = false }
}
const load = async () => {
  loading.value = true; failed.value = false; name.value = ''; createNew.value = true; collectionID.value = null; selected.value = []
  try {
    const res = await books({ scope: 'sent' }); ownBooks.value = res.data.list
    await search('')
    if (props.collection) {
      const fresh = ownBooks.value.find(item => item.id === props.collection.id)
      if (!fresh) throw new Error('주소록 없음')
      collectionID.value = fresh.id
      // 기존 주소록의 전체 공유 대상을 유지한다.
      selected.value = fresh.recipients.map(r => `${r.type}-${r.to_id}`)
      fresh.recipients.forEach(r => {
        rules[`${r.type}-${r.to_id}`] = r.rule
        const list = r.type === 1 ? targets.users : targets.groups
        if (!list.some(item => item.id === r.to_id)) list.push({ id: r.to_id, name: r.name })
      })
    }
  } catch { failed.value = true } finally { loading.value = false }
}
const submit = async () => {
  if (loading.value || failed.value || saving.value) return
  if (!props.collection && createNew.value && !name.value.trim()) return
  saving.value = true
  try {
    const data = { collection_id: props.collection?.id || (!createNew.value ? collectionID.value : 0), name: name.value, peer_ids: props.peerIds, recipients: selected.value.map(key => { const [type, to_id] = key.split('-').map(Number); return { type, to_id, rule: rules[key] || 1 } }) }
    await save(data); ElMessage.success(T('SharingSaved')); visible.value = false; emit('saved')
  } catch { /* 공통 API 오류 안내 후 입력을 보존한다. */ } finally { saving.value = false }
}
</script>

<style scoped>
.share-form { min-height: 120px; }
.book-input { width: 100%; margin-top: 12px; }
.share-help { color: var(--el-text-color-secondary); line-height: 1.6; margin: 12px 0; }
.book-name { font-weight: 600; overflow-wrap: anywhere; }
.share-target { display: grid; grid-template-columns: minmax(0,1fr) 150px 32px; align-items: center; gap: 8px; margin: 8px 0; }
.target-name { overflow-wrap: anywhere; }
.share-form :deep(.el-select) { width: 100%; }
@media (max-width: 480px) { .share-target { grid-template-columns: minmax(0,1fr) 120px 28px; } }
</style>
