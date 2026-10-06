<template>
  <el-config-provider :locale="appStore.setting.locale.value">
    <router-view/>
    <NotificationCenter/>
  </el-config-provider>
</template>
<script setup>
  import { useAppStore } from '@/store/app'
  import NotificationCenter from '@/components/NotificationCenter.vue'

  const appStore = useAppStore()
</script>
<style>
</style>
