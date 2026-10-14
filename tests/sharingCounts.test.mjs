import test from 'node:test'
import assert from 'node:assert/strict'
import {sharingDeviceCounts} from '../src/utils/sharingCounts.js'
test('두 공유 종류의 장치 항목 수와 받은 공유의 만료를 구분한다',()=>{
 const books=[{share_kind:'device',device_count:3,recipients:[{expires_at:200}]},{share_kind:'device',device_count:2,recipients:[{expires_at:90}]},{device_count:7,recipients:[{expires_at:0}]},{share_kind:'address_book',device_count:4,recipients:[]}]
 assert.deepEqual(sharingDeviceCounts(books,'sent',100),{device:5,address_book:7})
 assert.deepEqual(sharingDeviceCounts(books,'received',100),{device:3,address_book:7})
 assert.deepEqual(sharingDeviceCounts(books,'received',200),{device:0,address_book:7})
 assert.deepEqual(sharingDeviceCounts([],'sent',100),{device:0,address_book:0})
})
