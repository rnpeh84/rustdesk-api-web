// 사전 상태 보고와 화면 선택을 모의 API로 검증하며 원격 장치에는 접속하지 않는다.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
const require=createRequire(import.meta.url)
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({headless:true,channel:'chrome'})
const context=await browser.newContext({locale:'ko-KR'})
await context.addInitScript(()=>{
  localStorage.setItem('lang','ko');localStorage.setItem('access_token','fixture-local-ui-token')
  window.fixtureOpened=[];window.open=(url)=>{window.fixtureOpened.push(url);return null}
})
const page=await context.newPage(),errors=[],sessions=[]
let admin=false,statusGets=0
let report={state:'unknown',desktop_state:'no_session',terminal_state:'available',reported_at:Math.floor(Date.now()/1000),service_running:true,platform:'linux',shell_user:'fixture-user',desktop_web_enabled:true,has_saved_password:true}
page.on('pageerror',e=>errors.push(e.message))
await page.route('**/api/admin/**',async route=>{
  const path=new URL(route.request().url()).pathname
  let data={list:[],total:0}
  if(path.endsWith('/user/current'))data={id:1,username:'fixture-user',role:admin?'device_admin':'user',permissions:admin?['device.read','device.write']:['client.download'],route_names:admin?['Peer','DeviceGroup','MyPeer']:['MyPeer','MyClient']}
  if(path.endsWith('/config/admin'))data={title:'사전 접속 상태 검증'}
  if(path.endsWith('/config/app'))data={web_client:1}
  if(path.endsWith('/config/server'))data={api_server:'https://api.example.test',id_server:'id.example.test',relay_server:'relay.example.test',key:'fixture-public-key'}
  if(path.endsWith('/peer/list'))data={list:[{row_id:10,id:'123456789',hostname:'검증용 장치',os:'Linux',user_id:admin?2:1,last_online_time:Math.floor(Date.now()/1000)}],total:1}
  if(path.endsWith('/terminal/status')){statusGets++;data={...report,has_saved_password:!admin}}
  if(path.endsWith('/terminal/sessions')){sessions.push(route.request().postDataJSON());data={ticket:'fixture-ticket',websocket_path:'/api/terminal/connect',expires_in:30}}
  await route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data})})
})
await page.routeWebSocket('**/api/terminal/connect',ws=>{setTimeout(()=>ws.send(JSON.stringify({type:'error',state:'auth_required'})),50)})
const origin=process.env.UI_TEST_ORIGIN||'http://127.0.0.1:15173'
const refresh=async patch=>{report={...report,...patch};await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))}
try{
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${origin}/#/my/peer`)
  const entry=page.locator('.device-connect').first()
  await entry.getByRole('button',{name:'터미널 접속 123456789',exact:true}).waitFor()
  assert.equal(sessions.length,0,'상태 조회만으로 장치 인증/셸 시작')
  await refresh({desktop_state:'available',terminal_state:'disabled'})
  const desktop=entry.getByRole('button',{name:'화면 접속 123456789',exact:true})
  await desktop.waitFor();await desktop.click()
  assert.deepEqual(await page.evaluate(()=>window.fixtureOpened),['https://api.example.test/webclient2/#/123456789'])
  assert.equal(sessions.length,0,'화면 접속이 터미널을 시작함')
  await refresh({terminal_state:'available'})
  const choose=entry.getByRole('button',{name:'접속 방식 선택 123456789',exact:true})
  await choose.waitFor();await choose.focus();await choose.press('Enter')
  await page.getByRole('menuitem',{name:'화면 접속',exact:true}).waitFor()
  await page.getByRole('menuitem',{name:'터미널 접속',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'웹 터미널 · 123456789'})
  await dialog.getByText('인증 필요',{exact:true}).waitFor()
  assert.equal(sessions.length,1);assert.equal(sessions[0].use_saved,true)
  await dialog.getByRole('button',{name:'닫기',exact:true}).click();await dialog.waitFor({state:'hidden'})
  for(const patch of [
    {service_running:false},
    {service_running:true,reported_at:Math.floor(Date.now()/1000)-91},
    {reported_at:0},
    {reported_at:Math.floor(Date.now()/1000),desktop_state:'no_session',terminal_state:'disabled'},
    {terminal_state:'unsupported'},
    {terminal_state:'permission_required',platform:'windows'}
  ]){
    await refresh(patch)
    await entry.getByRole('button',{name:'접속 대기 123456789',exact:true}).waitFor()
    assert.equal(await entry.getByRole('button',{name:'접속 대기 123456789',exact:true}).isDisabled(),true)
    assert.equal(sessions.length,1,'비활성 상태에서 연결 시도')
    if(patch.terminal_state==='disabled')await entry.getByText('터미널 비활성 · 장치의 터미널 허용 설정을 확인해 주세요.').waitFor()
    if(patch.terminal_state==='unsupported')await entry.getByText('터미널 미지원 · 장치 OS와 공식 클라이언트 버전을 확인해 주세요.').waitFor()
  }
  await entry.getByText('지정한 Windows 계정으로 장치에 로그인하면 터미널을 사용할 수 있습니다.').waitFor()
  // 실제 주기 갱신으로 별도의 상태 확인 버튼 없이 모드가 바뀌는지 확인한다.
  report={...report,desktop_state:'available',terminal_state:'available',service_running:true,platform:'linux',reported_at:Math.floor(Date.now()/1000)}
  await choose.waitFor({timeout:20000})
  assert.ok(statusGets>6)
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000})
    let target=entry
    if(width<900){await page.getByRole('button',{name:'상세 정보 123456789',exact:true}).click();target=page.locator('.device-detail-drawer .device-connect');await target.waitFor()}
    await target.getByRole('button',{name:'접속 방식 선택 123456789',exact:true}).waitFor()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}px 가로 넘침`)
    if(process.env.UI_TEST_SCREENSHOTS)await (width<900?page.locator('.device-detail-drawer'):target).screenshot({path:join(process.env.UI_TEST_SCREENSHOTS,`device-connect-${width}.png`)})
    if(width<900){await page.keyboard.press('Escape');await page.locator('.device-detail-drawer').waitFor({state:'hidden'})}
  }
  admin=true;await page.setViewportSize({width:1440,height:1000});await page.goto(`${origin}/#/user/peer`);await page.reload()
  await page.locator('.device-connect').first().getByRole('button',{name:'접속 방식 선택 123456789',exact:true}).waitFor()
  assert.equal(sessions.length,1,'관리자 목록 조회가 연결을 시작함')
  assert.deepEqual(errors,[])
  console.log('PASS: 연결 전 GUI/터미널/둘 다 선택, 저장 비밀번호 한 번 클릭, 중지·만료·미보고·비활성·미지원·로그인 필요, 15초 자동 갱신, 사용자·관리자, 키보드와 1440/768/390px')
}finally{await context.close();await browser.close()}
