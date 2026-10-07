import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notificationAge, isRecentNotification } from '../src/utils/notificationTime.js'

test('5초 경계에서 강조가 사라지고 읽은 알림은 강조하지 않는다', () => {
  const item = { time: 1000, read: false }
  assert.equal(isRecentNotification(item, 5999), true)
  assert.equal(isRecentNotification(item, 6000), false)
  assert.equal(isRecentNotification({ ...item, read: true }, 1001), false)
  assert.equal(isRecentNotification(null, 1001), false)
})
test('경과 시간을 초·분·시간·일로 표시하고 미래 시각은 0으로 제한한다', () => {
  assert.equal(notificationAge(0, 5000, 'en'), '5 seconds ago')
  assert.equal(notificationAge(0, 65000, 'en'), '1 minute ago')
  assert.equal(notificationAge(0, 3600000, 'en'), '1 hour ago')
  assert.equal(notificationAge(0, 86400000, 'en'), 'yesterday')
  assert.equal(notificationAge(5000, 0, 'en'), 'now')
})
