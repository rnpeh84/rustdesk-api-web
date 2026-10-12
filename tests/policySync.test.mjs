import test from 'node:test'
import assert from 'node:assert/strict'
import { changePolicyOption, policySyncStatusKey, directIPKey } from '../src/utils/policySync.js'
test('정책 키 편집과 해제는 다른 설정을 보존한다',()=>{
 const text=JSON.stringify({options:{'direct-server':'N','enable-terminal':'Y'},ui:{theme:'dark'}})
 const config=JSON.parse(changePolicyOption(text,'direct-server','__unmanaged'))
 assert.deepEqual(config,{options:{'enable-terminal':'Y'},ui:{theme:'dark'}})
 assert.equal(JSON.parse(changePolicyOption(text,'direct-server','Y')).options['direct-server'],'Y')
 for(const bad of ['[]','null','{"options":null}','{"options":[]}'])assert.throws(()=>changePolicyOption(bad,'direct-server','N'))
})
test('수신 응답과 실제 적용 및 만료·미지원 상태를 구분한다',()=>{
 assert.equal(policySyncStatusKey({supported:true,status:'acknowledged',last_observed_at:100},110),'PolicySyncAcknowledged')
 assert.equal(policySyncStatusKey({supported:true,status:'acknowledged',last_observed_at:100},161),'PolicySyncStale')
 assert.equal(policySyncStatusKey({supported:false,status:'acknowledged'},110),'PolicySyncUnsupported')
 assert.equal(directIPKey('unknown'),'PolicyNotManaged')
})
