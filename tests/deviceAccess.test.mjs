import test from 'node:test'
import assert from 'node:assert/strict'
import { accessPathKey, accessReasonKey } from '../src/utils/deviceAccess.js'
test('접속 권한은 독립 경로와 거부 이유를 안전한 번역 키로 구분한다', () => {
 for (const path of ['owner','user_share','group_share','automatic_group','admin_permission']) assert.notEqual(accessPathKey(path),'DeviceAccessUnknown')
 for (const reason of ['device_blocked','identity_changed','identity_conflict','unregistered','permission_denied']) assert.notEqual(accessReasonKey(reason),'DeviceAccessAllowed')
 assert.equal(accessReasonKey('raw-private-error'),'DeviceAccessUnknown')
})

// 번역 로더가 요구하는 One 형식을 확인해 실제 화면 렌더링 실패를 방지한다.
test('장치 권한의 한국어·영어 번역은 렌더링 계약을 지킨다', async () => {
 const {readFile} = await import('node:fs/promises')
 for (const language of ['ko','en']) {
  const resources = JSON.parse(await readFile(new URL('../src/utils/i18n/'+language+'.json', import.meta.url), 'utf8'))
  for (const [key,value] of Object.entries(resources).filter(([key])=>key.startsWith('DeviceAccess'))) {
   assert.equal(typeof value.One, 'string', language+': '+key)
   assert.ok(value.One.length > 0, language+': '+key)
  }
 }
})
