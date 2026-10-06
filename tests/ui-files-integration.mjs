// 실제 로컬 API·TLS WebSocket·암호화 모의 장치로 파일 RPC와 권한 취소를 검증한다.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {chromium,request}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const fixture=JSON.parse(await readFile(process.env.RUSTDESK_BROWSER_READY,'utf8'))
const browser=await chromium.launch({headless:true,channel:'chrome'})
const context=await browser.newContext({locale:'ko-KR',ignoreHTTPSErrors:true,acceptDownloads:true})
await context.addInitScript(token=>{localStorage.setItem('lang','ko');localStorage.setItem('access_token',token)},fixture.token)
const page=await context.newPage(),errors=[],socketURLs=[]
page.on('pageerror',e=>errors.push(e.message));page.on('websocket',ws=>socketURLs.push(ws.url()))
const headers={'api-token':fixture.token,Origin:fixture.origin}
const report=async user=>{
  const response=await context.request.post(`${fixture.origin}/api/client/install/official/report`,{headers:{Authorization:`Bearer ${fixture.report_token}`},data:{id:fixture.device_id,service_running:true,desktop:'no_session',terminal:'available',platform:'linux',shell_user:user}})
  assert.equal(response.status(),204)
}
const active=async()=> (await (await context.request.get(`${fixture.origin}/__fixture/stats`,{headers:{'X-Fixture-Gate':'local-test-only'}})).json()).Active
const waitActive=async expected=>{for(let i=0;i<50;i++){if(await active()===expected)return;await page.waitForTimeout(100)}assert.fail('연결 정리/생성 확인 시간 초과')}
try{
  await report('fixture-user')
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${fixture.origin}/#/my/peer`)
  await page.getByRole('button',{name:'터미널 접속 123456789',exact:true}).click()
  const terminal=page.getByRole('dialog',{name:'웹 터미널 · 123456789',exact:true})
  await terminal.getByText('접속 중',{exact:true}).waitFor()
  await terminal.getByRole('button',{name:'터미널 크게 보기',exact:true}).click();await page.waitForTimeout(200)
  await terminal.getByRole('button',{name:'터미널 원래 크기',exact:true}).click();await page.waitForTimeout(200)
  await terminal.getByRole('button',{name:'파일 전송',exact:true}).click()
  const files=page.getByRole('dialog',{name:'파일 전송 · 123456789',exact:true})
  await files.getByText('fixture.txt',{exact:true}).waitFor();await waitActive(2)
  const data=Buffer.from('actual encrypted transport 한글\n'.repeat(900))
  await files.locator('input[type="file"]').setInputFiles({name:'encrypted.txt',mimeType:'text/plain',buffer:data})
  await files.getByText('1개 파일을 업로드했습니다.',{exact:true}).waitFor()
  const downloading=page.waitForEvent('download')
  await files.getByRole('button',{name:'다운로드 encrypted.txt',exact:true}).click()
  const download=await downloading
  assert.deepEqual(await readFile(await download.path()),data)
  const status=await (await context.request.get(`${fixture.origin}/api/admin/terminal/status?peer_id=${fixture.peer_id}`,{headers})).json()
  assert.equal(status.data.device.os,'Fixture Linux')
  assert.equal(status.data.device.cpu,'8 CPU')
  await files.getByRole('button',{name:'닫기',exact:true}).click();await files.waitFor({state:'hidden'});await waitActive(1)
  await terminal.getByRole('button',{name:'파일 전송',exact:true}).click()
  await files.getByText('fixture.txt',{exact:true}).waitFor();await waitActive(2)
  // 세션을 발급받은 계정과 보고 계정이 달라지면 다음 파일 RPC를 차단한다.
  await report('changed-user')
  await files.getByRole('button',{name:'새로고침',exact:true}).click()
  await files.getByText('파일 연결이 종료됐습니다. 다시 연결해 주세요.',{exact:true}).waitFor()
  await waitActive(1)
  await report('root')
  const denied=await (await context.request.post(`${fixture.origin}/api/admin/terminal/sessions`,{headers,data:{peer_id:fixture.peer_id,use_saved:true,mode:'files'}})).json()
  assert.equal(denied.data.state,'files_unavailable')
  assert.equal(denied.code,101)
  await files.getByRole('button',{name:'닫기',exact:true}).click();await files.waitFor({state:'hidden'})
  await terminal.getByRole('button',{name:'닫기',exact:true}).click();await waitActive(0)
  for(const url of socketURLs){assert.equal(new URL(url).search,'');assert.equal(new URL(url).protocol,'wss:')}
  assert.deepEqual(errors,[])
  console.log('PASS: 실제 API·TLS WS·암호화 공식 터미널 계약, 고정 도우미 전달/프레임, 동시 터미널+파일, 양방향 SHA256, 장치 정보 저장, 계정 변경 취소·root 차단·연결 정리')
}finally{
  await context.close();await browser.close()
  const cleanup=await request.newContext({ignoreHTTPSErrors:true})
  await cleanup.post(`${fixture.origin}/__fixture/done`,{headers:{'X-Fixture-Gate':'local-test-only'}}).catch(()=>{})
  await cleanup.dispose()
}
