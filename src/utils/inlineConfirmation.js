// 버튼별 확인 상태와 실행 잠금을 관리한다. 첫 클릭은 API를 호출하지 않는다.
export function createInlineConfirmation({ execute, changed, disabled = () => false, schedule = setTimeout, cancel = clearTimeout }) {
  let armed = false
  let pending = false
  let timer
  const notify = () => changed({ armed, pending })
  const reset = () => {
    cancel(timer)
    timer = undefined
    armed = false
    notify()
  }
  const activate = async () => {
    if (pending || disabled()) return
    if (!armed) {
      armed = true
      timer = schedule(reset, 5000)
      notify()
      return
    }
    cancel(timer)
    timer = undefined
    armed = false
    pending = true
    notify()
    try { await execute() }
    finally { pending = false; notify() }
  }
  return { activate, reset }
}
