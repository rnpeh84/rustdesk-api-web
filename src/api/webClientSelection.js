import request from '@/utils/request'

export const settings = () => request({ url: '/operations/web-client/settings' })
export const targets = params => request({ url: '/operations/web-client/targets', params })
export const save = data => request({ url: '/operations/web-client/settings', method: 'post', data })
export const remove = data => request({ url: '/operations/web-client/remove', method: 'post', data })
export const resolve = params => request({ url: '/web-client/resolve', params })
