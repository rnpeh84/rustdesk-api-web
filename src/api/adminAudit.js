import request from '@/utils/request'

export const list = params => request({ url: '/admin_audit/list', params })
