// RustDesk ServerConfig.decode와 호환되는 URL-safe Base64 역순 문자열이다.
export function encodeRustDeskConfig (server = {}) {
  const config = {
    host: String(server.id_server || '').trim(),
    relay: String(server.relay_server || '').trim(),
    api: String(server.api_server || '').trim(),
    key: String(server.key || server.public_key || '').trim(),
  }
  if (!config.host || !config.key) return ''
  const bytes = new TextEncoder().encode(JSON.stringify(config))
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').split('').reverse().join('')
}

export function rustDeskQrPayload (server) {
  const encoded = encodeRustDeskConfig(server)
  return encoded ? `config=${encoded}` : ''
}
