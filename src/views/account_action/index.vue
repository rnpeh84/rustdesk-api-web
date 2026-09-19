<template>
  <main class="action-shell">
    <el-card class="action-card" shadow="never">
      <img src="@/assets/logo.png" alt="RustDesk"/>
      <h1>{{ title }}</h1><p>{{ description }}</p>
      <el-form label-position="top">
		<el-form-item v-if="mode==='request'" :label="T('Email')"><el-input v-model="email" type="email"/></el-form-item>
		<template v-else><el-form-item :label="T('NewPassword')"><el-input v-model="password" type="password" show-password/></el-form-item><el-form-item :label="T('ConfirmPassword')"><el-input v-model="confirmation" type="password" show-password/></el-form-item></template>
		<el-button type="primary" :loading="loading" @click="submit">{{ actionLabel }}</el-button>
		<el-button text @click="router.push('/login')">{{ T('BackToLogin') }}</el-button>
	  </el-form>
    </el-card>
  </main>
</template>
<script setup>
import { computed, ref } from 'vue'; import { useRoute, useRouter } from 'vue-router'; import { ElMessage } from 'element-plus'; import { acceptInvite, confirmPasswordReset, requestPasswordReset } from '@/api/accountActions'; import { T } from '@/utils/i18n'
const route=useRoute(),router=useRouter(),loading=ref(false),email=ref(''),password=ref(''),confirmation=ref('');const mode=computed(()=>route.name==='PasswordResetRequest'?'request':route.name==='InviteAccept'?'invite':'reset');const title=computed(()=>T(mode.value==='request'?'RequestPasswordReset':mode.value==='invite'?'AcceptInvitation':'ResetPassword'));const description=computed(()=>T(mode.value==='request'?'RequestPasswordResetDescription':mode.value==='invite'?'AcceptInvitationDescription':'ResetPasswordDescription'));const actionLabel=computed(()=>T(mode.value==='request'?'SendResetLink':mode.value==='invite'?'CreateAccount':'ChangePassword'))
const submit=async()=>{if(mode.value!=='request'&&(password.value.length<8||password.value!==confirmation.value)){ElMessage.error(T('PasswordValidationGuide'));return}loading.value=true;try{if(mode.value==='request')await requestPasswordReset({email:email.value});else if(mode.value==='invite')await acceptInvite({token:route.query.token,password:password.value});else await confirmPasswordReset({token:route.query.token,password:password.value});ElMessage.success(T(mode.value==='request'?'ResetRequestAccepted':'Completed'));if(mode.value!=='request')router.push('/login')}catch(error){ElMessage.error(error?.message||T('OperationFailed'))}finally{loading.value=false}}
</script>
<style scoped lang="scss">.action-shell{display:grid;min-height:100vh;place-items:center;padding:20px;background:var(--console-canvas)}.action-card{width:min(420px,100%);text-align:center}.action-card img{width:56px}.action-card h1{margin:14px 0 6px;color:var(--console-heading);font-size:22px}.action-card p{margin:0 0 22px;color:var(--console-muted)}.action-card .el-button{width:100%;margin:8px 0 0}</style>

