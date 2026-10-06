<template>
  <div v-if="position" ref="element" class="workspace-context-menu" role="menu" :aria-label="label" :style="location" @contextmenu.prevent.stop @keydown="keyboard">
    <template v-for="item in items" :key="item.id"><div v-if="item.separator" role="separator"/><button v-else role="menuitem" :aria-label="item.label" :disabled="item.disabled" :class="{ 'is-danger': item.danger }" @click="choose(item.id)"><span>{{ item.label }}</span><kbd v-if="item.shortcut">{{ item.shortcut }}</kbd></button></template>
  </div>
</template>
<script setup>
import { computed, nextTick, ref, watch, onBeforeUnmount, onMounted } from 'vue'
const props=defineProps({position:Object,items:{type:Array,default:()=>[]},label:String})
const emit=defineEmits(['close','action'])
const element=ref(null), x=ref(0), y=ref(0)
const location=computed(()=>({left:x.value+'px',top:y.value+'px'}))
let trigger
const close=(restore=true)=>{emit('close');if(restore && trigger?.isConnected)trigger.focus()}
const choose=id=>{const context=props.position;close();emit('action',id,context)}
watch(()=>props.position,async value=>{
  if(!value)return
  trigger=value.trigger || document.activeElement
  x.value=Math.max(4,value.x);y.value=Math.max(4,value.y)
  await nextTick()
  const bounds=element.value?.getBoundingClientRect()
  if(!bounds)return
  x.value=Math.max(4,Math.min(value.x,innerWidth-bounds.width-4));y.value=Math.max(4,Math.min(value.y,innerHeight-bounds.height-4))
  element.value.querySelector('button:not(:disabled)')?.focus()
})
const keyboard=event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return}
  if(event.key==='Tab'){close();return}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
  event.preventDefault()
  const buttons=Array.from(element.value.querySelectorAll('button:not(:disabled)')),index=buttons.indexOf(document.activeElement)
  buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()
}
const outside=event=>{if(props.position && !element.value?.contains(event.target))close(false)}
const viewport=()=>{if(props.position)close(false)}
onMounted(()=>{document.addEventListener('pointerdown',outside);window.addEventListener('resize',viewport)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',viewport)})
</script>
<style scoped>
.workspace-context-menu{position:fixed;z-index:10000;width:232px;max-width:calc(100vw - 8px);max-height:calc(100dvh - 8px);overflow-y:auto;overscroll-behavior:contain;padding:5px;border:1px solid var(--el-border-color);border-radius:7px;background:var(--el-bg-color-overlay);box-shadow:0 8px 24px #17202e26;display:flex;flex-direction:column;color:var(--el-text-color-primary)}
button{display:flex;align-items:center;gap:16px;justify-content:space-between;flex:none;background:none;border:0;border-radius:4px;color:inherit;padding:8px 10px;text-align:left;font:inherit;font-size:12px;line-height:1.5;cursor:pointer}button>span{min-width:0;overflow-wrap:anywhere}button:hover,button:focus-visible{background:var(--el-fill-color-light);outline:2px solid var(--el-color-primary);outline-offset:-2px}button:disabled{color:var(--el-text-color-placeholder);cursor:default;outline:none}button.is-danger:not(:disabled){color:var(--el-color-danger)}kbd{flex:none;color:var(--el-text-color-secondary);font:inherit;font-size:10px}[role=separator]{height:1px;margin:4px 5px;background:var(--el-border-color-lighter);flex:none}
</style>
