import request from '@/utils/request'

export const smtp = () => request({ url: '/external_auth/smtp' })
export const saveSMTP = data => request({ url: '/external_auth/smtp/save', method: 'post', data })
export const testSMTP = data => request({ url: '/external_auth/smtp/test', method: 'post', data })
export const testOIDC = data => request({ url: '/external_auth/oidc/test', method: 'post', data })
export const dryRunLDAP = data => request({ url: '/external_auth/ldap/dry-run', method: 'post', data })
export const invite = data => request({ url: '/account_actions/invite', method: 'post', data })

