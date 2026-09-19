import request from '@/utils/request'

export const list = params => request({ url: '/policy/list', params })
export const detail = id => request({ url: `/policy/detail/${id}` })
export const create = data => request({ url: '/policy/create', method: 'post', data })
export const update = data => request({ url: '/policy/update', method: 'post', data })
export const validate = data => request({ url: '/policy/validate', method: 'post', data })
export const publish = data => request({ url: '/policy/publish', method: 'post', data })
export const assign = data => request({ url: '/policy/assign', method: 'post', data })
export const preview = id => request({ url: `/policy/preview/${id}` })
export const history = id => request({ url: `/policy/history/${id}` })
