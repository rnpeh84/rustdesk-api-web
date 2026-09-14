<template>
  <div class="tags-bar">
    <el-tooltip :content="T('CloseAllPages')" placement="bottom-start">
      <el-button class="close-all-pages" :aria-label="T('CloseAllPages')" @click="closeAll">
        <span class="close-all-pages__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M6 4.75h11.25a2 2 0 0 1 2 2V15m-13.5 4.25h10.5a2 2 0 0 0 2-2V8.75a2 2 0 0 0-2-2H5.75a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2Z"/><path d="m8.25 11.25 5.5 5.5m0-5.5-5.5 5.5"/></svg>
        </span>
        <span>{{ T('CloseAll') }}</span>
        <span class="close-all-pages__count">{{ tags.length }}</span>
      </el-button>
    </el-tooltip>
    <div class="tags-container">
      <el-tag v-for="t in tags"
              :key="t.name"
              class="tag"
              :class="{ active: t.active }"
              :closable="t.closeable"
              @close="close(t)"
              @click="toTag(t)"
              effect="plain">
        {{ T(t.title) }}
      </el-tag>
    </div>
  </div>
</template>

<script>
  import { defineComponent, ref, onMounted, watch } from 'vue'
  import { useTagsStore } from '@/store/tags'
  import { useRoute, useRouter } from 'vue-router'
  import { T } from '@/utils/i18n'

  export default defineComponent({
    name: 'Index',
    setup () {
      const tags = ref([])
      const tagsStore = useTagsStore()
      const route = useRoute()
      const router = useRouter()
      tags.value = tagsStore.tags

      const addTag = (route) => {
        if (!route.meta?.hide && route.name) {
          tagsStore.addTag(route)
        }
      }
      const close = (tag) => {
        tagsStore.removeTag(tag)
        if (tag.active) {
          toLastTag()
        }
      }
      const toLastTag = () => {
        if (tags.value.length) {
          router.push({ name: tags.value[tags.value.length - 1].name })
        }
      }
      const init = () => {
        if (!tagsStore.tags.length) {
          tagsStore.initTags()
        }
        addTag(route)
      }

      const closeAll = () => {
        tagsStore.removeAllTags()
        const targetName = route.path.startsWith('/user') ? 'SystemDashboard' : 'MyDashboard'
        if (route.name === targetName) {
          addTag(route)
        } else {
          router.push({ name: targetName })
        }
      }

      const toTag = (tag) => {
        if (tag.name !== route.name) {
          router.push({ name: tag.name })
        }
      }

      onMounted(init)
      watch(route, (val) => {
        addTag(val)
      })
      return {
        tags,
        addTag,
        close,
        toLastTag,
        toTag,
        closeAll,
        T,
      }
    },
  })
</script>

<style lang="scss" scoped>
.tags-bar {
  display: flex;
  align-items: stretch;
  min-width: 0;
  max-width: 100%;
}

.close-all-pages {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 9px 0 7px;
  margin: 4px 8px 4px 0;
  color: var(--console-muted);
  font-size: 12px;
  font-weight: 650;
  background: var(--console-surface);
  border-color: var(--console-border);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
}

.close-all-pages__icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  margin-right: 5px;

  svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.close-all-pages__count {
  min-width: 18px;
  height: 18px;
  margin-left: 6px;
  padding: 0 5px;
  color: var(--console-text);
  font-size: 11px;
  line-height: 18px;
  background: var(--console-neutral-soft);
  border-radius: 9px;
}

.close-all-pages:hover {
  color: var(--console-danger);
  background: var(--console-danger-soft);
  border-color: color-mix(in srgb, var(--console-danger) 28%, white);
}

.tags-container {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 40px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: thin;
}

.tag {
  flex: 0 0 auto;
  height: 32px;
  margin: 4px 0;
  padding: 0 10px;
  color: var(--console-muted);
  font-size: 13px;
  line-height: 30px;
  background: transparent;
  border-width: 1px;
  border-color: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;

  &.active {
    color: var(--console-primary);
    font-weight: 650;
    background: var(--console-primary-soft);
    border-color: var(--console-primary-border);
  }

  &:not(.active):hover {
    color: var(--console-text);
    background: var(--console-neutral-soft);
  }
}
</style>
