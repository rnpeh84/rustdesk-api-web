import request from '@/utils/request'

export const status = () => request({ url: '/operations/status' })
export const alarms = params => request({ url: '/operations/alarms', params })
export const updateAlarm = data => request({ url: '/operations/alarms/update', method: 'post', data })

