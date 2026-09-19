import axios from 'axios'

const publicAPI = axios.create({ baseURL: '/api', timeout: 15000 })
const call = async (url, data) => {
  const response = await publicAPI.post(url, data)
  if (response.data?.code !== 0) throw response.data
  return response.data
}
export const requestPasswordReset = data => call('/password/reset/request', data)
export const confirmPasswordReset = data => call('/password/reset/confirm', data)
export const acceptInvite = data => call('/invite/accept', data)

