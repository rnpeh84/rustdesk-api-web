import assert from 'node:assert/strict'
import test from 'node:test'
import { cssToFlutterColor, flutterColorToCss } from '../src/utils/tagColor.js'

test('색상 선택기의 rgb와 rgba를 동일한 불투명 ARGB로 저장한다', () => {
  assert.equal(cssToFlutterColor('rgb(210, 50, 50)'), 0xffd23232)
  assert.equal(cssToFlutterColor('rgba(210, 50, 50, 1)'), 0xffd23232)
})
test('투명도와 32비트 부호 없는 색상을 보존한다', () => {
  assert.equal(cssToFlutterColor('rgba(255, 255, 255, .5)'), 0x80ffffff)
  assert.equal(cssToFlutterColor('rgb(255, 255, 255)'), 0xffffffff)
  assert.equal(cssToFlutterColor('rgba(0, 0, 0, 0)'), 0)
  assert.equal(cssToFlutterColor(flutterColorToCss(0x81aa2233)), 0x81aa2233)
})
test('잘못된 색상은 예외나 숫자 넘침 없이 거부한다', () => {
  for (const value of [null, '', 'red', 'rgba(1,2,3,2)', 'rgb(256,0,0)', 'rgba(-1,0,0,1)']) {
    assert.equal(cssToFlutterColor(value), null)
  }
})
