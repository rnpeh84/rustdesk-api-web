<template>
  <el-menu class="menus" :collapse="isCollapse" :default-active="activeIndex" router unique-opened>
    <template v-for="section in menuSections" :key="section.name">
      <div class="menu-section-label" :title="T(section.title)">
        <span>{{ T(section.title) }}</span>
      </div>
      <menu-item v-for="item in section.items" :key="item.name" :route="item" />
    </template>
  </el-menu>
</template>

<script>
  import { computed, defineComponent } from 'vue'
  import { useRouteStore } from '@/store/router'
  import MenuItem from '@/layout/components/menu/item.vue'
  import { useRoute } from 'vue-router'
  import { useAppStore } from '@/store/app'
  import { T } from '@/utils/i18n'

  const groupRoutes = (routes, name, title, icon, routeNames) => ({
    name,
    meta: { title, icon },
    children: routeNames.map(routeName => routes.find(route => route.name === routeName)).filter(Boolean),
  })

  const buildSectionItems = route => {
    const children = route?.children?.filter(child => !child.meta?.hide) || []
    const find = name => children.find(child => child.name === name)
    const compact = items => items.filter(item => item && (!item.children || item.children.length))

    if (route?.name === 'My') {
      return compact([
        find('MyDashboard'),
        groupRoutes(children, 'MyAccountMenu', 'MyAccountMenu', 'User', ['MyInfo', 'MyLoginLog']),
        groupRoutes(children, 'MyDeviceMenu', 'MyDeviceMenu', 'Monitor', ['MyPeer', 'MyTagList', 'MyShareRecordList']),
        groupRoutes(children, 'MyAddressBookMenu', 'MyAddressBookMenu', 'Notebook', ['MyAddressBookCollection', 'MyAddressBookList']),
      ])
    }

    return compact([
      find('SystemDashboard'),
	  groupRoutes(children, 'SystemDeviceMenu', 'SystemDeviceMenu', 'Monitor', ['Peer', 'DeviceGroup', 'Policy', 'Fleet']),
	  groupRoutes(children, 'SystemIdentityMenu', 'SystemIdentityMenu', 'UserFilled', ['UserList', 'UserGroup', 'UserToken', 'Oauth', 'ExternalAuth']),
      groupRoutes(children, 'SystemAddressBookMenu', 'SystemAddressBookMenu', 'Notebook', ['UserAddressBookName', 'UserAddressBook', 'UserTag']),
      groupRoutes(children, 'SystemAuditMenu', 'SystemAuditMenu', 'DocumentChecked', ['LoginLog', 'AuditConn', 'AuditFile', 'ShareRecord', 'AdminAudit']),
	  groupRoutes(children, 'SystemOperationMenu', 'SystemOperationMenu', 'Tools', ['Operations', 'ServerCmd']),
    ])
  }

  export default defineComponent({
    name: 'Menu',
    props: {
      forceExpanded: {
        type: Boolean,
        default: false,
      },
    },
    components: { MenuItem },
    setup (props) {
      const route = useRoute()
      const app = useAppStore()
      const routeStore = useRouteStore()
      const isCollapse = computed(() => props.forceExpanded ? false : app.setting.sideIsCollapse)
      const activeIndex = computed(() => route.name)
      const menuSections = computed(() => routeStore.routes.map(section => ({
        name: section.name,
        title: section.meta?.title || section.name,
        items: buildSectionItems(section),
      })).filter(section => section.items.length))
      return {
        menuSections,
        activeIndex,
        isCollapse,
        T,
      }
    },

  })
</script>

<style lang="scss" scoped>
  .menus {
    min-height: 100%;
    padding: 12px 8px 24px;
    border-right: none;
    background: transparent;
    transition: width 0.2s ease;

    .menu-section-label {
      display: flex;
      align-items: center;
      height: 30px;
      padding: 8px 12px 4px;
      color: var(--console-muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .menu-section-label:not(:first-child) {
      margin-top: 12px;
      border-top: 1px solid var(--console-border);
      padding-top: 14px;
      height: 38px;
    }

    :deep(.el-menu-item),
    :deep(.el-sub-menu__title) {
      height: 42px;
      margin: 2px 0;
      padding-right: 12px;
      color: var(--console-text);
      font-size: 14px;
      font-weight: 500;
      line-height: 42px;
      border-radius: 5px;
    }

    :deep(.el-menu-item:hover),
    :deep(.el-sub-menu__title:hover) {
      color: var(--console-primary);
      background: var(--console-primary-soft);
    }

    :deep(.el-menu-item.is-active) {
      color: var(--console-primary);
      font-weight: 650;
      background: var(--console-primary-soft);
      box-shadow: inset 3px 0 0 var(--console-primary);
    }

    :deep(.el-sub-menu .el-menu) {
      margin: 2px 0 8px;
      padding-left: 8px;
      background: transparent;
    }

    :deep(.el-icon) {
      color: currentColor;
      font-size: 18px;
    }

    :deep(.el-sub-menu__icon-arrow) {
      color: var(--console-muted);
    }

    &.el-menu--collapse {
      padding-right: 6px;
      padding-left: 6px;

      :deep(.el-menu-item),
      :deep(.el-sub-menu__title) {
        justify-content: center;
        padding: 0 !important;
      }

      .menu-section-label {
        height: 13px;
        margin: 8px 8px 4px;
        padding: 0;
        border-top: 1px solid var(--console-border);

        span {
          display: none;
        }
      }
    }
  }
</style>
