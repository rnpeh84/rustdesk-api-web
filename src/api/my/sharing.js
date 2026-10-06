import request from '@/utils/request'

export const books = params => request({ url: '/my/sharing/books', params })
export const recipients = params => request({ url: '/my/sharing/recipients', params })
export const entries = params => request({ url: '/my/sharing/entries', params })
export const save = data => request({ url: '/my/sharing/save', method: 'post', data })
