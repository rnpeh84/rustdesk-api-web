<template>
  <div class="login-container">
    <div class="login-card">
      <header class="login-brand">
        <div class="login-brand__row">
          <img :src="appStore.setting.logo" alt="" width="48" height="48" class="login-logo"/>
          <h1 :class="{ 'login-brand-name': appStore.setting.title === 'Re;De' }"><BrandName :title="appStore.setting.title" /></h1>
        </div>
        <p v-if="appStore.setting.title === 'Re;De'" class="login-brand__subtitle">Remote Desktop</p>
      </header>

      <el-form v-if="!disablePwd" label-position="top" class="login-form" autocomplete="on" @submit.prevent="login">
        <el-form-item :label="T('Username')">
          <el-input id="login-username" name="username" v-model="form.username" type="text"
                    autocomplete="username" autocapitalize="none" :spellcheck="false" class="login-input"></el-input>
        </el-form-item>

        <el-form-item :label="T('Password')">
          <el-input id="login-password" name="password" v-model="form.password" type="password" autocomplete="current-password" show-password
                    class="login-input"></el-input>
        </el-form-item>
        <el-form-item :label="T('Captcha')" v-if="captchaCode">
          <el-input v-model="form.captcha" name="captcha" type="text" class="login-input captcha-input">
            <template #append>
              <img :src="captchaCode.b64" @click="loadCaptcha" class="captcha" alt="captcha"/>
            </template>
          </el-input>
        </el-form-item>
		<el-form-item v-if="mfaRequired" :label="T('VerificationCode')">
		  <el-input v-model="form.mfa_code" name="mfa_code" maxlength="16" autocomplete="one-time-code"/>
		  <small class="mfa-help">{{ T('MFAChallengeGuide') }}</small>
		</el-form-item>
        <el-form-item>
          <el-button native-type="submit" type="primary" :loading="loginPending" class="login-button">{{ T('Login') }}</el-button>
          <el-button v-if="allowRegister" @click="register" class="login-button">{{ T('Register') }}</el-button>
		  <el-button v-if="allowPublicAccountActions" text class="forgot-button" @click="router.push('/password-reset-request')">{{ T('ForgotPassword') }}</el-button>
        </el-form-item>
      </el-form>

      <div class="divider" v-if="options.length > 0 && !disablePwd">
        <span>{{ T('or login in with') }}</span>
      </div>

      <div class="oidc-options">
        <div v-for="(option, index) in options" :key="index" class="oidc-option">
          <el-button @click="handleOIDCLogin(option.name)" class="oidc-btn">
            <img :src="getProviderImage(option.name)" alt="provider" class="oidc-icon"/>
            <span>{{ T(option.name) }}</span>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
  import { reactive, onMounted, ref } from 'vue'
  import { useUserStore } from '@/store/user'
  import { useAppStore } from '@/store/app'
  import BrandName from '@/components/BrandName.vue'
  import { ElMessage } from 'element-plus'
  import { T } from '@/utils/i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { loginOptions, captcha } from '@/api/login'
  import { getCode, removeCode } from '@/utils/auth'

  const oauthInfo = ref({})
  const userStore = useUserStore()
  const appStore = useAppStore()
  const route = useRoute()
  const router = useRouter()
  const options = reactive([]) // 存储 OIDC 登录选项

  let platform = window.navigator.platform
  if (navigator.platform.indexOf('Mac') === 0) {
    platform = 'mac'
  } else if (navigator.platform.indexOf('Win') === 0) {
    platform = 'windows'
  } else if (navigator.platform.indexOf('Linux armv') === 0) {
    platform = 'android'
  } else if (navigator.platform.indexOf('Linux') === 0) {
    platform = 'linux'
  }
  const userAgent = navigator.userAgent
  let browser = 'Unknown Browser'
  if (/chrome|crios/i.test(userAgent)) browser = 'Chrome'
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox'
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari'
  else if (/edg/i.test(userAgent)) browser = 'Edge'

  const form = reactive({
    username: '',
    password: '',
    platform: platform,
    captcha: '',
	captcha_id: '',
	mfa_code: ''
  })
	const mfaRequired = ref(false)

  const captchaCode = ref('')
  const redirect = route.query?.redirect
  const loginPending = ref(false)
  const login = async () => {
    if (loginPending.value) return
    loginPending.value = true
    try {
      const res = await userStore.login(form).catch(e => e)
      if (!res.code) {
        ElMessage.success(T('LoginSuccess'))
        router.push({ path: redirect || '/', replace: true })
        return
      }
      if (res.code === 110) {
        // 추가 인증이 필요하면 보안문자를 갱신한다.
        loadCaptcha()
      }
      if (res.code === 1201) {
        mfaRequired.value = true
      }
    } finally {
      loginPending.value = false
    }
  }

  const loadCaptcha = async () => {
    const captchaRes = await captcha().catch(_ => false)
    console.log(captchaRes)
    captchaCode.value = captchaRes.data.captcha
    form.captcha_id = captchaRes.data.captcha.id
  }

  const handleOIDCLogin = (provider) => {
    userStore.oidc(provider, platform, browser)
  }

  import googleImage from '@/assets/google.png'
  import githubImage from '@/assets/github.png'
  import oidcImage from '@/assets/oidc.png'
  import webauthImage from '@/assets/webauth.png'
  import defaultImage from '@/assets/oidc.png'

  const providerImageMap = {
    google: googleImage,
    github: githubImage,
    oidc: oidcImage,
    // WebAuth: webauthImage,
    default: defaultImage,
  }

  const getProviderImage = (provider) => {
    return providerImageMap[provider.toLowerCase()] || providerImageMap.default
  }

  const allowRegister = ref(false)
  const allowPublicAccountActions = ref(false)
  const disablePwd = ref(false)
  const loadLoginOptions = async () => {
    try {
      const res = await loginOptions().catch(_ => false)
      if (!res || !res.data) return console.error('No valid response received')
      res.data.ops.map(option => (options.push({ name: option }))) // 创建新的对象数组
      if (res.data.auto_oidc) {
        // 如果有自动OIDC登录选项，直接调用第一个
        handleOIDCLogin(res.data.ops[0])
      }
      disablePwd.value = res.data.disable_pwd
      allowPublicAccountActions.value = res.data.public_account_actions === true
      allowRegister.value = allowPublicAccountActions.value && res.data.register === true
      if (res.data.need_captcha) {
        loadCaptcha()
      }
    } catch (error) {
      console.error('Error loading login options:', error.message)
    }
  }

  onMounted(async () => {
    const code = getCode()
    if (code) {
      // 如果code存在，进行query获取user info
      const res = await userStore.query(code)
      if (res) {
        // 删除code，确保跳转之前对code进行清楚
        removeCode()
        ElMessage.success(T('LoginSuccess'))
        router.push({ path: redirect || '/', replace: true })
      }
    } else {
      // 如果code不存在, 现实登陆页面
      loadLoginOptions() // 组件挂载后调用登录选项加载函数
    }
  })

  const register = () => {
    router.push('/register')
  }
</script>

<style scoped lang="scss">
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  background: var(--console-canvas);
}

.login-card {
  box-sizing: border-box;
  width: 100%;
  max-width: 400px;
  padding: 36px 34px;
  text-align: center;
  background: var(--console-surface);
  border: 1px solid var(--console-border);
  border-radius: 8px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
}

.login-logo {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: block;
}

.login-brand { margin-bottom: 28px; }
.login-brand__row { display: flex; align-items: center; justify-content: center; gap: 12px; }
.login-brand__subtitle {
  margin: 12px 0 0;
  color: var(--console-muted);
  font-size: 11px;
  letter-spacing: 0.14em;
  line-height: 1.4;
}

h1 {
  margin: 0;
  color: var(--console-heading);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.login-brand-name { font-size: 32px; }

.login-form {
  margin-bottom: 18px;
}

.login-input {
  width: 100%;
  .captcha{
    cursor: pointer;
    width: 150px;
    border-radius: 6px;
  }
}
.mfa-help{display:block;margin-top:6px;color:var(--console-muted);font-size:12px;text-align:left}

.captcha-input{
  :deep(.el-input-group__append) {
    border-radius: 6px;
    padding: 0;
    overflow: hidden;
  }
}

.el-form-item {
  margin-bottom: 14px;

  ::v-deep(.el-form-item__label) {
    color: var(--console-text);
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 6px;
    display: inline-block;
    text-align: left;
  }

  .el-input {
    ::v-deep(.el-input__wrapper) {
      min-height: 42px;
      background: var(--console-surface);
      border-radius: 5px;
    }

    ::v-deep(input) {
      color: var(--console-heading);
    }

    ::v-deep(.el-input__inner:focus) {
      outline: none;
    }
  }
}

.login-button {
  width: 100%;
  height: 44px;
  margin-bottom: 12px;
  margin-left: 0;
  border-radius: 5px;
  font-weight: 600;
  background: var(--console-primary);
  color: white;
  border-color: var(--console-primary);
}
.forgot-button{width:100%;margin:0;color:var(--console-primary)}

.divider {
  display: flex;
  align-items: center;
  margin: 18px 0;
  font-size: 13px;
  color: var(--console-muted);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--console-border);
  }

  &::before { margin-right: 10px; }
  &::after { margin-left: 10px; }
}

.oidc-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.oidc-btn {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  width: 100%;
  height: 46px;
  background: var(--console-surface);
  border: 1px solid var(--console-border);
  border-radius: 5px;
  color: var(--console-text);
  padding: 0 12px;
  font-size: 14px;
}

.oidc-icon {
  width: 28px;
  height: 28px;
  margin-right: 8px;
  border-radius: 6px;
  background: #fff;
  padding: 3px;
}

@media (max-width: 480px) {
  .login-container { padding: 16px; }
  .login-card { padding: 28px 20px; }
  .login-button { height: 42px; }
}
</style>
