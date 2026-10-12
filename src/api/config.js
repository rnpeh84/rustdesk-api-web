import request from '@/utils/request'

export const userConfig = () => request({ url: '/config/user' })

export function server () {
  return request({
    url: '/config/server',
    method: 'get',
  })
}

export function app () {
  return request({
    url: '/config/app',
    method: 'get',
  })
}

export function admin () {
  return request({
    url: '/config/admin',
    method: 'get',
  })
}

export const connectionSecurity = () => request({ url: '/config/connection-security' })
export const saveConnectionSecurity = data => request({ url: '/config/connection-security', method: 'post', data })
