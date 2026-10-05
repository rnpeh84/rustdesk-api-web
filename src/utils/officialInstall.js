export function newInstallPassword () {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const limit = 256 - (256 % alphabet.length)
  let password = ''
  while (password.length < 8) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
    for (const byte of bytes) {
      if (byte < limit) password += alphabet[byte % alphabet.length]
      if (password.length === 8) break
    }
  }
  return password
}

// 클릭 이벤트 안에서 복사를 예약해 서버 응답을 기다리는 동안 사용자 조작 권한이 사라지지 않게 한다.
export function beginInstallCommandCopy (commandPromise) {
  const validCommand = value => {
    if (typeof value !== 'string' || !value) throw new Error('installation_command_unavailable')
    return value
  }
  const clipboard = globalThis.navigator?.clipboard
  let operation
  if (typeof globalThis.ClipboardItem === 'function' && typeof clipboard?.write === 'function') {
    const content = commandPromise.then(value => new Blob([validCommand(value)], { type: 'text/plain' }))
    // 권한이 즉시 거부되거나 생성자가 실패해도 늦은 명령 발급 오류를 처리한다.
    content.catch(() => {})
    try { operation = clipboard.write([new globalThis.ClipboardItem({ 'text/plain': content })]) }
    catch { operation = commandPromise.then(value => clipboard.writeText(validCommand(value))) }
  } else {
    operation = commandPromise.then(value => clipboard.writeText(validCommand(value)))
  }
  return Promise.resolve(operation).then(() => true, () => false)
}
