<template>
  <el-card shadow="never" class="web-client-settings" v-loading="loading" :aria-busy="loading">
    <template #header><div class="panel-head"><strong>{{ T('WebClientSettingsTitle') }}</strong><el-button type="primary" :disabled="loading || failed || saving" @click="openEditor()"><el-icon aria-hidden="true"><Plus/></el-icon><span>{{ T('WebClientAddScope') }}</span></el-button></div></template>
    <el-alert v-if="failed" :title="T('WebClientLoadFailed')" type="error" :closable="false" show-icon><el-button link type="primary" @click="load">{{ T('Retry') }}</el-button></el-alert>
    <div class="web-client-default">
      <el-form label-position="top"><el-form-item :label="T('WebClientGlobalDefault')">
        <el-select v-model="defaultKey" :disabled="loading || failed || saving" :aria-label="T('WebClientGlobalDefault')"><el-option v-for="option in options" :key="option.key" :value="option.key" :label="optionLabel(option)" :disabled="!option.available"/></el-select>
      </el-form-item></el-form>
      <el-button type="primary" :loading="saving" :disabled="loading || failed || defaultKey === savedDefault || !available(defaultKey)" @click="saveDefault"><el-icon aria-hidden="true"><Check/></el-icon><span>{{ T('Save') }}</span></el-button>
    </div>
    <p class="web-client-note">{{ T('WebClientScopeOrder') }}</p>
    <p v-if="options.some(item => !item.available)" class="web-client-note">{{ T('WebClientResourcesNeeded') }}</p>
    <el-table :data="scopeRules" :empty-text="T('WebClientNoScopeRules')" class="console-action-table web-client-rules-table">
      <el-table-column :label="T('AssignmentScope')" min-width="115"><template #default="{row}">{{ scopeLabel(row.scope_type) }}</template></el-table-column>
      <el-table-column :label="T('PolicyTarget')" min-width="180"><template #default="{row}"><span :class="{'is-missing':row.target_missing}">{{ row.target_missing ? T('PolicyTargetMissing') : policyTargetLabel({name:row.target_name,detail:row.target_detail}) }}</span></template></el-table-column>
      <el-table-column :label="T('WebClientChosen')" min-width="160"><template #default="{row}">{{ clientLabel(row.client_key) }}<el-tag v-if="!available(row.client_key)" type="warning" size="small">{{ T('WebClientNotReady') }}</el-tag></template></el-table-column>
      <el-table-column :label="T('Actions')" width="100" fixed="right"><template #default="{row}"><el-tooltip :content="T('Edit')"><el-button class="console-action-button" type="primary" circle :disabled="saving || row.target_missing" :aria-label="T('Edit')" @click="openEditor(row)"><el-icon aria-hidden="true"><Edit/></el-icon></el-button></el-tooltip><InlineConfirmButton circle :label="T('WebClientRemoveScope')" :confirm-key="`${row.id}:${row.revision}`" :disabled="saving" :action="() => removeRule(row)"/></template></el-table-column>
    </el-table>
    <div class="web-client-rules-mobile">
      <p v-if="!scopeRules.length" class="web-client-note">{{ T('WebClientNoScopeRules') }}</p>
      <article v-for="row in scopeRules" :key="row.id" class="web-client-rule">
        <div class="web-client-rule-copy"><strong>{{ scopeLabel(row.scope_type) }}</strong><span :class="{'is-missing':row.target_missing}">{{ row.target_missing ? T('PolicyTargetMissing') : policyTargetLabel({name:row.target_name,detail:row.target_detail}) }}</span><small>{{ clientLabel(row.client_key) }}<el-tag v-if="!available(row.client_key)" type="warning" size="small">{{ T('WebClientNotReady') }}</el-tag></small></div>
        <div class="web-client-rule-actions"><el-tooltip :content="T('Edit')"><el-button class="console-action-button" type="primary" circle :disabled="saving || row.target_missing" :aria-label="`${T('Edit')} ${scopeLabel(row.scope_type)}`" @click="openEditor(row)"><el-icon aria-hidden="true"><Edit/></el-icon></el-button></el-tooltip><InlineConfirmButton circle :label="`${T('WebClientRemoveScope')} ${scopeLabel(row.scope_type)}`" :confirm-key="`${row.id}:${row.revision}`" :disabled="saving" :action="() => removeRule(row)"/></div>
      </article>
    </div>
    <el-dialog v-model="editor.visible" class="console-dialog" :title="T(editor.id ? 'WebClientEditScope' : 'WebClientAddScope')" width="min(560px, calc(100vw - 24px))" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving">
      <el-form label-position="top" :disabled="saving">
        <el-form-item :label="T('AssignmentScope')"><el-select v-model="editor.scope_type" :disabled="!!editor.id" :aria-label="T('AssignmentScope')"><el-option v-for="scope in scopes" :key="scope.value" :value="scope.value" :label="T(scope.label)"/></el-select></el-form-item>
        <el-form-item :label="T('PolicyTarget')"><el-select v-model="editor.target_id" filterable remote :remote-method="searchTargets" :loading="targetSearch.loading" :disabled="!!editor.id" :aria-label="T('PolicyTarget')" :placeholder="T('PolicyTargetSearch')" @change="selectTarget"><el-option v-for="target in targetChoices" :key="target.id" :value="target.id" :label="policyTargetLabel(target)"/></el-select></el-form-item>
        <el-alert v-if="targetSearch.failed" type="error" :closable="false" :title="T('PolicyTargetLoadFailed')"><el-button link type="primary" @click="searchTargets('')">{{ T('Retry') }}</el-button></el-alert>
        <el-form-item :label="T('WebClientChosen')"><el-select v-model="editor.client_key" :aria-label="T('WebClientChosen')"><el-option v-for="option in options" :key="option.key" :value="option.key" :label="optionLabel(option)" :disabled="!option.available"/></el-select></el-form-item>
      </el-form>
      <template #footer><el-button :disabled="saving" @click="editor.visible=false">{{ T('Cancel') }}</el-button><el-button type="primary" :loading="saving" :disabled="!editor.target_id || targetSearch.loading || targetSearch.failed || !available(editor.client_key)" @click="saveRule">{{ T('Save') }}</el-button></template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Check, Edit, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import InlineConfirmButton from '@/components/InlineConfirmButton.vue'
import * as api from '@/api/webClientSelection'
import { createPolicyTargetSearch, policyTargetLabel } from '@/utils/policyTargets'
import { T } from '@/utils/i18n'

const loading=ref(false),failed=ref(false),saving=ref(false),options=ref([]),rules=ref([])
const defaultKey=ref('v2'),savedDefault=ref('v2')
const scopes=[{value:'device',label:'DeviceScope'},{value:'device_group',label:'DeviceGroupScope'},{value:'user',label:'UserScope'},{value:'user_group',label:'UserGroupScope'}]
const scopeLabel=scope=>T(scopes.find(item=>item.value===scope)?.label || 'WebClientGlobalDefault')
const clientLabel=key=>T(key==='rede'?'WebClientReDe':'WebClientV2')
const available=key=>options.value.some(item=>item.key===key && item.available)
const optionLabel=option=>`${clientLabel(option.key)}${option.available?'':` (${T('WebClientNotReady')})`}`
const scopeRules=computed(()=>rules.value.filter(row=>row.scope_type!=='global'))
const editor=reactive({visible:false,id:0,scope_type:'device',target_id:null,client_key:'v2',revision:0})
const targetSearch=reactive({items:[],loading:false,failed:false}),selectedTarget=ref(null)
const targetLoader=createPolicyTargetSearch(async params=>(await api.targets(params)).data,state=>Object.assign(targetSearch,state))
const targetChoices=computed(()=>selectedTarget.value?[selectedTarget.value,...targetSearch.items.filter(item=>item.id!==selectedTarget.value.id)]:targetSearch.items)
const searchTargets=q=>targetLoader.search(editor.scope_type,q)
const selectTarget=id=>{selectedTarget.value=targetChoices.value.find(item=>item.id===id)||null}
watch(()=>editor.scope_type,()=>{if(editor.id)return;editor.target_id=null;selectedTarget.value=null;targetLoader.reset();if(editor.visible)searchTargets('')})
watch(()=>editor.visible,visible=>{if(!visible){targetLoader.reset();selectedTarget.value=null}})
let generation=0
const load=async()=>{
  const current=++generation;loading.value=true;failed.value=false
  try{const {data}=await api.settings();if(current!==generation)return;options.value=data.options;rules.value=data.rules;savedDefault.value=data.default_key;defaultKey.value=data.default_key}
  catch{if(current===generation)failed.value=true}
  finally{if(current===generation)loading.value=false}
}
const openEditor=row=>{
  targetLoader.reset();selectedTarget.value=row?{id:row.target_id,name:row.target_name,detail:row.target_detail}:null
  Object.assign(editor,row?{id:row.id,scope_type:row.scope_type,target_id:row.target_id,client_key:row.client_key,revision:row.revision}:{id:0,scope_type:'device',target_id:null,client_key:defaultKey.value,revision:0})
  editor.visible=true;if(!row)searchTargets('')
}
const execute=async action=>{
  if(saving.value)return;saving.value=true
  try{await action();editor.visible=false;await load();ElMessage.success(T('OperationSuccess'))}
  catch{ /* 오류 안내는 공통 API 처리에서 표시한다. */ }
  finally{saving.value=false}
}
const saveDefault=()=>execute(()=>api.save({scope_type:'global',target_id:0,client_key:defaultKey.value,revision:rules.value.find(row=>row.scope_type==='global')?.revision||0}))
const saveRule=()=>{if(!editor.target_id || targetSearch.loading || targetSearch.failed || !available(editor.client_key))return;return execute(()=>api.save({scope_type:editor.scope_type,target_id:editor.target_id,client_key:editor.client_key,revision:editor.revision}))}
const removeRule=row=>execute(()=>api.remove({id:row.id,revision:row.revision}))
onMounted(load)
onBeforeUnmount(()=>{generation++;targetLoader.reset()})
defineExpose({load})
</script>

<style scoped>
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.web-client-default{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-top:12px}
.web-client-default .el-form{flex:1;min-width:180px;max-width:340px}.web-client-default .el-form-item{margin-bottom:0}
.web-client-default :deep(.el-select),.console-dialog :deep(.el-select){width:100%}
.web-client-note{color:var(--console-muted);font-size:12px;line-height:1.5;margin:12px 0}
.el-tag{margin-left:6px}.is-missing{color:var(--console-warning)}
.web-client-rules-mobile{display:none}.web-client-rule{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-bottom:1px solid var(--console-border)}.web-client-rule:last-child{border-bottom:0}
.web-client-rule-copy{display:grid;gap:5px;min-width:0;overflow-wrap:anywhere}.web-client-rule-copy strong{font-size:13px}.web-client-rule-copy small{color:var(--console-muted)}.web-client-rule-actions{display:flex;gap:6px;flex:0 0 auto}
@media(max-width:600px){.web-client-default .el-form{max-width:none}.panel-head .el-button{margin-left:0}.web-client-rules-table{display:none}.web-client-rules-mobile{display:grid}}
</style>
