import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/utils/officialInstall.js', import.meta.url), 'utf8')
const { newInstallPassword, beginInstallCommandCopy } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
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

async function withClipboard (clipboard, item, run) {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const itemDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ClipboardItem')
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } })
  Object.defineProperty(globalThis, 'ClipboardItem', { configurable: true, value: item })
  try { await run() }
  finally {
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor)
    else delete globalThis.navigator
    if (itemDescriptor) Object.defineProperty(globalThis, 'ClipboardItem', itemDescriptor)
    else delete globalThis.ClipboardItem
  }
}

test('서버 응답 전 클릭 안에서 복사를 예약하고 완성된 명령만 전달한다', async () => {
  let resolveCommand, activeClick = true, queued = false, copied = ''
  const commandPromise = new Promise(resolve => { resolveCommand = resolve })
  class Item { constructor (content) { this.content = content } }
  await withClipboard({ async write (items) {
    assert.equal(activeClick, true, '응답 후로 복사 요청이 지연됨')
    queued = true
    const content = await items[0].content['text/plain']
    assert.equal(content.type, 'text/plain')
    copied = await content.text()
  } }, Item, async () => {
    const result = beginInstallCommandCopy(commandPromise)
    assert.equal(queued, true)
    assert.equal(copied, '')
    activeClick = false; resolveCommand('fixture-only-command')
    assert.equal(await result, true)
    assert.equal(copied, 'fixture-only-command')
  })
})

test('텍스트 복사 fallback은 오류·만료 명령을 복사하지 않고 거부를 처리한다', async () => {
  const values = []
  await withClipboard({ async writeText (value) { values.push(value) } }, undefined, async () => {
    assert.equal(await beginInstallCommandCopy(Promise.resolve('fixture-only-command')), true)
    assert.equal(await beginInstallCommandCopy(Promise.resolve(null)), false)
    assert.equal(await beginInstallCommandCopy(Promise.reject(new Error('fixture_api_error'))), false)
    assert.deepEqual(values, ['fixture-only-command'])
  })
  class Item { constructor (content) { this.content = content } }
  await withClipboard({ async write () { throw new Error('fixture_permission_denied') } }, Item, async () => {
    assert.equal(await beginInstallCommandCopy(Promise.reject(new Error('fixture_api_error'))), false)
    assert.equal(await beginInstallCommandCopy(Promise.resolve('fixture-only-command')), false)
  })
})
