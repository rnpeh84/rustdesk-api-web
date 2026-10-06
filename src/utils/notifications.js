import { computed, reactive, shallowRef } from 'vue'
import { ElMessage } from 'element-plus'

// 알림은 현재 탭의 메모리에만 보관한다. 서버와 브라우저 저장소에 기록하지 않는다.
export const notifications = reactive({ items: [], revision: 0, opened: false })
export const notificationPortal = shallowRef(null)
let sequence = 0
export const attachNotificationHost = element => { if (element) notificationPortal.value = element }
export const releaseNotificationHost = element => { if (notificationPortal.value === element) {notificationPortal.value = null;notifications.opened=false} }
export const visibleNotifications=computed(()=>notificationPortal.value ? notifications.items : [])
export const readNotifications = () => { visibleNotifications.value.forEach(item => { item.read = true }) }

export function notifyTerminal(input = {}) {
  const options = typeof input === 'string' ? { message: input } : input
  const message = typeof options?.message === 'string' ? options.message : ''
  if (!message.trim()) return { close() {} }
  const type = ['success', 'error', 'warning', 'info'].includes(options.type) ? options.type : 'info'
  const scope='terminal'
  const last = notifications.items[0], now = Date.now()
  if (last && last.message === message && last.type === type && last.scope===scope && now - last.time < 3000) {
    last.count++; last.time = now; last.read = notifications.opened
  } else {
    notifications.items.unshift({ id: ++sequence, message: message.slice(0, 2000), type, scope, time: now, count: 1, read: notifications.opened })
    notifications.items.splice(40)
  }
  notifications.revision++
  const item = notifications.items[0]
  return { close: () => { item.read = true; options.onClose?.() } }
}
// 일반 화면의 알림은 기존 일시 알림으로 표시하고 터미널 기록과 섞지 않는다.
export const notify = ElMessage
for (const type of ['success', 'error', 'warning', 'info']) notifyTerminal[type] = input => notifyTerminal(typeof input === 'string' ? { message: input, type } : { ...input, type })
notifyTerminal.closeAll = readNotifications
export const showNotifications = () => { notifications.opened = true; readNotifications() }
