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

export const endpointProfiles = () => request({ url: '/client-build/endpoint-profiles' })
export const saveEndpointProfile = data => request({ url: '/client-build/endpoint-profiles', method: 'post', data })
export const deleteEndpointProfile = id => request({ url: `/client-build/endpoint-profiles/${id}`, method: 'delete' })
// 기존 호출부의 호환성을 유지하고 GitHub 전용 API는 별도 모듈에서 관리한다.
export * from './github'
export const clientBuildReadiness = params => request({ url: '/client-build/readiness', params })
export const clientBuildJobs = params => request({ url: '/client-build/jobs', params })
export const clientBuildDetails = id => request({ url: `/client-build/jobs/${id}/details` })
export const createClientBuildJob = data => request({ url: '/client-build/jobs', method: 'post', data })
export const refreshClientBuildJob = id => request({ url: `/client-build/jobs/${id}/refresh`, method: 'post' })
export const cancelClientBuildJob = id => request({ url: `/client-build/jobs/${id}/cancel`, method: 'post' })

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
