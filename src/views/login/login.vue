<template>
  <div class="login-container">
    <div class="login-card">
      <img src="@/assets/logo.png" alt="logo" class="login-logo"/>
      <h1>{{ appStore.setting.title }}</h1>
      <p class="login-description">{{ T('Login') }}</p>

      <el-form v-if="!disablePwd" label-position="top" class="login-form">
        <el-form-item :label="T('Username')">
          <el-input v-model="form.username" type="username" class="login-input"></el-input>
        </el-form-item>

        <el-form-item :label="T('Password')">
          <el-input v-model="form.password" type="password" @keyup.enter.native="login" show-password
                    class="login-input"></el-input>
        </el-form-item>
        <el-form-item :label="T('Captcha')" v-if="captchaCode">
          <el-input v-model="form.captcha" @keyup.enter.native="login"  class="login-input captcha-input">
            <template #append>
              <img :src="captchaCode.b64" @click="loadCaptcha" class="captcha" alt="captcha"/>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button @click="login" type="primary" class="login-button">{{ T('Login') }}</el-button>
          <el-button v-if="allowRegister" @click="register" class="login-button">{{ T('Register') }}</el-button>
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
    captcha_id: ''
  })

  const captchaCode = ref('')
  const redirect = route.query?.redirect
  const login = async () => {
    const res = await userStore.login(form).catch(e => e)
    if (!res.code) {
      ElMessage.success(T('LoginSuccess'))
      router.push({ path: redirect || '/', replace: true })
      return
    }
    if (res.code === 110) {
      // need captcha
      loadCaptcha()
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
      allowRegister.value = res.data.register
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
  width: 64px;
  height: 64px;
  margin: 0 auto 14px;
  display: block;
}

h1 {
  margin: 0;
  color: var(--console-heading);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.login-description {
  margin: 6px 0 24px;
  color: var(--console-muted);
  font-size: 13px;
}

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
  .login-logo { width: 56px; height: 56px; }
  .login-button { height: 42px; }
}
</style>
