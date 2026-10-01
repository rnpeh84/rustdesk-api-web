import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { T } from '@/utils/i18n'

// 삭제 확인에서 이름은 HTML이 아닌 일반 문자열로 표시한다.
export function useSettingDeletion (reload) {
  const deletingKey = ref('')
  const removeSetting = async (key, name, remove, hint) => {
    if (deletingKey.value) return
    deletingKey.value = key
    try {
      const confirmed = await ElMessageBox.confirm(
        `${T('DeleteSettingConfirm', { name })}\n${hint}`,
        T('DeleteSettingTitle'),
        { type: 'warning', customClass: 'setting-delete-confirmation', confirmButtonText: T('Delete'), cancelButtonText: T('Cancel'), confirmButtonClass: 'el-button--danger', autofocus: false, distinguishCancelAndClose: true },
      ).then(() => true, () => false)
      if (!confirmed) return
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
