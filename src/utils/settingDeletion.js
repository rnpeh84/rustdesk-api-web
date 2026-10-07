import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { T } from '@/utils/i18n'

// 확인 버튼을 두 번 누른 뒤 호출하며, 설정 삭제 요청의 중복 실행을 차단한다.
export function useSettingDeletion (reload) {
  const deletingKey = ref('')
  const removeSetting = async (key, name, remove) => {
    if (deletingKey.value) return
    deletingKey.value = key
    try {
      await remove()
      ElMessage.success(T('SettingDeleted'))
      await reload()
    } catch {
      // 요청 실패 안내는 공통 응답 처리기가 표시하며 중복 메시지를 만들지 않는다.
    } finally {
      deletingKey.value = ''
    }
  }
  return { deletingKey, removeSetting }
}
