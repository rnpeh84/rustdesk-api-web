import request from '@/utils/request'

export const terminalStatus = peer_id => request({ url: '/terminal/status', params: { peer_id }, silentError: true })
export const prepareTerminal = data => request({ url: '/terminal/sessions', method: 'post', data, silentError: true })
