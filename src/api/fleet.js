import request from '@/utils/request'

export const tokens = params => request({ url: '/fleet/tokens', params })
export const createToken = data => request({ url: '/fleet/tokens/create', method: 'post', data })
export const revokeToken = data => request({ url: '/fleet/tokens/revoke', method: 'post', data })
export const importDevices = data => request({ url: '/fleet/import', method: 'post', data })
export const enrollments = params => request({ url: '/fleet/enrollments', params })

