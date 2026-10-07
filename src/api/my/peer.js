import request from '@/utils/request'

export const counts = () => request({ url: '/my/peer/counts' })
export const deletePreview = row_id => request({ url: '/my/peer/delete-preview', params: { row_id } })
export const remove = data => request({ url: '/my/peer/delete', method: 'post', data })

export function list (params) {
  return request({
    url: '/my/peer/list',
    params,
  })
}
