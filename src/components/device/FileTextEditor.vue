<template>
  <el-dialog class="terminal-owned-dialog file-text-editor" :model-value="modelValue" :title="T('FilesEditor')+' · '+name" width="min(1000px, calc(100vw - 24px))" append-to-body :close-on-click-modal="false" :before-close="requestClose">
    <div class="editor-meta"><span>{{ path }}</span><span>{{ readOnly ? T('FilesReadOnlyShort') : T('FilesWritable') }} · UTF-8</span></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-input ref="input" :model-value="text" type="textarea" :disabled="loading || saving" :readonly="readOnly" :aria-label="T('FilesEditorContent')" :autosize="false" spellcheck="false" autocorrect="off" autocapitalize="off" wrap="off" @update:model-value="$emit('update:text',$event)" @keydown.tab="insertTab"/>
    <div class="editor-meta"><span>{{ T('FilesEditorLines',{count:lineCount}) }} · {{ bytes.toLocaleString() }} B</span><span v-if="dirty">{{ T('FilesEditorUnsaved') }}</span></div>
    <template #footer><el-button :disabled="saving" @click="requestClose">{{ T('Close') }}</el-button><el-button v-if="!readOnly" type="primary" :loading="saving" :disabled="loading || !dirty || bytes>1048576" @click="$emit('save')">{{ T('Save') }}</el-button></template>
  </el-dialog>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import { T } from '@/utils/i18n'
const props=defineProps({modelValue:Boolean,name:String,path:String,text:String,original:String,readOnly:Boolean,loading:Boolean,saving:Boolean,error:String})
const emit=defineEmits(['update:modelValue','update:text','save'])
const input=ref(null),dirty=computed(()=>props.text!==props.original),bytes=computed(()=>new TextEncoder().encode(props.text||'').length),lineCount=computed(()=>1+(props.text?.match(/\n/g)?.length||0))
const requestClose=async()=>{if(props.saving)return;if(dirty.value){try{await ElMessageBox.confirm(T('FilesEditorDiscard'),T('FilesEditor'),{customClass:'terminal-owned-dialog',type:'warning',confirmButtonText:T('FilesEditorDiscardButton'),cancelButtonText:T('Cancel')})}catch{return}}emit('update:modelValue',false)}
const insertTab=event=>{if(props.readOnly||props.loading||props.saving)return;event.preventDefault();const textarea=event.target,start=textarea.selectionStart,end=textarea.selectionEnd;emit('update:text',props.text.slice(0,start)+'\t'+props.text.slice(end));requestAnimationFrame(()=>textarea.setSelectionRange(start+1,start+1))}
</script>
<style scoped>
.editor-meta{display:flex;justify-content:space-between;gap:16px;font-size:11px;line-height:1.6;color:var(--el-text-color-secondary);padding:8px 0}.editor-meta>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.editor-meta>span:last-child{flex:none}.el-textarea :deep(textarea){height:min(55dvh,560px);min-height:140px;resize:none;font-family:Consolas,"SFMono-Regular",monospace;font-size:13px;line-height:1.6;tab-size:4;white-space:pre;background:#111925;color:#d6e1ef;padding:12px}.el-alert{margin-bottom:8px}
</style>
<style>
.file-text-editor.el-dialog{margin:12px auto;max-height:calc(100dvh - 24px)}
.file-text-editor .el-textarea textarea{height:min(55dvh,560px,calc(100dvh - 230px));min-height:80px}
</style>
