<template>
  <el-button
      class="nav-toggle"
      text
      :aria-label="T('Menu')"
      @click="toggleMenu"
  >
    <el-icon :size="20">
      <Menu v-if="isMobile"/>
      <Expand v-else-if="setting.sideIsCollapse"/>
      <Fold v-else/>
    </el-icon>
  </el-button>
  <div class="portainer-header-trail">
    <el-icon aria-hidden="true"><House/></el-icon>
    <el-icon aria-hidden="true"><ArrowRight/></el-icon>
    <span>{{ sectionTitle }}</span>
    <template v-if="sectionTitle !== pageTitle">
      <el-icon aria-hidden="true"><ArrowRight/></el-icon>
      <span>{{ pageTitle }}</span>
    </template>
  </div>
  <div class="header-status">
    <span class="status-dot" aria-hidden="true"></span>
    <span>{{ setting.title }}</span>
  </div>
  <Setting></Setting>
</template>

<script setup>
  import { computed } from 'vue'
  import { ArrowRight, Expand, Fold, House, Menu } from '@element-plus/icons-vue'
  import Setting from '@/layout/components/setting/index.vue'
  import { useAppStore } from '@/store/app'
  import { T } from '@/utils/i18n'

  defineProps({
    sectionTitle: String,
    pageTitle: String,
    isMobile: {
      type: Boolean,
      default: false,
    },
  })
  const emit = defineEmits(['toggle-menu'])
  const appStore = useAppStore()
  const setting = computed(() => appStore.setting)
  const toggleMenu = () => emit('toggle-menu')
</script>

<style scoped lang="scss">
  .portainer-header-trail { display: none; }
  .nav-toggle {
    width: 36px;
    height: 36px;
    margin: auto 14px auto -8px;
    color: var(--console-muted);
    border-radius: 5px;

    &:hover,
    &:focus-visible {
      color: var(--console-primary);
      background: var(--console-primary-soft);
    }
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--console-muted);
    font-size: 13px;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--console-success);
    box-shadow: 0 0 0 3px var(--console-success-soft);
  }
</style>
