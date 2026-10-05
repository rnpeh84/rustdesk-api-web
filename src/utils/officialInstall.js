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

export function detectInstallPlatform (platform=globalThis.navigator?.userAgentData?.platform||globalThis.navigator?.platform||'') {
  if(/win/i.test(platform))return 'windows'
  if(/mac/i.test(platform))return 'macos'
  return 'linux'
}
