import { T } from '@/utils/i18n'

const defaultGroupNames = new Set(['默认组', '默認組', 'Default Group', '기본 그룹'])
const sharedGroupNames = new Set(['共享组', '共享組', 'Shared Group', '공유 그룹'])

// 이전 버전에서 생성된 기본 그룹명도 현재 화면 언어에 맞춰 표시한다.
export const displayGroupName = group => {
  if (!group?.name) return '-'
  if (defaultGroupNames.has(group.name)) return T('DefaultGroup')
  if (sharedGroupNames.has(group.name)) return T('ShareGroup')
  return group.name
}
