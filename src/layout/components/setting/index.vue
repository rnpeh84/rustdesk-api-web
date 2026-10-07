<template>
  <div class="setting">
    <button type="button" class="menu-item title icon-title theme-toggle" :aria-label="T(isDark ? 'UseLightMode' : 'UseDarkMode')" :title="T(isDark ? 'UseLightMode' : 'UseDarkMode')" :aria-pressed="isDark" @click="isDark = !isDark"><el-icon :size="19"><Moon v-if="isDark"/><Sunny v-else/></el-icon></button>
    <el-dropdown class="menu-item">
      <div class="title icon-title" :aria-label="T('Language')">
        <el-icon :size="19"><ChatLineSquare/></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="(v, k) in appStore.setting.langs" @click="changeLang(k)" :key="k">{{ v.name }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-dropdown class="menu-item">
      <div class="title">
        <span class="avatar" aria-hidden="true">{{ userInitial }}</span>
        <span class="nickname">{{ user.username }}</span>
        <el-icon>
          <el-icon-arrow-down/>
        </el-icon>

      </div>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="showChangePwd">{{ T('ChangePassword') }}</el-dropdown-item>
          <el-dropdown-item @click="logout">{{ T('Logout') }}</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <changePwdDialog v-model:visible="changePwdVisible"></changePwdDialog>
  </div>
</template>

<script setup>
  import { useUserStore } from '@/store/user'
  import { useAppStore } from '@/store/app'
  import changePwdDialog from '@/components/changePwdDialog.vue'
  import { computed, ref } from 'vue'
  import { T } from '@/utils/i18n'
  import { isDark } from '@/utils/theme'
  import { ChatLineSquare, Sunny, Moon } from '@element-plus/icons'

  const userStore = useUserStore()
  const user = userStore
  const userInitial = computed(() => (user.username || 'A').trim().charAt(0).toUpperCase())
  const appStore = useAppStore()

  const logout = () => {
    userStore.logout()
    window.location.reload()
  }

  const changePwdVisible = ref(false)
  const showChangePwd = () => {
    changePwdVisible.value = true
  }
  const changeLang = (v) => {
    appStore.changeLang(v)
  }
</script>

<style lang="scss" scoped>
.setting {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  .theme-toggle{border:0;background:transparent;padding:0;font:inherit}

  .menu-item {
    margin-left: 0;
  }

  .title {
    min-height: 36px;
    color: var(--console-text);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 5px;
    cursor: pointer;

    &:hover,
    &:focus-visible {
      color: var(--console-primary);
      background: var(--console-primary-soft);
    }


    .nickname {
      max-width: 160px;
      padding: 0 8px;
      overflow: hidden;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .icon-title {
    width: 36px;
  }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    color: var(--console-muted);
    font-size: 12px;
    font-weight: 700;
    background: var(--console-canvas-strong);
    border: 1px solid var(--console-border);
    border-radius: 50%;
  }
}

@media (max-width: 560px) {
  .setting .nickname {
    display: none;
  }
}
</style>
