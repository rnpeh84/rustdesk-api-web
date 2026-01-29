<template>
  <div class="tags-container">
    <el-tag v-for="(t, i) in tags"
            :key="t.name"
            class="tag"
            :class="{ active: t.active }"
            :closable="t.closeable"
            @close="close(t)"
            @click="toTag(t)"
            :type="t.active?'primary':'info'"
            :effect="t.active?'dark':'plain'">
      {{ T(t.title) }}
    </el-tag>
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
        T,
      }
    },
  })
</script>

<style lang="scss" scoped>
.tags-container {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 0;
}

.tag {
  border-radius: 6px;
  height: 28px;
  line-height: 28px;
  border: 1px solid var(--el-border-color-light);
  padding: 0 12px;
  font-size: 12px;
  margin-left: 5px;
  margin-top: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);

  /* 활성화된 탭 스타일 */
  &.active {
    background: linear-gradient(90deg, #409eff, #66b1ff) !important; /* 그라데이션 적용 */
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4); /* 활성 메뉴 그림자 */
  }

  /* 마우스 호버 시 */
  &:not(.active):hover {
    color: #409eff;
    background-color: rgba(64, 158, 255, 0.1); /* 부드러운 하이라이트 */
  }
}
</style>
