import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const source = await readFile(new URL('../src/utils/inlineConfirmation.js', import.meta.url), 'utf8')
const { createInlineConfirmation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const fixture = (execute = () => {}) => {
  let state, expiry, disabled = false, calls = 0
  const control = createInlineConfirmation({
    execute: () => { calls++; return execute() },
    changed: value => { state = value }, disabled: () => disabled,
    schedule: callback => { expiry = callback; return 1 }, cancel: () => { expiry = undefined },
  })
  return { control, state: () => state, calls: () => calls, expire: () => expiry?.(), disable: value => { disabled = value } }
}

test('첫 클릭은 확인만 준비하고 두 번째 클릭에서 한 번 실행한다', async () => {
  const f = fixture()
  await f.control.activate()
  assert.equal(f.calls(), 0)
  assert.equal(f.state().armed, true)
  await f.control.activate()
  assert.equal(f.calls(), 1)
  assert.deepEqual(f.state(), { armed: false, pending: false })
})

test('초점 이탈·Esc·대상 변경으로 취소한 뒤에는 두 번 클릭해야 한다', async () => {
  const f = fixture()
  await f.control.activate()
  f.control.reset()
  await f.control.activate()
  assert.equal(f.calls(), 0)
  assert.equal(f.state().armed, true)
})

test('확인 시간이 지나면 첫 단계로 돌아간다', async () => {
  const f = fixture()
  await f.control.activate()
  f.expire()
  await f.control.activate()
  assert.equal(f.calls(), 0)
  assert.equal(f.state().armed, true)
})

test('처리 중 반복 클릭과 초점 이탈은 중복 요청을 만들지 않는다', async () => {
  let finish
  const f = fixture(() => new Promise(resolve => { finish = resolve }))
  await f.control.activate()
  const request = f.control.activate()
  f.control.reset()
  await f.control.activate()
  await f.control.activate()
  assert.equal(f.calls(), 1)
  assert.equal(f.state().pending, true)
  finish()
  await request
  assert.equal(f.state().pending, false)
})

test('실패 후 잠금을 해제하고 다시 두 단계로 실행한다', async () => {
  const f = fixture(() => Promise.reject(new Error('검증용 실패')))
  await f.control.activate()
  await assert.rejects(f.control.activate(), /검증용 실패/)
  assert.deepEqual(f.state(), { armed: false, pending: false })
  await f.control.activate()
  assert.equal(f.calls(), 1)
})

test('비활성 버튼은 확인 상태나 요청을 만들지 않는다', async () => {
  const f = fixture()
  f.disable(true)
  await f.control.activate()
  assert.equal(f.calls(), 0)
  assert.equal(f.state(), undefined)
})
