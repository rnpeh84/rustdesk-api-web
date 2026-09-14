<template>
  <el-config-provider :locale="appStore.setting.locale.value">
    <el-container class="app-shell" :style="{'--sideBarWidth': sideBarWidth}">
      <el-aside
          :width="leftWidth"
          class="app-left"
          :class="{'is-mobile': isMobile, 'is-mobile-open': mobileMenuOpen}"
      >
        <g-aside :force-expanded="isMobile"></g-aside>
      </el-aside>
      <button
          v-if="isMobile && mobileMenuOpen"
          class="sidebar-backdrop"
          type="button"
          :aria-label="T('Close')"
          @click="mobileMenuOpen = false"
      ></button>
      <el-container class="app-container">
        <el-header class="app-header">
          <g-header :is-mobile="isMobile" @toggle-menu="toggleMenu"></g-header>
        </el-header>
        <section class="page-context" aria-labelledby="current-page-title">
          <div class="page-context__trail">
            <span>{{ T(currentSectionTitle) }}</span>
            <el-icon v-if="currentSectionTitle !== currentPageTitle"><ArrowRight/></el-icon>
            <span v-if="currentSectionTitle !== currentPageTitle">{{ T(currentPageTitle) }}</span>
          </div>
          <h1 id="current-page-title">{{ T(currentPageTitle) }}</h1>
        </section>
        <div class="header-tags">
          <tags></tags>
        </div>

        <el-main class="app-main">
          <router-view v-slot="{ Component }">
            <transition mode="out-in" name="el-fade-in-linear">
              <keep-alive :include="cachedTags">
                <component :is="Component" :key="route.name"/>
              </keep-alive>
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<script setup>
  import { useAppStore } from '@/store/app'
  import { useTagsStore } from '@/store/tags'
  import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { ArrowRight } from '@element-plus/icons-vue'
  import { T } from '@/utils/i18n'
  import Tags from '@/layout/components/tags/index.vue'
  import GAside from '@/layout/components/aside.vue'
  import GHeader from '@/layout/components/header.vue'

  const appStore = useAppStore()
  const tagStore = useTagsStore()
  const route = useRoute()
  const sideBarWidth = computed(() => appStore.setting.locale.sideBarWidth)
  const isMobile = ref(false)
  const mobileMenuOpen = ref(false)
  const leftWidth = computed(() => {
    if (isMobile.value) return 'var(--sideBarWidth)'
    return appStore.setting.sideIsCollapse ? '64px' : 'var(--sideBarWidth)'
  })
  const currentPageTitle = computed(() => route.meta?.title || route.name || '')
  const currentSectionTitle = computed(() => route.matched.find(item => item.meta?.title)?.meta?.title || currentPageTitle.value)

  const cachedTags = ref([])

  cachedTags.value = tagStore.cached

  const updateViewport = () => {
    isMobile.value = window.innerWidth < 900
    if (!isMobile.value) mobileMenuOpen.value = false
  }
  const toggleMenu = () => {
    if (isMobile.value) {
      mobileMenuOpen.value = !mobileMenuOpen.value
      return
    }
    appStore.sideCollapse()
  }

  watch(() => route.fullPath, () => {
    mobileMenuOpen.value = false
  })
  onMounted(() => {
    updateViewport()
    window.addEventListener('resize', updateViewport)
  })
  onBeforeUnmount(() => window.removeEventListener('resize', updateViewport))
</script>

<style lang="scss" scoped>
.app-header {
  background-color: var(--console-surface);
  color: var(--console-text);
  display: flex;
  height: var(--console-header-height);
  padding: 0 24px;
  border-bottom: 1px solid var(--console-border);
}

.header-tags {
  min-height: 42px;
  padding: 0 var(--console-content-gutter);
  overflow: hidden;
  border-top: 1px solid var(--console-border);
  border-bottom: 1px solid var(--console-border);
  display: flex;
  background: var(--console-surface);
}

.app-left {
  background: var(--console-sidebar);
  border-right: 1px solid var(--console-border);
  overflow: hidden;
  transition: width 0.2s ease, transform 0.2s ease;
  z-index: 30;
}

.app-container {
  min-height: 100vh;
  min-width: 0;
  background: var(--console-canvas);
}

.page-context {
  padding: 18px var(--console-content-gutter) 14px;
  background: var(--console-canvas);
}

.page-context__trail {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  color: var(--console-muted);
  font-size: 12px;
}

.page-context h1 {
  margin: 8px 0 0;
  color: var(--console-heading);
  font-size: 26px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.025em;
}

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  border: 0;
  background: rgba(15, 23, 42, 0.36);
}

@media (max-width: 899px) {
  .app-left.is-mobile {
    position: fixed;
    inset: 0 auto 0 0;
    transform: translateX(-100%);
    box-shadow: 12px 0 32px rgba(15, 23, 42, 0.16);
  }

  .app-left.is-mobile-open {
    transform: translateX(0);
  }

  .app-header,
  .header-tags {
    padding-right: var(--console-content-gutter);
    padding-left: var(--console-content-gutter);
  }

  .page-context {
    padding: 16px var(--console-content-gutter) 12px;
  }

  .page-context h1 {
    font-size: 22px;
  }
}
</style>
