import { useDark } from '@vueuse/core'

// 로그인 화면부터 같은 테마를 사용하며, 저장된 사용자 선택을 우선한다.
export const isDark = useDark({ initialValue: 'dark' })
