<template>
  <el-dialog v-model="visible" append-to-body :title="T(deviceMode ? 'ShareDevices' : 'ShareAddressBook')" width="min(680px, calc(100vw - 24px))" destroy-on-close @open="load" :close-on-click-modal="false">
    <div v-loading="loading" class="share-form">
      <el-alert v-if="failed" type="error" :closable="false" :title="T('ShareLoadFailed')"><el-button @click="load">{{ T('Retry') }}</el-button></el-alert>
      <el-form v-else label-position="top" @submit.prevent="submit">
        <p v-if="collection" class="book-name">{{ collection.name }}</p>
        <el-form-item v-else-if="!deviceMode" :label="T('ShareBookLabel')" required>
          <el-select v-model="collectionID" filterable :aria-label="T('ShareBookLabel')" :placeholder="T('ChooseShareBook')" @change="changeBook"><el-option v-for="book in ownBooks.filter(b => b.share_kind !== 'device')" :key="book.id" :label="book.name" :value="book.id"/></el-select>
          <router-link class="share-help" to="/my/address_book_collection" @click="visible = false">{{ T('CreateAddressBook') }}</router-link>
        </el-form-item>
        <p class="share-help">{{ T(deviceMode ? 'DirectDeviceShareHelp' : 'WholeAddressBookShare') }}</p>
        <DeviceSharePicker v-if="deviceMode" v-model="selectedPeerIDs" :known-devices="knownDevices"/>
        <p v-if="autoGroup" class="share-help">{{ T('SharedGroupAlreadyVisible', { param: autoGroup }) }}</p>
        <el-form-item :label="T('ShareRecipients')">
          <el-select v-model="selected" multiple filterable remote :remote-method="search" :loading="searching" :aria-label="T('ShareRecipients')" :placeholder="T('SearchShareRecipients')" @change="syncRules">
            <el-option-group :label="T('Users')"><el-option v-for="target in targets.users" :key="'1-' + target.id" :label="T('User') + ': ' + target.name" :value="'1-' + target.id"/></el-option-group>
            <el-option-group :label="T('Groups')"><el-option v-for="target in targets.groups" :key="'2-' + target.id" :label="T('Group') + ': ' + target.name" :value="'2-' + target.id"/></el-option-group>
          </el-select>
        </el-form-item>
        <p v-if="directoryFailed" role="alert" class="share-help">{{ T('ShareDirectoryFailed') }}</p>
        <p v-if="selected.length" class="share-help">{{ T('ShareExpiryHelp') }}</p>
        <div v-for="key in selected" :key="key" class="share-target">
          <span class="target-name">{{ targetName(key) }}</span>
          <div class="target-expiry">
            <el-select v-model="periods[key]" :aria-label="targetName(key) + ' ' + T('ShareExpiry')" @change="value => changePeriod(key, value)">
              <el-option value="never" :label="T('ShareIndefinite')"/><el-option value="7" :label="T('ShareSevenDays')"/><el-option value="30" :label="T('ShareThirtyDays')"/><el-option value="custom" :label="T('ShareCustomDate')"/>
            </el-select>
            <el-date-picker v-if="periods[key] === 'custom'" :model-value="expires[key] ? new Date(expires[key] * 1000) : null" type="datetime" :placeholder="T('ShareExpiry')" :aria-label="targetName(key) + ' ' + T('ShareExpiry')" @update:model-value="value => expires[key] = value ? Math.floor(value.getTime() / 1000) : null"/>
            <span v-if="expires[key] > 0 && expires[key] <= now" class="expired">{{ T('ShareExpired') }}</span>
          </div>
          <el-button :icon="Close" text :aria-label="T('RemoveRecipient') + ' ' + targetName(key)" @click="selected = selected.filter(item => item !== key)"/>
        </div>
        <el-collapse v-if="!deviceMode && selected.length" class="edit-rules">
          <el-collapse-item :title="T('AddressBookEditRule')" name="rules"><p class="share-help">{{ T('BookEditRuleHelp') }}</p><div v-for="key in selected" :key="key" class="rule-row"><span>{{ targetName(key) }}</span><el-select v-model="rules[key]" :aria-label="targetName(key) + ' ' + T('AddressBookEditRule')"><el-option v-for="rule in [1, 2, 3]" :key="rule" :value="rule" :label="T('ShareEditRule' + rule)"/></el-select></div></el-collapse-item>
        </el-collapse>
        <p v-if="hasPreviousRecipients && !selected.length" class="share-help">{{ T('ShareRemoveAllHelp') }}</p>
        <p class="share-help">{{ T('ShareCredentialNotice') }}</p>
      </el-form>
    </div>
    <template #footer><el-button @click="visible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" :disabled="!canSubmit" @click="submit">{{ T(hasPreviousRecipients && !selected.length ? 'StopSharing' : 'SaveSharing') }}</el-button></template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { T } from '@/utils/i18n'
import { books, recipients, save } from '@/api/my/sharing'
import DeviceSharePicker from './DeviceSharePicker.vue'
const visible = defineModel({ type: Boolean, default: false })
const props = defineProps({ collection: { type: Object, default: null }, peerIds: { type: Array, default: () => [] }, shareKind: { type: String, default: 'address_book' } })
const emit = defineEmits(['saved'])
const deviceMode = computed(() => props.collection?.share_kind === 'device' || props.peerIds.length > 0 || props.shareKind === 'device')
const selectedPeerIDs = ref([])
const knownDevices = ref([])
const loading = ref(false), saving = ref(false), searching = ref(false), failed = ref(false)
const ownBooks = ref([]), collectionID = ref(null), selected = ref([]), now = ref(0)
const rules = reactive({}), periods = reactive({}), expires = reactive({}), originalExpires = reactive({})
const targets = reactive({ users: [], groups: [] }), directoryFailed = ref(false), autoGroup = ref('')
let searchVersion = 0, loadVersion = 0
const hasPreviousRecipients = computed(() => ownBooks.value.find(book => book.id === collectionID.value)?.recipients?.length > 0)
const canSubmit = computed(() => !loading.value && !saving.value && !failed.value && (deviceMode.value ? selectedPeerIDs.value.length || (hasPreviousRecipients.value && !selected.value.length) : collectionID.value) && (hasPreviousRecipients.value || selected.value.length) && selected.value.every(key => periods[key] !== 'custom' || expires[key] > 0))
const targetName = key => {
  const [type, id] = key.split('-').map(Number)
  const target = (type === 1 ? targets.users : targets.groups).find(item => item.id === id)
  return T(type === 1 ? 'User' : 'Group') + ': ' + (target?.name || id)
}
const syncRules = () => selected.value.forEach(key => { if (!rules[key]) rules[key] = 1; if (!periods[key]) { periods[key] = 'never'; expires[key] = 0 } })
const changePeriod = (key, value) => { expires[key] = value === 'never' ? 0 : value === 'custom' ? null : Math.floor(Date.now() / 1000) + Number(value) * 86400 }
const changeBook = () => {
  const book = ownBooks.value.find(item => item.id === collectionID.value)
  knownDevices.value = book?.devices || []
  if (deviceMode.value && book) selectedPeerIDs.value = [...(book.peer_ids || [])]
  for (const state of [rules, periods, expires, originalExpires]) Object.keys(state).forEach(key => delete state[key])
  selected.value = (book?.recipients || []).map(r => r.type + '-' + r.to_id)
  for (const r of book?.recipients || []) {
    const key = r.type + '-' + r.to_id, list = r.type === 1 ? targets.users : targets.groups
    if (!list.some(item => item.id === r.to_id)) list.push({ id: r.to_id, name: r.name })
    rules[key] = r.rule; expires[key] = r.expires_at || 0; originalExpires[key] = expires[key]; periods[key] = expires[key] ? 'custom' : 'never'
  }
}
const search = async keyword => {
  const version = ++searchVersion; searching.value = true; directoryFailed.value = false
  try {
    const res = await recipients({ keyword })
    if (version !== searchVersion) return
    autoGroup.value = res.data.auto_shared_group?.name || ''
    for (const type of ['users', 'groups']) {
      const prefix = type === 'users' ? '1-' : '2-', kept = targets[type].filter(item => selected.value.includes(prefix + item.id))
      targets[type] = [...new Map([...kept, ...res.data[type]].map(item => [item.id, item])).values()]
    }
  } catch { if (version === searchVersion) directoryFailed.value = true } finally { if (version === searchVersion) searching.value = false }
}
const load = async () => {
  const version = ++loadVersion
  loading.value = true; failed.value = false; collectionID.value = null; selected.value = []; now.value = Math.floor(Date.now() / 1000)
  selectedPeerIDs.value = [...props.peerIds]
  for (const state of [rules, periods, expires, originalExpires]) Object.keys(state).forEach(key => delete state[key])
  try {
    const res = await books({ scope: 'sent' })
    if (version !== loadVersion) return
    ownBooks.value = res.data.list
    if (props.collection) {
      if (!ownBooks.value.some(item => item.id === props.collection.id)) throw new Error('주소록 없음')
      collectionID.value = props.collection.id
    } else if (deviceMode.value && props.peerIds.length) {
      // 같은 장치 선택을 다시 공유할 때 기존 대상과 만료일을 이어서 관리한다.
      const ids = [...new Set(props.peerIds)].sort((a, b) => a - b).join(',')
      collectionID.value = ownBooks.value.find(book => book.share_kind === 'device' && [...new Set(book.peer_ids || [])].sort((a, b) => a - b).join(',') === ids)?.id || null
    }
    changeBook(); await search('')
  } catch { if (version === loadVersion) failed.value = true } finally { if (version === loadVersion) loading.value = false }
}
const submit = async () => {
  if (!canSubmit.value) return
  const current = Math.floor(Date.now() / 1000)
  if (selected.value.some(key => expires[key] > 0 && expires[key] <= current && expires[key] !== originalExpires[key])) { ElMessage.error(T('ShareFutureDateRequired')); return }
  saving.value = true
  try {
    const data = { collection_id: collectionID.value || 0, share_kind: deviceMode.value ? 'device' : 'address_book', peer_ids: deviceMode.value ? selectedPeerIDs.value : undefined, recipients: selected.value.map(key => { const [type, to_id] = key.split('-').map(Number); return { type, to_id, rule: deviceMode.value ? 1 : rules[key] || 1, expires_at: expires[key] || 0 } }) }
    await save(data); ElMessage.success(T('SharingSaved')); visible.value = false; emit('saved')
  } catch { /* 공통 API 오류 안내 후 입력을 보존한다. */ } finally { saving.value = false }
}
</script>

<style scoped>
.share-form { min-height: 120px; }
.share-help { color: var(--el-text-color-secondary); line-height: 1.6; margin: 12px 0; }
.book-name { font-weight: 600; overflow-wrap: anywhere; }
.share-target { display: grid; grid-template-columns: minmax(0,1fr) minmax(170px,240px) 32px; align-items: start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--el-border-color-lighter); }
.target-name { overflow-wrap: anywhere; padding-top: 6px; }
.target-expiry { display: grid; gap: 8px; min-width: 0; }
.target-expiry :deep(.el-date-editor) { width: 100%; }
.expired { color: var(--el-color-danger); font-size: 13px; }
.share-form :deep(.el-select) { width: 100%; }
.edit-rules { margin-top: 16px; }
.rule-row { display: grid; grid-template-columns: minmax(0,1fr) 160px; align-items: center; gap: 12px; margin: 8px 0; }
@media (max-width: 480px) { .share-target { grid-template-columns: minmax(0,1fr) 32px; } .target-expiry { grid-row: 2; grid-column: 1 / -1; } .share-target > .el-button { grid-column: 2; grid-row: 1; } .rule-row { grid-template-columns: 1fr; } }
</style>
