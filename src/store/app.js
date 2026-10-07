import { defineStore, acceptHMRUpdate } from 'pinia'
import logo from '@/assets/solution-mark.svg'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import en from 'element-plus/es/locale/lang/en'
import ko from 'element-plus/es/locale/lang/ko'
import ru from 'element-plus/es/locale/lang/ru'
import fr from 'element-plus/es/locale/lang/fr'
import es from 'element-plus/es/locale/lang/es'
import zhTw from 'element-plus/es/locale/lang/zh-tw'
import { admin, app, server, userConfig } from '@/api/config'

const langs = {
  'zh-CN': { name: '中文', value: zhCn, sideBarWidth: '210px' },
  'en': { name: 'English', value: en, sideBarWidth: '230px' },
  'fr': { name: 'Français', value: fr, sideBarWidth: '280px' },
  'ko': { name: '한국어', value: ko, sideBarWidth: '230px' },
  'ru': { name: 'Русский', value: ru, sideBarWidth: '250px' },
  'es': { name: 'Español', value: es, sideBarWidth: '280px' },
  'zh-TW': { name: '中文繁体', value: zhTw, sideBarWidth: '210px' },
}

const resolveLang = (lang) => {
  const normalized = (lang || '').replace('_', '-')
  if (langs[normalized]) {
    return normalized
  }

  const lowerLang = normalized.toLowerCase()
  if (lowerLang.startsWith('ko')) {
    return 'ko'
  }
  if (lowerLang.startsWith('zh-tw') || lowerLang.startsWith('zh-hk') || lowerLang.startsWith('zh-hant')) {
    return 'zh-TW'
  }
  if (lowerLang.startsWith('zh')) {
    return 'zh-CN'
  }

  const baseLang = lowerLang.split('-')[0]
  return langs[baseLang] ? baseLang : 'ko'
}

const defaultLang = resolveLang(localStorage.getItem('lang') || navigator.language)
export const useAppStore = defineStore({
  id: 'App',
  state: () => ({
    setting: {
      title: 'Re;De',
      hello: '',
      sideIsCollapse: false,
      logo,
      langs: langs,
      lang: defaultLang,
      locale: langs[defaultLang],
      appConfig: {
        web_client: 1,
      },
      rustdeskConfig: {
        'id_server': '',
        'key': '',
        'relay_server': '',
        'api_server': '',
      },
    },
  }),

  actions: {
    sideCollapse () {
      this.setting.sideIsCollapse = !this.setting.sideIsCollapse
    },
    setLang (lang) {
      const resolvedLang = resolveLang(lang)
      this.setting.lang = resolvedLang
      this.setting.locale = langs[resolvedLang]
      localStorage.setItem('lang', resolvedLang)
    },
    changeLang (v) {
      this.setLang(v)
    },
    async loadConfig () {
      // 화면용 설정은 인증된 사용자 API로 조회하고 관리 API의 권한을 유지한다.
      await Promise.allSettled([this.getAdminConfig(), this.getUserConfig()])
    },
    async getUserConfig () {
      const res = await userConfig()
      this.setting.appConfig = res.data.app
      this.applyRustdeskConfig(res.data.server)
    },
    applyRustdeskConfig (serverConfig) {
      this.setting.rustdeskConfig = serverConfig
      localStorage.setItem('wc-custom-rendezvous-server', serverConfig.id_server)
      localStorage.setItem('wc-key', serverConfig.key)
      localStorage.setItem('wc-api-server', serverConfig.api_server)
    },
    getAppConfig () {
      console.log('getAppConfig')
      return app().then(res => {
        this.setting.appConfig = res.data
      })
    },
    getAdminConfig () {
      console.log('getAdminConfig')
      return admin().then(res => {
        this.replaceAdminTitle(res.data.title)
        this.setting.hello = res.data.hello
      })
    },
    replaceAdminTitle (newTitle) {
      document.title = document.title.replace(`- ${this.setting.title}`, `- ${newTitle}`)
      this.setting.title = newTitle
    },
    async loadRustdeskConfig () {
      console.log('loadRustdeskConfig')
      const res = await server().catch(_ => false)
      if (res) {
        this.setting.rustdeskConfig = res.data
        const prefix = 'wc-'
        localStorage.setItem(`${prefix}custom-rendezvous-server`, res.data.id_server)
        localStorage.setItem(`${prefix}key`, res.data.key)
        localStorage.setItem(`${prefix}api-server`, res.data.api_server)
      }

    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
}
