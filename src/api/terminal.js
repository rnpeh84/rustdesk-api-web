import request from '@/utils/request'

export const terminalStatus = peer_id => request({ url: '/terminal/status', params: { peer_id }, silentError: true })
export const terminalHistory = (peer_id, params = {}) => request({ url: '/terminal/history', params: { ...params, peer_id }, silentError: true })
export const prepareTerminal = data => request({ url: '/terminal/sessions', method: 'post', data, silentError: true })
export const terminalPreferences = () => request({ url: '/terminal/preferences', silentError: true })
export const saveTerminalPreferences = data => request({ url: '/terminal/preferences', method: 'post', data, silentError: true })
