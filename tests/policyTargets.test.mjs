import test from 'node:test'
import assert from 'node:assert/strict'
import { createPolicyTargetSearch, policyTargetLabel } from '../src/utils/policyTargets.js'

test('동명 장치를 호스트명과 접속 ID로 구분한다', () => {
 assert.equal(policyTargetLabel({name:'시험 장치',detail:'519406662'}),'시험 장치 (519406662)')
 assert.equal(policyTargetLabel({name:'개발팀',detail:''}),'개발팀')
})
test('범위 변경 뒤 도착한 이전 응답을 무시한다', async () => {
 let resolveOld; const states=[]
 const loader=createPolicyTargetSearch(params => params.scope_type==='device' ? new Promise(resolve=>{resolveOld=resolve}) : Promise.resolve([{id:3,name:'사용자'}]), state=>states.push(state))
 const old=loader.search('device'); loader.reset(); await loader.search('user');resolveOld([{id:1,name:'장치'}]);await old
 assert.deepEqual(states.at(-1).items,[{id:3,name:'사용자'}])
})
test('검색 실패를 빈 결과와 구분하고 닫힌 대화상자에 늦은 결과를 적용하지 않는다', async () => {
 const states=[];let finish
 const loader=createPolicyTargetSearch(()=>new Promise((resolve,reject)=>{finish=reject}),state=>states.push(state))
 const active=loader.search('device');finish(new Error('failed'));await active;assert.equal(states.at(-1).failed,true)
 const closing=loader.search('user');loader.reset();finish(new Error('late'));await closing;assert.deepEqual(states.at(-1),{loading:false,failed:false,items:[]})
})
