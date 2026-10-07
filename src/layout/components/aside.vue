<template>
  <div class="sidebar-shell">
    <div class="sidebar-brand">
      <img :src="setting.logo" :alt="forceExpanded || !setting.sideIsCollapse ? '' : setting.title" width="36" height="36" class="sidebar-brand__logo">
      <div v-show="forceExpanded || !setting.sideIsCollapse" class="sidebar-brand__identity">
        <span class="sidebar-brand__title" :class="{ 'sidebar-brand__title--re-de': setting.title === 'Re;De' }"><BrandName :title="setting.title" /></span>
        <span v-if="setting.title === 'Re;De'" class="sidebar-brand__subtitle">Remote Desktop</span>
      </div>
    </div>
    <el-scrollbar class="scroll-sidebar">
      <menus :force-expanded="forceExpanded"></menus>
    </el-scrollbar>
  </div>
</template>
<script setup>
  import { computed } from 'vue'
  import Menus from '@/layout/components/menu/index.vue'
  import { useAppStore } from '@/store/app'
  import BrandName from '@/components/BrandName.vue'

  defineProps({
    forceExpanded: {
      type: Boolean,
      default: false,
    },
  })
  const appStore = useAppStore()
  const setting = computed(() => appStore.setting)
</script>

<style scoped lang="scss">
.sidebar-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--console-sidebar);
}

.sidebar-brand {
  flex: 0 0 var(--console-header-height);
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--console-border);
}

.sidebar-brand__logo {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.sidebar-brand__title {
  overflow: hidden;
  color: var(--console-heading);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scroll-sidebar {
  flex: 1 1 auto;
  background: var(--console-sidebar);
}
.sidebar-brand .sidebar-brand__title--re-de { font-size: 25px; white-space: nowrap; }
.sidebar-brand__title :deep(.brand-name__separator) { color: #7adcf5; }
.sidebar-brand__identity { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.sidebar-brand__subtitle { color: var(--console-muted); font-size: 10px; font-weight: 400; letter-spacing: 0.055em; line-height: 1; white-space: nowrap; }
</style>
