import { createRouter, createWebHashHistory } from 'vue-router'

const constantRoutes = [
  {
    path: '/login',
    name: 'Login',
    meta: { title: 'Login' },
    component: () => import('@/views/login/login.vue'),
  },
  {
    path: '/register',
    name: 'Register',
    meta: { title: 'Register' },
    component: () => import('@/views/register/index.vue'),
  },
	{ path: '/password-reset-request', name: 'PasswordResetRequest', meta: { title: 'RequestPasswordReset' }, component: () => import('@/views/account_action/index.vue'), hidden: true },
	{ path: '/password-reset', name: 'PasswordReset', meta: { title: 'ResetPassword' }, component: () => import('@/views/account_action/index.vue'), hidden: true },
	{ path: '/invite', name: 'InviteAccept', meta: { title: 'AcceptInvitation' }, component: () => import('@/views/account_action/index.vue'), hidden: true },
  {
    path: '/404',
    component: () => import('@/views/error-page/404.vue'),
    hidden: true,
  },
  {
    path: '/oauth/:code',
    meta: { title: 'OauthLogin' },
    component: () => import('@/views/oauth/login.vue'),
    hidden: true,
  },
  {
    path: '/oauth/bind/:code',
    meta: { title: 'OauthBind' },
    component: () => import('@/views/oauth/bind.vue'),
    hidden: true,
  },
]
export const asyncRoutes = [
  // {
  //   path: '/',
  //   name: 'Index',
  //   redirect: '/Home',
  //   meta: { title: '首页', icon: 'house' },
  //   component: () => import('@/layout/index.vue'),
  //   children: [
  //     {
  //       path: '/Home',
  //       name: 'Home',
  //       meta: { title: '首页', icon: 'house' },
  //       component: () => import('@/views/index/index.vue'),
  //     },
  //
  //   ],
  // },
  {
    path: '/my',
    name: 'My',
    redirect: '/my/dashboard',
    meta: { title: 'My', icon: 'UserFilled' },
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'MyDashboard',
        meta: { title: 'UserDashboard', icon: 'DataBoard', inheritAccess: true },
        component: () => import('@/views/dashboard/index.vue'),
        props: { scope: 'user' },
      },
      {
        path: '/',
        name: 'MyInfo',
        meta: { title: 'Userinfo', icon: 'User' /*keepAlive: true*/ },
        component: () => import('@/views/my/info.vue'),
      },
      {
        path: 'peer',
        name: 'MyPeer',
        meta: { title: 'MyPeer', icon: 'Monitor' /*keepAlive: true*/ },
        component: () => import('@/views/my/peer/index.vue'),
      },
      {
        path: 'client',
        name: 'MyClient',
        meta: { title: 'ClientCenter', icon: 'Download' },
        component: () => import('@/views/my/client/index.vue'),
      },
      {
        path: 'address_book_collection',
        name: 'MyAddressBookCollection',
        meta: { title: 'AddressBookName', icon: 'FolderOpened' /*keepAlive: true*/ },
        component: () => import('@/views/my/address_book/collection.vue'),
      },
      {
        path: 'sharing',
        name: 'MyAddressBookSharing',
        meta: { title: 'SharingCenter', icon: 'Share' },
        component: () => import('@/views/my/address_book/sharing.vue'),
      },
      {
        path: 'address_book',
        name: 'MyAddressBookList',
        meta: { title: 'AddressBooks', icon: 'Notebook' /*keepAlive: true*/ },
        component: () => import('@/views/my/address_book/index.vue'),
      },
      {
        path: 'tag',
        name: 'MyTagList',
        meta: { title: 'Tags', icon: 'PriceTag' /*keepAlive: true*/ },
        component: () => import('@/views/my/tag/index.vue'),
      },
      {
        path: 'shareRecord',
        name: 'MyShareRecordList',
        meta: { title: 'WebLinkHistory', icon: 'Link' /*keepAlive: true*/ },
        component: () => import('@/views/my/share_record/index.vue'),
      },
      {
        path: 'loginLog',
        name: 'MyLoginLog',
        meta: { title: 'LoginLog', icon: 'Clock' /*keepAlive: true*/ },
        component: () => import('@/views/my/login_log/index.vue'),
      },
    ],
  },
  {
    path: '/user',
    name: 'User',
    redirect: '/user/dashboard',
    meta: { title: 'System', icon: 'Setting' },
    component: () => import('@/layout/index.vue'),
    children: [
      {
        path: 'dashboard',
        name: 'SystemDashboard',
        meta: { title: 'SystemDashboard', icon: 'DataAnalysis', inheritAccess: true },
        component: () => import('@/views/dashboard/index.vue'),
        props: { scope: 'system' },
      },
      {
        path: 'peer',
        name: 'Peer',
        meta: { title: 'PeerManage', icon: 'Monitor' /*keepAlive: true*/ },
        component: () => import('@/views/peer/index.vue'),
      },
      {
        path: 'group',
        name: 'UserGroup',
        meta: { title: 'GroupManage', icon: 'UserFilled' /*keepAlive: true*/ },
        component: () => import('@/views/group/index.vue'),
      },
      {
        path: 'deviceGroup',
        name: 'DeviceGroup',
        meta: { title: 'DeviceGroupManage', icon: 'SetUp' /*keepAlive: true*/ },
        component: () => import('@/views/group/deviceGroupList.vue'),
      },
      {
        path: 'index',
        name: 'UserList',
        meta: { title: 'UserManage', icon: 'User' /*keepAlive: true*/ },
        component: () => import('@/views/user/index.vue'),
      },
      {
        path: 'add',
        name: 'UserAdd',
        meta: { title: 'UserAdd', hide: true },
        component: () => import('@/views/user/edit.vue'),
      },
      {
        path: 'edit/:id',
        name: 'UserEdit',
        meta: { title: 'UserEdit', hide: true },
        component: () => import('@/views/user/edit.vue'),
      },
      {
        path: 'addressBookName',
        name: 'UserAddressBookName',
        meta: { title: 'AddressBookNameManage', icon: 'FolderOpened' /*keepAlive: true*/ },
        component: () => import('@/views/address_book/collection.vue'),
      },
      {
        path: 'addressBook',
        name: 'UserAddressBook',
        meta: { title: 'AddressBookManage', icon: 'Notebook' /*keepAlive: true*/ },
        component: () => import('@/views/address_book/index.vue'),
      },
      {
        path: 'tag',
        name: 'UserTag',
        meta: { title: 'TagsManage', icon: 'PriceTag' /*keepAlive: true*/ },
        component: () => import('@/views/tag/index.vue'),
      },
      {
        path: '/oauth',
        name: 'Oauth',
        meta: { title: 'OauthManage', icon: 'Link' /*keepAlive: true*/ },
        component: () => import('@/views/oauth/index.vue'),
      },
      {
        path: '/userToken',
        name: 'UserToken',
        meta: { title: 'UserToken', icon: 'Key' /*keepAlive: true*/ },
        component: () => import('@/views/user/token.vue'),
      },
      {
        path: '/loginLog',
        name: 'LoginLog',
        meta: { title: 'LoginLog', icon: 'Clock' /*keepAlive: true*/ },
        component: () => import('@/views/login/log.vue'),
      },
      {
        path: '/auditConn',
        name: 'AuditConn',
        meta: { title: 'AuditConnLog', icon: 'Connection' /*keepAlive: true*/ },
        component: () => import('@/views/audit/connList.vue'),
      },
      {
        path: '/auditFile',
        name: 'AuditFile',
        meta: { title: 'AuditFileLog', icon: 'FolderOpened' /*keepAlive: true*/ },
        component: () => import('@/views/audit/fileList.vue'),
      },
      {
        path: '/shareRecord',
        name: 'ShareRecord',
        meta: { title: 'ShareRecord', icon: 'Share' /*keepAlive: true*/ },
        component: () => import('@/views/share_record/index.vue'),
      },
      {
        path: '/serverCmd',
        name: 'ServerCmd',
        meta: { title: 'ServerCmd', icon: 'Tools' /*keepAlive: true*/ },
        component: () => import('@/views/rustdesk/control.vue'),
      },
      {
        path: '/policy',
        name: 'Policy',
        meta: { title: 'PolicyManage', icon: 'DocumentChecked' },
        component: () => import('@/views/policy/index.vue'),
      },
      {
        path: '/adminAudit',
        name: 'AdminAudit',
        meta: { title: 'AdminAuditLog', icon: 'Tickets' },
        component: () => import('@/views/audit/adminList.vue'),
      },
	  {
		path: '/operations',
		name: 'Operations',
		meta: { title: 'OperationsCenter', icon: 'Odometer' },
		component: () => import('@/views/operations/index.vue'),
	  },
	  {
		path: '/fleet',
		name: 'Fleet',
		meta: { title: 'FleetManagement', icon: 'Promotion' },
		component: () => import('@/views/fleet/index.vue'),
	  },
	  {
		path: '/externalAuth',
		name: 'ExternalAuth',
		meta: { title: 'ExternalAuthOperations', icon: 'Lock' },
		component: () => import('@/views/external_auth/index.vue'),
	  },
	  {
		path: '/clientEndpoints',
		name: 'ClientEndpointProfiles',
		meta: { title: 'ClientEndpointProfiles', icon: 'Connection' },
		component: () => import('@/views/client_build/endpoints.vue'),
	  },
	  {
		path: '/clientSource',
		name: 'ClientSourceConnection',
		meta: { title: 'ClientSourceConnection', icon: 'Link' },
		component: () => import('@/views/client_build/github.vue'),
	  },
	  {
		path: '/clientBuild',
		name: 'ClientBuildCenter',
		meta: { title: 'ClientBuildCenter', icon: 'Cpu' },
		component: () => import('@/views/client_build/index.vue'),
	  },
	  {
		path: '/clientReleases',
		name: 'ClientReleaseAdmin',
		meta: { title: 'ClientReleaseManagement', icon: 'Box' },
		component: () => import('@/views/client_release/index.vue'),
	  },
    ],
  },
]
export const lastRoutes = [
  { path: '/:catchAll(.*)', redirect: '/404', meta: { hide: true } },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes,
})
