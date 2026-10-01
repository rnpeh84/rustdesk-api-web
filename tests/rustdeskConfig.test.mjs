import assert from 'node:assert/strict'
import test from 'node:test'
import QRCode from 'qrcode'
import { encodeRustDeskConfig, rustDeskQrPayload } from '../src/utils/rustdeskConfig.js'

const decode = value => JSON.parse(Buffer.from(value.split('').reverse().join(''), 'base64url').toString('utf8'))
const server = { id_server: 'rust.example.com:21116', relay_server: 'rust.example.com:21117', api_server: 'https://rust.example.com', key: 'fixture-public-key' }

test('클라이언트와 동일한 필드·Base64 역순 형식', () => {
  assert.deepEqual(decode(encodeRustDeskConfig(server)), { host: server.id_server, relay: server.relay_server, api: server.api_server, key: server.key })
})

test('Unicode·공백 처리와 비밀정보 제외', () => {
  const encoded = encodeRustDeskConfig({ id_server: ' 서버.example.com ', public_key: ' public-key ', token: 'secret-token', private_key: 'secret-key', password: 'secret-password' })
  assert.deepEqual(decode(encoded), { host: '서버.example.com', relay: '', api: '', key: 'public-key' })
})

test('필수 연결 정보가 없으면 생성하지 않음', () => {
  for (const value of [{}, { id_server: 'server' }, { key: 'key' }]) {
    assert.equal(encodeRustDeskConfig(value), '')
    assert.equal(rustDeskQrPayload(value), '')
  }
})

test('RustDesk 앱 QR 접두어와 QR 생성', () => {
  const payload = rustDeskQrPayload(server)
  assert.ok(payload.startsWith('config='))
  assert.deepEqual(decode(payload.slice(7)), decode(encodeRustDeskConfig(server)))
  const code = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  assert.ok(code.modules.size > 0)
})

test('지나치게 긴 설정은 QR 생성 오류로 처리하며 원본을 자르지 않음', () => {
  const huge = { ...server, key: 'a'.repeat(8192) }
  const payload = rustDeskQrPayload(huge)
  assert.equal(decode(payload.slice(7)).key.length, 8192)
  assert.throws(() => QRCode.create(payload, { errorCorrectionLevel: 'M' }))
})
