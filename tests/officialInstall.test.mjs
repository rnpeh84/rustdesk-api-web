import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/utils/officialInstall.js', import.meta.url), 'utf8')
const { newInstallPassword,detectInstallPlatform } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
test('설치 대상 OS의 기본값은 브라우저 OS를 따른다', () => {
  for(const [input,expected] of [['Win32','windows'],['Windows','windows'],['MacIntel','macos'],['macOS','macos'],['Linux x86_64','linux'],['','linux']])assert.equal(detectInstallPlatform(input),expected)
})
test('비밀번호는 8자리이며 안전한 난수로 매번 생성한다', () => {
  const values = new Set(Array.from({ length: 100 }, () => newInstallPassword()))
  assert.equal(values.size, 100)
  for (const value of values) assert.match(value, /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789]{8}$/)
})
test('설치 화면의 모든 문구에 한국어와 영문 fallback이 있다', async () => {
  const component = await readFile(new URL('../src/components/client/OfficialClientInstall.vue', import.meta.url), 'utf8')
  const ko = JSON.parse(await readFile(new URL('../src/utils/i18n/ko.json', import.meta.url), 'utf8'))
  const en = JSON.parse(await readFile(new URL('../src/utils/i18n/en.json', import.meta.url), 'utf8'))
  for (const key of new Set(component.match(/OfficialInstall[A-Za-z_]+/g))) {
    if (key === 'OfficialInstallMode_') continue
    assert.ok(ko[key]?.One, `한국어 번역 누락: ${key}`)
    assert.ok(en[key]?.One, `영문 fallback 누락: ${key}`)
  }
})
