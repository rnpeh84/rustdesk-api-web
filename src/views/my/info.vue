<template>
  <section class="profile-page">
    <el-card class="profile-summary" shadow="never">
      <div class="profile-summary__identity">
        <span class="profile-summary__avatar" aria-hidden="true"><el-icon><UserFilled/></el-icon></span>
        <div>
          <strong>{{ displayName }}</strong>
          <span>@{{ userStore.username }}</span>
        </div>
      </div>
      <el-tag class="profile-summary__role" effect="plain">{{ T(isAdmin ? 'SystemAdministrator' : 'StandardUser') }}</el-tag>
    </el-card>

    <div class="profile-grid">
      <el-card class="profile-panel" shadow="never">
        <template #header>
          <div class="profile-panel__heading">
            <span class="profile-panel__icon"><el-icon><User/></el-icon></span>
            <div>
              <h2>{{ T('AccountInformation') }}</h2>
              <p>{{ T('AccountInformationDescription') }}</p>
            </div>
          </div>
        </template>
        <dl class="profile-details">
          <div>
            <dt>{{ T('Username') }}</dt>
            <dd>{{ userStore.username }}</dd>
          </div>
          <div>
            <dt>{{ T('Nickname') }}</dt>
            <dd>{{ userStore.nickname || T('NotSet') }}</dd>
          </div>
          <div>
            <dt>{{ T('Email') }}</dt>
            <dd :class="{ 'is-muted': !userStore.email }">{{ userStore.email || T('EmailNotRegistered') }}</dd>
          </div>
          <div>
            <dt>{{ T('AccountType') }}</dt>
            <dd>{{ T(isAdmin ? 'SystemAdministrator' : 'StandardUser') }}</dd>
          </div>
        </dl>
      </el-card>

      <el-card class="profile-panel profile-security" shadow="never">
        <template #header>
          <div class="profile-panel__heading">
            <span class="profile-panel__icon is-warning"><el-icon><Lock/></el-icon></span>
            <div>
              <h2>{{ T('PasswordSecurity') }}</h2>
              <p>{{ T('PasswordSecurityDescription') }}</p>
            </div>
          </div>
        </template>
        <p>{{ T('PasswordSecurityGuide') }}</p>
        <el-button type="warning" plain :icon="Lock" @click="showChangePwd">{{ T('ChangePassword') }}</el-button>
      </el-card>
    </div>

    <el-card class="profile-panel profile-providers" shadow="never" v-loading="oauthLoading">
      <template #header>
        <div class="profile-panel__heading">
          <span class="profile-panel__icon is-success"><el-icon><Link/></el-icon></span>
          <div>
            <h2>{{ T('ConnectedAccounts') }}</h2>
            <p>{{ T('ConnectedAccountsDescription') }}</p>
          </div>
        </div>
      </template>

      <div v-if="oidcData.length" class="provider-list">
        <div v-for="provider in oidcData" :key="provider.op" class="provider-item">
          <span class="provider-item__mark">{{ provider.op.slice(0, 1).toUpperCase() }}</span>
          <div>
            <strong>{{ provider.op }}</strong>
            <small>{{ T(provider.status === 1 ? 'ConnectedAccountDescription' : 'DisconnectedAccountDescription') }}</small>
          </div>
          <el-tag :type="provider.status === 1 ? 'success' : 'info'">
            {{ T(provider.status === 1 ? 'HasBind' : 'NoBind') }}
          </el-tag>
          <el-button
            :type="provider.status === 1 ? 'danger' : 'success'"
            plain
            @click="provider.status === 1 ? toUnBind(provider) : toBind(provider)"
          >
            {{ T(provider.status === 1 ? 'UnBind' : 'ToBind') }}
          </el-button>
        </div>
      </div>
      <div v-else class="provider-empty">
        <span class="provider-empty__icon"><el-icon><Link/></el-icon></span>
        <strong>{{ T('NoIdentityProviders') }}</strong>
        <p>{{ T('NoIdentityProvidersDescription') }}</p>
      </div>
    </el-card>

    <change-pwd-dialog v-model:visible="changePwdVisible"/>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { Link, Lock, User, UserFilled } from '@element-plus/icons'
import { ElMessageBox } from 'element-plus'
import ChangePwdDialog from '@/components/changePwdDialog.vue'
import { useUserStore } from '@/store/user'
import { bind, unbind } from '@/api/oauth'
import { myOauth } from '@/api/user'
import { T } from '@/utils/i18n'

const userStore = useUserStore()
const changePwdVisible = ref(false)
const oidcData = ref([])
const oauthLoading = ref(false)

const isAdmin = computed(() => userStore.route_names?.includes('*'))
const displayName = computed(() => userStore.nickname || userStore.username)

const showChangePwd = () => { changePwdVisible.value = true }
const getMyOauth = async () => {
  oauthLoading.value = true
  const res = await myOauth().catch(() => false)
  oidcData.value = res?.data || []
  oauthLoading.value = false
}
const toBind = async row => {
  const res = await bind({ op: row.op }).catch(() => false)
  if (res?.data?.url) window.open(res.data.url)
}
const toUnBind = async row => {
  const confirmed = await ElMessageBox.confirm(T('Confirm?', { param: T('UnBind') }), {
    confirmButtonText: T('Confirm'),
    cancelButtonText: T('Cancel'),
    type: 'warning',
  }).catch(() => false)
  if (!confirmed) return
  const res = await unbind({ op: row.op }).catch(() => false)
  if (res) getMyOauth()
}

onMounted(getMyOauth)
</script>

<style scoped lang="scss">
.profile-page { display: grid; gap: 14px; }
.profile-summary :deep(.el-card__body) { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; }
.profile-summary__identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.profile-summary__identity strong, .profile-summary__identity span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-summary__identity strong { color: var(--console-heading); font-size: 16px; }
.profile-summary__identity span { margin-top: 2px; color: var(--console-muted); font-size: 12px; }
.profile-summary__avatar { display: grid; flex: 0 0 auto; place-items: center; width: 38px; height: 38px; color: var(--console-primary); background: var(--console-primary-soft); border-radius: 50%; font-size: 17px; }
.profile-summary__role { flex: 0 0 auto; color: var(--console-primary); background: var(--console-primary-soft); border-color: var(--console-primary-border); }
.profile-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr); gap: 14px; }
.profile-panel__heading { display: flex; align-items: center; gap: 11px; }
.profile-panel__heading h2 { margin: 0; color: var(--console-heading); font-size: 14px; line-height: 1.4; }
.profile-panel__heading p { margin: 2px 0 0; color: var(--console-muted); font-size: 12px; font-weight: 400; }
.profile-panel__icon { display: grid; place-items: center; width: 34px; height: 34px; color: var(--console-primary); background: var(--console-primary-soft); border-radius: 6px; font-size: 17px; }
.profile-panel__icon.is-warning { color: var(--console-warning); background: var(--console-warning-soft); }
.profile-panel__icon.is-success { color: var(--console-success); background: var(--console-success-soft); }
.profile-details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; }
.profile-details > div { min-width: 0; padding: 15px 4px; border-bottom: 1px solid var(--console-border); }
.profile-details > div:nth-last-child(-n + 2) { border-bottom: 0; }
.profile-details dt { color: var(--console-muted); font-size: 12px; font-weight: 600; }
.profile-details dd { margin: 5px 0 0; overflow-wrap: anywhere; color: var(--console-heading); font-weight: 650; }
.profile-details dd.is-muted { color: var(--console-warning); }
.profile-security { min-height: 100%; }
.profile-security p { margin: 0 0 20px; color: var(--console-text); line-height: 1.7; }
.profile-security .el-button { width: 100%; }
.provider-list { display: grid; }
.provider-item { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto auto; align-items: center; gap: 12px; min-height: 64px; padding: 8px 2px; border-bottom: 1px solid var(--console-border); }
.provider-item:last-child { border-bottom: 0; }
.provider-item__mark { display: grid; place-items: center; width: 40px; height: 40px; color: var(--console-primary); background: var(--console-primary-soft); border-radius: 7px; font-weight: 750; }
.provider-item strong, .provider-item small { display: block; }
.provider-item strong { color: var(--console-heading); }
.provider-item small { margin-top: 2px; color: var(--console-muted); }
.provider-empty { display: grid; justify-items: center; align-content: center; min-height: 150px; padding: 18px; text-align: center; }
.provider-empty__icon { display: grid; place-items: center; width: 42px; height: 42px; color: var(--console-muted); background: var(--console-neutral-soft); border-radius: 50%; font-size: 19px; }
.provider-empty strong { margin-top: 10px; color: var(--console-heading); }
.provider-empty p { max-width: 440px; margin: 4px 0 0; color: var(--console-muted); font-size: 12px; }
@media (max-width: 900px) { .profile-grid { grid-template-columns: 1fr; } }
@media (max-width: 620px) {
  .profile-summary :deep(.el-card__body) { align-items: center; padding: 14px; }
  .profile-details { grid-template-columns: 1fr; }
  .profile-details > div:nth-last-child(-n + 2) { border-bottom: 1px solid var(--console-border); }
  .profile-details > div:last-child { border-bottom: 0; }
  .provider-item { grid-template-columns: 40px minmax(0, 1fr); }
  .provider-item > .el-tag, .provider-item > .el-button { grid-column: 2; justify-self: start; }
}
</style>
