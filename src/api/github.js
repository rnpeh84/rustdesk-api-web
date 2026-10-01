import request from '@/utils/request'

// GitHub 인증과 정보 조회는 서버를 경유하며 브라우저에 저장된 비밀값을 재사용하지 않는다.
export const githubConnections = () => request({ url: '/client-build/github-connections' })
export const saveGithubConnection = data => request({ url: '/client-build/github-connections', method: 'post', data })
export const testGithubConnection = id => request({ url: `/client-build/github-connections/${id}/test`, method: 'post' })
export const githubRepositories = id => request({ url: `/client-build/github-connections/${id}/repositories` })
export const githubBranches = (id, params) => request({ url: `/client-build/github-connections/${id}/branches`, params })
export const githubWorkflows = (id, params) => request({ url: `/client-build/github-connections/${id}/workflows`, params })
export const githubRunners = (id, params) => request({ url: `/client-build/github-connections/${id}/runners`, params })
export const githubBuildSources = params => request({ url: '/client-build/github-sources', params })
export const saveGithubBuildSource = data => request({ url: '/client-build/github-sources', method: 'post', data })
export const testGithubBuildSource = id => request({ url: `/client-build/github-sources/${id}/test`, method: 'post' })
