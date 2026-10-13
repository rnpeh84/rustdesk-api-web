import request from '@/utils/request'

export const securityStatus = () => request({ url: '/account_security/status' })
export const setupTOTP = () => request({ url: '/account_security/totp/setup', method: 'post' })
export const enableTOTP = data => request({ url: '/account_security/totp/enable', method: 'post', data })
export const disableTOTP = () => request({ url: '/account_security/totp/disable', method: 'post' })
export const sessions = params => request({ url: '/account_security/sessions', params })
export const revokeSession = data => request({ url: '/account_security/sessions/revoke', method: 'post', data })

