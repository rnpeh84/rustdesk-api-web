<template>
  <div class="login-container">
    <div class="login-card">
      <img src="@/assets/logo.png" alt="logo" class="login-logo"/>

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
  import { ElMessage } from 'element-plus'
  import { T } from '@/utils/i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { loginOptions, captcha } from '@/api/login'
  import { getCode, removeCode } from '@/utils/auth'

  const oauthInfo = ref({})
  const userStore = useUserStore()
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
  background: radial-gradient( circle at 10% 20%, rgba(64,158,255,0.08), transparent 10% ),
              linear-gradient(135deg, #0f1724 0%, #1f2937 50%, #111827 100%);
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  padding: 36px 32px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(2,6,23,0.6);
  text-align: center;
  backdrop-filter: blur(8px) saturate(120%);
  -webkit-backdrop-filter: blur(8px) saturate(120%);
  transition: transform .18s ease, box-shadow .18s ease;
}

.login-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(2,6,23,0.65);
}

.login-logo {
  width: 96px;
  height: 96px;
  margin: 0 auto 18px;
  display: block;
  border-radius: 50%;
  padding: 8px;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
  box-shadow: 0 6px 18px rgba(2,6,23,0.5);
}

h1 {
  margin: 8px 0 18px;
  font-size: 20px;
  font-weight: 700;
  color: #e6eef9;
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
    color: #cfe6ff;
    font-weight: 600;
    font-size: 13px;
    margin-bottom: 6px;
    display: inline-block;
    text-align: left;
  }

  .el-input {
    ::v-deep(.el-input__wrapper) {
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.02);
      border-radius: 8px;
      padding: 4px;
    }

    ::v-deep(input) {
      color: #eaf4ff;
    }

    ::v-deep(.el-input__inner:focus) {
      outline: none;
      box-shadow: 0 4px 18px rgba(64,158,255,0.12);
      border-color: rgba(64,158,255,0.9);
    }
  }
}

.login-button {
  width: 100%;
  height: 44px;
  margin-bottom: 12px;
  margin-left: 0;
  border-radius: 10px;
  font-weight: 600;
  background: linear-gradient(90deg, #409eff, #66b1ff);
  color: white;
  border: none;
  box-shadow: 0 8px 22px rgba(64,158,255,0.14);
}

.login-button:hover {
  transform: translateY(-1px);
}

.divider {
  display: flex;
  align-items: center;
  margin: 18px 0;
  font-size: 13px;
  color: rgba(255,255,255,0.6);

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: rgba(255,255,255,0.06);
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
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.04);
  border-radius: 10px;
  color: #e6eef9;
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
  .login-card { padding: 20px; border-radius: 10px; }
  .login-logo { width: 72px; height: 72px; }
  .login-button { height: 42px; }
}
</style>