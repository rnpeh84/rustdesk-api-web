<template>
  <div>
    <el-card class="list-query" shadow="never">
      <div class="list-filter-row">
        <el-button v-if="canWrite" type="primary" :icon="Plus" @click="openCreate">{{ T('AddPolicy') }}</el-button>
      </div>
    </el-card>

    <el-card class="list-body" shadow="never">
      <el-table :data="result.list" v-loading="result.loading" border scrollbar-always-on>
        <el-table-column prop="id" label="ID" width="84" align="center" fixed="left" sortable />
        <el-table-column prop="name" :label="T('PolicyName')" min-width="180" show-overflow-tooltip sortable />
        <el-table-column prop="description" :label="T('Description')" min-width="240" show-overflow-tooltip />
        <el-table-column prop="status" :label="T('Status')" width="110" align="center">
          <template #default="{ row }"><el-tag :type="statusType[row.status]">{{ T(statusLabel[row.status] || 'Draft') }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="current_version" :label="T('Version')" width="100" align="center" sortable />
        <el-table-column :label="T('Actions')" width="240" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip v-if="canWrite" :content="T('Edit')"><el-button circle :aria-label="T('Edit')" :icon="Edit" @click="openEdit(row)" /></el-tooltip>
            <el-tooltip v-if="canWrite" :content="T('AssignPolicy')"><el-button circle :aria-label="T('AssignPolicy')" :icon="Connection" @click="openAssign(row)" /></el-tooltip>
            <el-tooltip :content="T('Preview')"><el-button circle :aria-label="T('Preview')" :icon="View" @click="openPreview(row)" /></el-tooltip>
            <el-tooltip :content="T('History')"><el-button circle :aria-label="T('History')" :icon="Clock" @click="openHistory(row)" /></el-tooltip>
            <el-tooltip v-if="canWrite && row.status === 'draft'" :content="T('ValidatePolicy')"><el-button circle type="primary" :aria-label="T('ValidatePolicy')" :icon="CircleCheck" @click="validatePolicy(row)" /></el-tooltip>
            <el-tooltip v-if="canPublish && row.status === 'validated'" :content="T('Publish')"><el-button circle type="success" :aria-label="T('Publish')" :icon="Upload" @click="publishPolicy(row)" /></el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="list-page" shadow="never">
      <el-pagination v-model:page-size="query.page_size" v-model:current-page="query.page" background layout="prev, pager, next, sizes" :total="result.total" />
    </el-card>

    <el-dialog v-model="editor.visible" class="console-dialog" :title="T(editor.id ? 'EditPolicy' : 'AddPolicy')" width="min(760px, calc(100vw - 24px))" :close-on-click-modal="false">
      <el-alert v-if="editor.failed" :title="T('PolicyDetailFailed')" type="error" :closable="false"/>
      <el-form v-loading="editor.loading" label-position="top">
        <div class="dialog-form dialog-form--grid">
          <el-form-item :label="T('PolicyName')"><el-input v-model="editor.name" /></el-form-item>
          <el-form-item :label="T('ChangeSummary')"><el-input v-model="editor.change_summary" /></el-form-item>
          <el-form-item class="dialog-form__wide" :label="T('Description')"><el-input v-model="editor.description" /></el-form-item>
          <div class="dialog-form__wide policy-guidance"><details><summary>{{ T('PolicySyncDetails') }}</summary><p>{{ T('PolicySyncLimit') }}</p><p>{{ T('PolicySupportedGuide') }}</p></details>
            <el-alert v-if="catalogFailed" :title="T('PolicyCatalogFailed')" type="error" :closable="false"/>
            <el-table class="policy-options-table" :data="catalog" border size="small">
              <el-table-column :label="T('PolicySupportedOptions')" min-width="155"><template #default="{row}">{{ T(policyOptionKey(row.key)) }}<small>{{ row.key }}</small></template></el-table-column>
              <el-table-column :label="T('PolicyPlatforms')" min-width="170"><template #default="{row}">{{ row.platforms.join(', ') }}<small>{{ row.min_version }}–1.5.x</small></template></el-table-column>
              <el-table-column :label="T('PolicySetting')" min-width="175"><template #default="{row}"><el-select :model-value="optionValue(row.key)" :aria-label="T(policyOptionKey(row.key))" @change="value=>setOption(row.key,value)"><el-option :label="T('PolicyNotManaged')" value="__unmanaged"/><el-option :label="T('PolicyEnabled')" value="Y"/><el-option :label="T('PolicyDisabled')" value="N"/><el-option v-if="row.key!=='direct-server'" :label="T('PolicyReset')" value=""/></el-select></template></el-table-column>
            </el-table>
            <div class="policy-options-mobile"><div v-for="row in catalog" :key="row.key" class="policy-option-mobile"><strong>{{ T(policyOptionKey(row.key)) }}</strong><small>{{ row.platforms.join(', ') }} · {{ row.min_version }}–1.5.x</small><el-select :model-value="optionValue(row.key)" :aria-label="T(policyOptionKey(row.key))" @change="value=>setOption(row.key,value)"><el-option :label="T('PolicyNotManaged')" value="__unmanaged"/><el-option :label="T('PolicyEnabled')" value="Y"/><el-option :label="T('PolicyDisabled')" value="N"/><el-option v-if="row.key!=='direct-server'" :label="T('PolicyReset')" value=""/></el-select></div></div>
          </div>
          <el-form-item class="dialog-form__wide" :label="T('PolicyConfigJson')">
            <el-input v-model="editor.configText" type="textarea" :rows="12" spellcheck="false" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer><el-button @click="editor.visible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="editor.saving" :disabled="editor.loading || editor.failed" @click="save">{{ T('Save') }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="assignment.visible" class="console-dialog" :title="T('AssignPolicy')" width="min(680px, calc(100vw - 24px))">
      <el-form label-position="top">
        <el-form-item :label="T('AssignmentScope')"><el-select v-model="assignment.scope_type"><el-option v-for="scope in scopes" :key="scope.value" :label="T(scope.label)" :value="scope.value" /></el-select></el-form-item>
        <el-form-item :label="T('PolicyTarget')">
          <el-select v-model="assignment.target_id" filterable remote clearable :remote-method="searchTargets" :loading="targetSearch.loading" :placeholder="T(assignment.scope_type === 'device' ? 'PolicyTargetSearch' : 'PolicyTargetNameSearch')" :aria-label="T('PolicyTarget')" @change="selectTarget">
            <el-option v-for="target in targetChoices" :key="target.id" :value="target.id" :label="policyTargetLabel(target)"><span>{{ policyTargetLabel(target) }}</span><el-tag v-if="target.is_default" size="small" effect="plain">{{ T('DefaultDeviceGroup') }}</el-tag></el-option>
          </el-select>
          <small v-if="targetSearch.failed" role="alert">{{ T('PolicyTargetLoadFailed') }}</small>
        </el-form-item>
        <el-form-item :label="T('Priority')"><el-input-number v-model="assignment.priority" controls-position="right" /></el-form-item>
      </el-form>
      <p class="policy-note">{{ T('PolicyUnassignGuide') }}</p>
      <el-alert v-if="assignment.failed" :title="T('PolicyAssignmentsFailed')" type="error" :closable="false"/>
      <el-table :data="assignment.list" v-loading="assignment.loading" border size="small">
       <el-table-column :label="T('AssignmentScope')" min-width="130"><template #default="{row}">{{ T(scopes.find(scope=>scope.value===row.scope_type)?.label || 'Unknown') }}</template></el-table-column><el-table-column :label="T('PolicyTarget')" min-width="200"><template #default="{row}"><span>{{ row.target_missing ? T('PolicyTargetMissing') : policyTargetLabel({name:row.target_name,detail:row.target_detail}) }}</span></template></el-table-column><el-table-column prop="priority" :label="T('Priority')" width="100"/>
       <el-table-column :label="T('Actions')" width="80" fixed="right"><template #default="{row}"><el-tooltip :content="T(armed===row.id ? 'PolicyUnassignConfirm' : 'PolicyUnassign')"><el-button circle :icon="armed===row.id ? Check : Delete" :aria-label="T(armed===row.id ? 'PolicyUnassignConfirm' : 'PolicyUnassign')" :disabled="assignment.saving" @click="removeAssignment(row)" @blur="cancelRemove" @keydown.esc.stop.prevent="cancelRemove"/></el-tooltip></template></el-table-column>
      </el-table>
      <template #footer><el-button @click="assignment.visible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="assignment.saving" :disabled="!assignment.target_id || targetSearch.loading || targetSearch.failed" @click="saveAssignment">{{ T('Assign') }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="inspector.visible" class="console-dialog" :title="T(inspector.mode === 'history' ? 'PolicyHistory' : 'PolicyPreview')" width="min(680px, calc(100vw - 24px))">
      <el-table v-if="inspector.mode === 'history'" :data="inspector.data" border><el-table-column prop="version" :label="T('Version')" width="100" /><el-table-column prop="change_summary" :label="T('ChangeSummary')" /><el-table-column prop="published_at" :label="T('PublishedAt')" width="140" /></el-table>
      <el-descriptions v-else :column="1" border><el-descriptions-item :label="T('AffectedDevices')">{{ inspector.data.target_count || 0 }}</el-descriptions-item><el-descriptions-item :label="T('ChangedFields')">{{ (inspector.data.changed_fields || []).join(', ') || '-' }}</el-descriptions-item><el-descriptions-item :label="T('Validation')">{{ inspector.data.valid ? T('Valid') : T('Invalid') }}</el-descriptions-item><el-descriptions-item :label="T('PolicySupportedOptions')">{{ Object.entries(inspector.data.official_options || {}).map(([key,value])=>`${key}=${value || T('PolicyReset')}`).join(', ') || T('PolicyNotManaged') }}</el-descriptions-item><el-descriptions-item :label="T('PolicySyncTitle')">{{ T('PolicySupportedGuide') }}</el-descriptions-item></el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Check, Delete, CircleCheck, Clock, Connection, Edit, Plus, Upload, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as policyApi from '@/api/policy'
import { createPolicyTargetSearch, policyTargetLabel } from '@/utils/policyTargets'
import { useUserStore } from '@/store/user'
import { changePolicyOption, policyOptionKey } from '@/utils/policySync'
import { T } from '@/utils/i18n'

const userStore=useUserStore()
const canWrite=computed(()=>userStore.permissions?.includes('*') || userStore.permissions?.includes('policy.write'))
const canPublish=computed(()=>userStore.permissions?.includes('*') || userStore.permissions?.includes('policy.publish'))
const catalog=ref([]),catalogFailed=ref(false),armed=ref(0)
let removeTimer, editorGeneration=0
const cancelRemove=()=>{armed.value=0;clearTimeout(removeTimer)}
const loadCatalog=async()=>{catalogFailed.value=false;try{catalog.value=(await policyApi.options()).data}catch{catalogFailed.value=true}}
const optionValue=key=>{try{return JSON.parse(editor.configText).options?.[key] ?? '__unmanaged'}catch{return '__unmanaged'}}
const setOption=(key,value)=>{try{editor.configText=changePolicyOption(editor.configText,key,value)}catch{ElMessage.error(T('InvalidJson'))}}
const query = reactive({ page: 1, page_size: 10 })
const result = reactive({ list: [], total: 0, loading: false })
const editor = reactive({ visible: false, saving: false, loading:false, failed:false, id: 0, name: '', description: '', change_summary: '', configText: JSON.stringify({options:{"direct-server":"N"}},null,2) })
const assignment = reactive({ visible: false, policy_id: 0, scope_type: 'device', target_id: null, priority: 0, list: [], loading: false, saving: false, failed: false })
const targetSearch = reactive({ items: [], loading: false, failed: false })
const selectedTarget = ref(null)
const targetLoader = createPolicyTargetSearch(async params => (await policyApi.targets(params)).data, state => Object.assign(targetSearch, state))
const targetChoices = computed(() => selectedTarget.value ? [selectedTarget.value, ...targetSearch.items.filter(item => item.id !== selectedTarget.value.id)] : targetSearch.items)
const searchTargets = q => targetLoader.search(assignment.scope_type, q)
const selectTarget = id => { selectedTarget.value = targetChoices.value.find(item => item.id === id) || null }
watch(() => assignment.scope_type, () => { assignment.target_id = null; selectedTarget.value = null; targetLoader.reset(); if (assignment.visible) searchTargets('') })
watch(() => assignment.visible, visible => { if (!visible) { targetLoader.reset(); selectedTarget.value = null } })
onBeforeUnmount(() => targetLoader.reset())
const inspector = reactive({ visible: false, mode: 'preview', data: {} })
const scopes = [{ value: 'user_group', label: 'UserGroupScope' }, { value: 'user', label: 'UserScope' }, { value: 'device_group', label: 'DeviceGroupScope' }, { value: 'device', label: 'DeviceScope' }]
const statusLabel = { draft: 'Draft', validated: 'Validated', published: 'Published' }
const statusType = { draft: 'warning', validated: 'primary', published: 'success' }
const load = async () => { result.loading = true; const res = await policyApi.list(query).catch(() => false); result.loading = false; if (res) Object.assign(result, res.data) }
const resetEditor = () => {editorGeneration++;return Object.assign(editor, { id: 0, loading:false,failed:false, name: '', description: '', change_summary: '', configText: JSON.stringify({options:{"direct-server":"N"}},null,2) })}
const openCreate = () => { resetEditor(); editor.visible = true }
const openEdit = async row => { resetEditor();Object.assign(editor,{id:row.id,name:row.name,visible:true,loading:true,failed:false});const current=editorGeneration;try{const {policy,version}=(await policyApi.detail(row.id)).data;if(current!==editorGeneration || !editor.visible)return;Object.assign(editor,policy,{configText:JSON.stringify(JSON.parse(version.config),null,2)})}catch{if(current===editorGeneration)editor.failed=true}finally{if(current===editorGeneration)editor.loading=false} }
const save = async () => { if(editor.saving || editor.loading || editor.failed)return; let config; try { config = JSON.parse(editor.configText) } catch { ElMessage.error(T('InvalidJson')); return } editor.saving = true; const request = editor.id ? policyApi.update : policyApi.create; const res = await request({ ...editor, config }).catch(() => false); editor.saving = false; if (!res) return; ElMessage.success(T('OperationSuccess')); editor.visible = false; load() }
const publishPolicy = async row => { const ok = await ElMessageBox.confirm(T('PublishConfirm'), { type: 'warning' }).catch(() => false); if (!ok) return; const res = await policyApi.publish({ id: row.id }).catch(() => false); if (res) { ElMessage.success(T('OperationSuccess')); load() } }
const validatePolicy = async row => { const res = await policyApi.validate({ id: row.id }).catch(() => false); if (res) { ElMessage.success(T('PolicyValidated')); load() } }
const loadAssignments=async()=>{assignment.loading=true;assignment.failed=false;const id=assignment.policy_id;try{const res=await policyApi.assignments(id);if(id===assignment.policy_id)assignment.list=res.data}catch{assignment.failed=true}finally{assignment.loading=false}}
const openAssign = row => { cancelRemove();targetLoader.reset();selectedTarget.value=null;Object.assign(assignment, { visible: true, policy_id: row.id, scope_type: 'device', target_id: null, priority: 0,list:[] });loadAssignments();searchTargets('') }
const removeAssignment=async row=>{if(assignment.saving)return;if(armed.value!==row.id){cancelRemove();armed.value=row.id;removeTimer=setTimeout(cancelRemove,5000);return}cancelRemove();assignment.saving=true;try{await policyApi.unassign({policy_id:assignment.policy_id,assignment_id:row.id});await loadAssignments();ElMessage.success(T('OperationSuccess'))}catch{}finally{assignment.saving=false}}
const saveAssignment = async () => { if(assignment.saving || !assignment.target_id || targetSearch.loading || targetSearch.failed)return;assignment.saving=true;const res = await policyApi.assign({ policy_id:assignment.policy_id,scope_type:assignment.scope_type,target_id:assignment.target_id,priority:assignment.priority }).catch(() => false);assignment.saving=false; if (res) { ElMessage.success(T('OperationSuccess')); await loadAssignments() } }
const openPreview = async row => { const res = await policyApi.preview(row.id).catch(() => false); if (res) Object.assign(inspector, { visible: true, mode: 'preview', data: res.data }) }
const openHistory = async row => { const res = await policyApi.history(row.id).catch(() => false); if (res) Object.assign(inspector, { visible: true, mode: 'history', data: res.data }) }
watch(() => [query.page, query.page_size], load)
watch(()=>assignment.visible,cancelRemove)
onBeforeUnmount(cancelRemove)
onMounted(()=>{load();loadCatalog()})
</script>

<style scoped>
.console-dialog :deep(.el-select){width:100%}.el-option .el-tag{margin-left:8px}.policy-guidance{display:grid;gap:10px}.policy-guidance p,.policy-note{color:var(--console-muted);line-height:1.6;margin:0}.policy-guidance small{display:block;color:var(--console-muted);overflow-wrap:anywhere}.policy-guidance :deep(.el-select){width:100%}.policy-note{margin:12px 0}.policy-options-mobile{display:none}.policy-option-mobile{display:grid;gap:6px;border-bottom:1px solid var(--console-border);padding-bottom:10px}@media(max-width:600px){.policy-options-table{display:none}.policy-options-mobile{display:grid;gap:12px}}
</style>
