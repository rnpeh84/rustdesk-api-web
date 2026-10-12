import test from 'node:test'
import assert from 'node:assert/strict'
import {registrationStatusKey,registrationCommandActive} from '../src/utils/manualEnrollment.js'
test('등록 완료·만료·소유권 변경을 구분하고 알 수 없는 상태는 완료로 표시하지 않는다',()=>{
 assert.equal(registrationStatusKey({status:'registered'}),'ManualRegistrationComplete')
 assert.equal(registrationStatusKey({status:'changed'}),'ManualRegistrationChanged')
 assert.equal(registrationStatusKey({status:'expired'}),'ManualRegistrationExpired')
 assert.equal(registrationStatusKey({status:'unexpected'}),'ManualRegistrationPending')
 assert.equal(registrationStatusKey(null),'ManualRegistrationPending')
})
test('명령 기한 경계와 잘못된 기한에서 복사·실행을 차단한다',()=>{
 assert.equal(registrationCommandActive(100,99999),true)
 for(const expiry of [100,0,NaN,Infinity,'101'])assert.equal(registrationCommandActive(expiry,100000),false)
})

test('수동 등록의 한국어·영어 문구는 번역 로더 계약을 지킨다',async()=>{
 const {readFile}=await import('node:fs/promises')
 for(const language of ['ko','en']){
  const data=JSON.parse(await readFile(new URL('../src/utils/i18n/'+language+'.json',import.meta.url),'utf8'))
  for(const [key,value] of Object.entries(data).filter(([key])=>key.startsWith('Manual')))assert.equal(typeof value.One,'string',language+':'+key)
 }
})
