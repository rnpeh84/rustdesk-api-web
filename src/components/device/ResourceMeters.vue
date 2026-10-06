<template>
  <div class="resource-meters" :aria-label="T('TerminalResources')" :title="T('TerminalResourcesCadence')">
    <div v-for="item in items" :key="item.key" class="resource-meter" :class="{ 'is-high': item.value >= 90, 'is-warning': item.value >= 75 && item.value < 90, 'is-unknown': item.value === null }" :title="item.label + (item.key === 'disk_percent' && resources?.disk_path ? ' · ' + resources.disk_path : '') + ': ' + (item.value === null ? T('TerminalResourcesMissing') : item.value + '%')">
      <span>{{ item.label }}</span><span class="meter-track" role="meter" :aria-label="item.label" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="item.value ?? undefined" :aria-valuetext="item.value === null ? T('TerminalResourcesMissing') : item.value + '%'"><i :style="{width:(item.value ?? 0)+'%'}"/></span><b>{{ item.value === null ? '—' : Math.round(item.value) + '%' }}</b>
    </div>
    <el-tooltip :content="freshnessTitle" :trigger="['hover','focus']" placement="bottom">
      <time class="resource-freshness" :class="`is-${freshnessKind}`" :datetime="reportedValid ? new Date(reportedAt*1000).toISOString() : undefined" :aria-label="freshnessTitle" tabindex="0"><span class="report-cycle" :style="{'--report-fill':reportFill+'%'}" aria-hidden="true"/></time>
    </el-tooltip>
  </div>
</template>
<script setup>
import { computed, ref, onBeforeUnmount } from 'vue'
import { T } from '@/utils/i18n'
const props=defineProps({resources:Object,reportedAt:Number,active:Boolean})
const now=ref(Date.now()), timer=setInterval(()=>now.value=Date.now(),1000)
onBeforeUnmount(()=>clearInterval(timer))
const fresh=computed(()=>props.active && props.reportedAt>0 && now.value/1000-props.reportedAt<=90 && props.reportedAt<=now.value/1000+5)
const items=computed(()=>[['cpu_percent','CPU'],['memory_percent',T('TerminalMemory')],['disk_percent',T('TerminalDisk')]].map(([key,label])=>{const value=props.resources?.[key];return {key,label,value:fresh.value&&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100?value:null}}))
const reportedValid=computed(()=>Number.isFinite(props.reportedAt)&&props.reportedAt>0&&props.reportedAt<=now.value/1000+5)
const ageSeconds=computed(()=>reportedValid.value?Math.max(0,Math.floor(now.value/1000-props.reportedAt)):0)
const reportFill=computed(()=>reportedValid.value?Math.min(100,ageSeconds.value/30*100):0)
const freshnessKind=computed(()=>!reportedValid.value?'missing':!props.active||ageSeconds.value>90?'stale':items.value.some(item=>item.value!==null)?'fresh':'missing')
const freshnessText=computed(()=>freshnessKind.value==='fresh'?T('TerminalResourcesAge',{count:ageSeconds.value}):T(freshnessKind.value==='stale'?'TerminalResourcesStale':'TerminalResourcesWaiting'))
const freshnessTitle=computed(()=>freshnessText.value+' · '+T('TerminalResourcesLastReport',{time:reportedValid.value?new Date(props.reportedAt*1000).toLocaleString():T('TerminalResourcesWaiting')})+' · '+T('TerminalResourcesCadence'))
</script>
<style scoped>
.resource-meters{display:flex;gap:16px;min-width:0;align-items:center}.resource-meter{display:flex;gap:5px;align-items:center;white-space:nowrap;color:#aebdd1;font-size:11px;--meter-color:#61b9b0}.resource-meter>span:first-child{font-weight:500}.meter-track{display:block;width:56px;height:5px;overflow:hidden;border-radius:3px;background:#394458}.meter-track i{display:block;height:100%;border-radius:3px;background:var(--meter-color);transition:width .3s ease}.resource-meter b{font-weight:500;font-variant-numeric:tabular-nums;min-width:29px;color:#e8eef7}.is-warning{--meter-color:#e2b866}.is-high{--meter-color:#e58080}.is-unknown .meter-track{opacity:.4}@media(max-width:600px){.resource-meters{gap:8px}.resource-meter{font-size:10px;gap:3px}.meter-track{width:27px}.resource-meter b{min-width:23px}}@media(prefers-reduced-motion:reduce){.meter-track i{transition:none}}
</style>
<style scoped>
.resource-freshness{flex:none;display:flex;align-items:center;justify-content:center;padding:2px;color:#9eafc5;font-size:14px;border-radius:4px;cursor:help}.resource-freshness.is-fresh{color:#69c4a7}.resource-freshness.is-stale{color:#e2b866}.resource-freshness:focus-visible{outline:2px solid #79c6f4;outline-offset:2px}
.report-cycle{display:block;width:14px;height:14px;border:1px solid currentColor;border-radius:50%;background:conic-gradient(currentColor var(--report-fill),#394458 0);box-shadow:inset 0 0 0 2px #192231}
@media(max-width:600px){.resource-meters{gap:6px}.resource-freshness{font-size:12px}.meter-track{width:22px}}
</style>
