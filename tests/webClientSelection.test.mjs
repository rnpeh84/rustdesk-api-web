import test from 'node:test'
import assert from 'node:assert/strict'
import { selectedWebClientURL, openSelectedWebClient } from '../src/utils/webClientSelection.js'

test('선택한 같은 출처의 경로와 인코딩된 장치 ID만 열기',()=>{
  assert.equal(selectedWebClientURL('/webcl/#/123456','https://console.example.test'),'https://console.example.test/webcl/#/123456')
  assert.equal(selectedWebClientURL('/webclient2/#/a%2Fb','http://127.0.0.1:15181'),'http://127.0.0.1:15181/webclient2/#/a%2Fb')
  for(const path of ['https://external.test/','//external.test/webcl/#/1','/webcl/../../other/#/1','/webcl/#/1?token=x','javascript:alert(1)','/webclient/#/1'])assert.throws(()=>selectedWebClientURL(path,'https://console.example.test'))
  assert.throws(()=>selectedWebClientURL('/webcl/#/1','http://console.example.test'))
})

test('팝업을 동기적으로 열고 서버의 선택 판정 후 이동',async()=>{
  const events=[]
  const tab={opener:{},location:{replace:value=>events.push(value)},close:()=>events.push('close')}
  await openSelectedWebClient({row:{row_id:11,id:'123'},origin:'https://console.example.test',open:()=>{events.push('open');return tab},resolve:async params=>{events.push(params);return {path:'/webcl/#/123'}}})
  assert.deepEqual(events,['open',{peer_id:11,device_id:'123'},'https://console.example.test/webcl/#/123'])
  assert.equal(tab.opener,null)
})

test('조회 실패 또는 경로 변조 시 탭 닫기와 기본 V2 우회 금지',async()=>{
  for(const mode of ['failed','malicious']){
    const events=[]
    await assert.rejects(openSelectedWebClient({row:{id:'123'},origin:'https://console.example.test',open:()=>({location:{replace:url=>events.push(url)},close:()=>events.push('close')}),resolve:async()=>{if(mode==='failed')throw new Error('request_failed');return {path:'https://external.test/'}}}))
    assert.deepEqual(events,['close'])
  }
})

test('팝업 차단 시 조회 실행 안 함',async()=>{
  let called=false
  await assert.rejects(openSelectedWebClient({row:{id:'123'},open:()=>null,resolve:()=>{called=true}}),/web_client_popup_blocked/)
  assert.equal(called,false)
})
