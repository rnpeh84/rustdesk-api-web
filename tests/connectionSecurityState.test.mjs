import test from 'node:test'
import assert from 'node:assert/strict'
import { connectionSecurityBadge, connectionSecurityFailure } from '../src/utils/connectionSecurityState.js'
test('서버 보고 만료 시 화면에서도 현재 확인 상태를 유지하지 않는다', () => {
 assert.deepEqual(connectionSecurityBadge({ state: 'reported', last_checked_at: 100 }, 159999), ['ConnectionSecurityReported', 'info'])
 assert.deepEqual(connectionSecurityBadge({ state: 'reported', last_checked_at: 100 }, 160000), ['ConnectionSecurityStale', 'warning'])
})
test('정책 확인과 실패·미구현·미확인을 구분한다', () => {
 for (const state of ['policy_pending', 'error', 'unsupported', 'device_access_pending', 'credential_changed']) assert.notEqual(connectionSecurityBadge({state})[0], 'ConnectionSecurityReported')
 assert.equal(connectionSecurityBadge({state:'unknown'})[0], 'ConnectionSecurityUnverified')
 assert.equal(connectionSecurityFailure('raw-secret-error'), 'ConnectionSecurityUnverified')
 assert.equal(connectionSecurityFailure('api_unavailable'), 'ConnectionSecurityApiUnavailable')
})
