<template>
  <el-tooltip :content="os || T('Unknown')">
    <span class="peer-os-icon" :class="`is-${iconName || 'unknown'}`">
      <PlatformIcons v-if="iconName" :name="iconName" />
      <el-icon v-else><Monitor /></el-icon>
    </span>
  </el-tooltip>
</template>

<script setup>
import { computed } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import PlatformIcons from '@/components/icons/platform.vue'
import { T } from '@/utils/i18n'

const props = defineProps({ os: { type: String, default: '' } })
const iconName = computed(() => {
  const normalized = props.os.toLowerCase()
  if (normalized.includes('windows')) return 'windows'
  if (normalized.includes('android')) return 'android'
  if (normalized.includes('mac') || normalized.includes('darwin') || normalized.includes('ios')) return 'mac'
  if (normalized.includes('linux') || normalized.includes('ubuntu') || normalized.includes('debian')) return 'linux'
  return ''
})
</script>

<style scoped lang="scss">
.peer-os-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 5px;
  color: var(--console-neutral);
  background: var(--console-neutral-soft);
  border-radius: 6px;
  box-sizing: border-box;
}

.peer-os-icon.is-windows { color: #1677d2; background: #e8f3fc; }
.peer-os-icon.is-android { color: #2f9e44; background: #eaf7ed; }
.peer-os-icon.is-mac { color: #344054; background: #eef1f4; }
.peer-os-icon.is-linux { color: #b86b12; background: #fff4e6; }
.peer-os-icon svg { width: 100%; height: 100%; }
</style>
