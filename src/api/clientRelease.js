import request from '@/utils/request'
import { getToken } from '@/utils/auth'
import { downBlob } from '@/utils/file'

export const clientReleases = () => request({ url: '/client/releases' })
export const adminClientReleases = () => request({ url: '/client/admin/releases' })
export const clientReleaseHistory = params => request({ url: '/client/admin/history', params })
export const validateClientRelease = data => request({ url: '/client/admin/validate', method: 'post', data })
export const promoteClientRelease = data => request({ url: '/client/admin/promote', method: 'post', data })
export const revokeClientRelease = data => request({ url: '/client/admin/revoke', method: 'post', data })
export const rollbackClientRelease = data => request({ url: '/client/admin/rollback', method: 'post', data })

export async function downloadClientArtifact (artifact) {
  let fileHandle = null
  if (window.showSaveFilePicker) {
    try {
      fileHandle = await window.showSaveFilePicker({ suggestedName: artifact.filename })
    } catch (error) {
      if (error?.name === 'AbortError') return false
      throw error
    }
  }
  const response = await fetch(artifact.download_url, {
    headers: {
      'api-token': getToken(),
      'X-Client-Environment': `${navigator.platform || 'web'}/${navigator.userAgent || 'unknown'}`.slice(0, 128),
    },
  })
  if (!response.ok) {
    const error = new Error(`다운로드 요청 실패 (${response.status})`)
    error.status = response.status
    throw error
  }
  if (fileHandle && response.body) {
    const writable = await fileHandle.createWritable()
    await response.body.pipeTo(writable)
    return true
  }
  downBlob(await response.blob(), artifact.filename)
  return true
}
