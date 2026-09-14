<template>
  <el-config-provider :locale="appStore.setting.locale.value">
    <router-view/>
  </el-config-provider>
</template>
<script setup>
  import { useAppStore } from '@/store/app'

  const appStore = useAppStore()
</script>
<style>
</style>
