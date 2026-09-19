<template>
  <div>
    <el-card class="list-query" shadow="never">
      <div class="list-filter-row">
        <div>
          <strong>{{ T('PolicyManage') }}</strong>
          <p class="list-filter-hint">{{ T('PolicyDescription') }}</p>
        </div>
        <el-button type="primary" :icon="Plus" @click="openCreate">{{ T('AddPolicy') }}</el-button>
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
            <el-tooltip :content="T('Edit')"><el-button circle :icon="Edit" @click="openEdit(row)" /></el-tooltip>
            <el-tooltip :content="T('AssignPolicy')"><el-button circle :icon="Connection" @click="openAssign(row)" /></el-tooltip>
            <el-tooltip :content="T('Preview')"><el-button circle :icon="View" @click="openPreview(row)" /></el-tooltip>
            <el-tooltip :content="T('History')"><el-button circle :icon="Clock" @click="openHistory(row)" /></el-tooltip>
            <el-tooltip v-if="row.status === 'draft'" :content="T('ValidatePolicy')"><el-button circle type="primary" :icon="CircleCheck" @click="validatePolicy(row)" /></el-tooltip>
            <el-tooltip v-if="row.status === 'validated'" :content="T('Publish')"><el-button circle type="success" :icon="Upload" @click="publishPolicy(row)" /></el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card class="list-page" shadow="never">
      <el-pagination v-model:page-size="query.page_size" v-model:current-page="query.page" background layout="prev, pager, next, sizes" :total="result.total" />
    </el-card>

    <el-dialog v-model="editor.visible" class="console-dialog" :title="T(editor.id ? 'EditPolicy' : 'AddPolicy')" width="720" :close-on-click-modal="false">
      <el-form label-position="top">
        <div class="dialog-form dialog-form--grid">
          <el-form-item :label="T('PolicyName')"><el-input v-model="editor.name" /></el-form-item>
          <el-form-item :label="T('ChangeSummary')"><el-input v-model="editor.change_summary" /></el-form-item>
          <el-form-item class="dialog-form__wide" :label="T('Description')"><el-input v-model="editor.description" /></el-form-item>
          <el-form-item class="dialog-form__wide" :label="T('PolicyConfigJson')">
            <el-input v-model="editor.configText" type="textarea" :rows="12" spellcheck="false" />
          </el-form-item>
        </div>
      </el-form>
      <template #footer><el-button @click="editor.visible = false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="editor.saving" @click="save">{{ T('Save') }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="assignment.visible" class="console-dialog" :title="T('AssignPolicy')" width="560">
      <el-form label-position="top">
        <el-form-item :label="T('AssignmentScope')"><el-select v-model="assignment.scope_type"><el-option v-for="scope in scopes" :key="scope.value" :label="T(scope.label)" :value="scope.value" /></el-select></el-form-item>
        <el-form-item :label="T('TargetId')"><el-input-number v-model="assignment.target_id" :min="1" controls-position="right" /></el-form-item>
        <el-form-item :label="T('Priority')"><el-input-number v-model="assignment.priority" controls-position="right" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="assignment.visible = false">{{ T('Cancel') }}</el-button><el-button type="primary" @click="saveAssignment">{{ T('Assign') }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="inspector.visible" class="console-dialog" :title="T(inspector.mode === 'history' ? 'PolicyHistory' : 'PolicyPreview')" width="680">
      <el-table v-if="inspector.mode === 'history'" :data="inspector.data" border><el-table-column prop="version" :label="T('Version')" width="100" /><el-table-column prop="change_summary" :label="T('ChangeSummary')" /><el-table-column prop="published_at" :label="T('PublishedAt')" width="140" /></el-table>
      <el-descriptions v-else :column="1" border><el-descriptions-item :label="T('AffectedDevices')">{{ inspector.data.target_count || 0 }}</el-descriptions-item><el-descriptions-item :label="T('ChangedFields')">{{ (inspector.data.changed_fields || []).join(', ') || '-' }}</el-descriptions-item><el-descriptions-item :label="T('Validation')">{{ inspector.data.valid ? T('Valid') : T('Invalid') }}</el-descriptions-item></el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { CircleCheck, Clock, Connection, Edit, Plus, Upload, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as policyApi from '@/api/policy'
import { T } from '@/utils/i18n'

const query = reactive({ page: 1, page_size: 10 })
const result = reactive({ list: [], total: 0, loading: false })
const editor = reactive({ visible: false, saving: false, id: 0, name: '', description: '', change_summary: '', configText: '{\n  \"options\": {}\n}' })
const assignment = reactive({ visible: false, policy_id: 0, scope_type: 'device', target_id: 1, priority: 0 })
const inspector = reactive({ visible: false, mode: 'preview', data: {} })
const scopes = [{ value: 'user_group', label: 'UserGroupScope' }, { value: 'user', label: 'UserScope' }, { value: 'device_group', label: 'DeviceGroupScope' }, { value: 'device', label: 'DeviceScope' }]
const statusLabel = { draft: 'Draft', validated: 'Validated', published: 'Published' }
const statusType = { draft: 'warning', validated: 'primary', published: 'success' }
const load = async () => { result.loading = true; const res = await policyApi.list(query).catch(() => false); result.loading = false; if (res) Object.assign(result, res.data) }
const resetEditor = () => Object.assign(editor, { id: 0, name: '', description: '', change_summary: '', configText: '{\n  \"options\": {}\n}' })
const openCreate = () => { resetEditor(); editor.visible = true }
const openEdit = async row => { resetEditor(); const res = await policyApi.detail(row.id).catch(() => false); if (!res) return; const { policy, version } = res.data; Object.assign(editor, policy, { configText: JSON.stringify(JSON.parse(version.config), null, 2), visible: true }) }
const save = async () => { let config; try { config = JSON.parse(editor.configText) } catch { ElMessage.error(T('InvalidJson')); return } editor.saving = true; const request = editor.id ? policyApi.update : policyApi.create; const res = await request({ ...editor, config }).catch(() => false); editor.saving = false; if (!res) return; ElMessage.success(T('OperationSuccess')); editor.visible = false; load() }
const publishPolicy = async row => { const ok = await ElMessageBox.confirm(T('PublishConfirm'), { type: 'warning' }).catch(() => false); if (!ok) return; const res = await policyApi.publish({ id: row.id }).catch(() => false); if (res) { ElMessage.success(T('OperationSuccess')); load() } }
const validatePolicy = async row => { const res = await policyApi.validate({ id: row.id }).catch(() => false); if (res) { ElMessage.success(T('PolicyValidated')); load() } }
const openAssign = row => { Object.assign(assignment, { visible: true, policy_id: row.id, scope_type: 'device', target_id: 1, priority: 0 }) }
const saveAssignment = async () => { const res = await policyApi.assign({ ...assignment }).catch(() => false); if (res) { ElMessage.success(T('OperationSuccess')); assignment.visible = false } }
const openPreview = async row => { const res = await policyApi.preview(row.id).catch(() => false); if (res) Object.assign(inspector, { visible: true, mode: 'preview', data: res.data }) }
const openHistory = async row => { const res = await policyApi.history(row.id).catch(() => false); if (res) Object.assign(inspector, { visible: true, mode: 'history', data: res.data }) }
watch(() => [query.page, query.page_size], load)
onMounted(load)
</script>
