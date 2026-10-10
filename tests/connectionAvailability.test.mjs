import assert from 'node:assert/strict'
import test from 'node:test'
import {connectionAvailability as availability} from '../src/utils/connectionAvailability.js'
const now=1000, peer={last_online_time:990}, report={reported_at:990,service_running:true,desktop_state:'available',terminal_state:'available',desktop_web_enabled:true,state:'unknown'}
test('수동 설치 온라인 장치는 보고 없이 접속 시 검사를 허용한다',()=>{
 const result=availability(peer,{reported_at:0,desktop_web_enabled:true},now)
 assert.deepEqual(result.modes,['desktop','terminal']);assert.equal(result.unknown,true);assert.equal(result.fresh,false)
})
test('오프라인·미등록 장치를 접속 가능으로 추정하지 않는다',()=>{
 for(const item of [{last_online_time:0},{last_online_time:939}])assert.deepEqual(availability(item,{desktop_web_enabled:true},now).modes,[])
})
test('명시적인 미지원·비활성·서비스 중지 보고를 유지한다',()=>{
 assert.deepEqual(availability(peer,{...report,terminal_state:'disabled'},now).modes,['desktop'])
 assert.deepEqual(availability(peer,{...report,desktop_state:'no_session'},now).modes,['terminal'])
 assert.deepEqual(availability(peer,{...report,service_running:false},now).modes,[])
 assert.deepEqual(availability(peer,{...report,state:'unsupported'},now).modes,['desktop'])
})
test('만료 보고를 현재 기능 상태로 표시하지 않고 heartbeat로 접속 시 검사한다',()=>{
 const result=availability(peer,{...report,reported_at:909},now)
 assert.equal(result.fresh,false);assert.equal(result.unknown,true);assert.deepEqual(result.modes,['desktop','terminal'])
 assert.deepEqual(availability(peer,{...report,desktop_web_enabled:false},now).modes,['terminal'])
})
