import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { test } from 'node:test'
const source = await readFile(new URL('../src/utils/queryScheduler.js', import.meta.url), 'utf8')
const { createQueryScheduler } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const fixture = () => {
  let calls = 0, next = 0
  const timers = new Map()
  const control = createQueryScheduler(() => calls++, fn => { timers.set(++next, fn); return next }, id => timers.delete(id))
  return { control, calls: () => calls, timers, tick: () => [...timers.values()].forEach(fn => fn()) }
}
test('연속 입력은 마지막 예약 한 번으로 모아서 조회한다', () => {
  const f = fixture()
  f.control.queue(); f.control.queue(); f.control.queue()
  assert.equal(f.calls(), 0)
  assert.equal(f.timers.size, 1)
  f.tick()
  assert.equal(f.calls(), 1)
  assert.equal(f.timers.size, 0)
})
test('Enter 조회는 예약을 취소하고 즉시 한 번 실행한다', () => {
  const f = fixture()
  f.control.queue(); f.control.flush(); f.tick()
  assert.equal(f.calls(), 1)
})
test('화면 이탈은 대기 중인 조회를 취소한다', () => {
  const f = fixture()
  f.control.queue(); f.control.cancel(); f.tick()
  assert.equal(f.calls(), 0)
})
