<template>
  <el-menu
          class="menus"
          :collapse="isCollapse"
          :default-active="activeIndex"
          background-color="#1e222d"
          text-color="#b1b3b8"
          active-text-color="#ffffff"
          router
  >
    <menu-item v-for="(route,index) in routes" :key="route.name" :route="route"></menu-item>
  </el-menu>
</template>

<script>
  import { defineComponent, ref, onMounted, watch, computed } from 'vue'
  import { useRouteStore } from '@/store/router'
  import MenuItem from '@/layout/components/menu/item.vue'
  import { useRoute } from 'vue-router'
  import { useAppStore } from '@/store/app'

  export default defineComponent({
    name: 'Menu',
    created () {
    },
    components: { MenuItem },
    setup () {
      const routes = ref([])
      const route = useRoute()
      const app = useAppStore()
      const isCollapse = computed(() => app.setting.sideIsCollapse)
      const activeIndex = computed(() => route.name)

      routes.value = useRouteStore().routes
      return {
        routes,
        activeIndex,
        isCollapse,
      }
    },

  })
</script>

<style lang="scss" scoped>
  .menus {
    min-height: 100vh;
    border-right: none;
    transition: width 0.3s;
        
    /* 메뉴 아이템 공통 스타일 */
    :deep(.el-menu-item) {
      height: 50px;
      line-height: 50px;
      margin: 4px 10px;      /* 아이템 사이 간격 추가 */
      border-radius: 8px;    /* 모서리를 둥글게 */
      
      &:hover {
        background-color: rgba(64, 158, 255, 0.1) !important; /* 부드러운 하이라이트 */
      }
      
      &.is-active {
        background: linear-gradient(90deg, #409eff, #66b1ff) !important; /* 그라데이션 적용 */
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4); /* 활성 메뉴 그림자 */
      }
    }
  }
</style>
<style>
</style>
