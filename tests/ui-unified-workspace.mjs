// 로컬 TLS API·기존 xterm·암호화 모의 장치를 실제 ReDe 번들 안에서 연결한다.
import assert from 'node:assert/strict'
import {readFile, mkdir, writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {chromium,request}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const fixture=JSON.parse(await readFile(process.env.RUSTDESK_BROWSER_READY,'utf8'))
const browser=await chromium.launch({headless:true,...(process.env.WEBCL_CHROMIUM?{executablePath:process.env.WEBCL_CHROMIUM}:{channel:'chrome'})})
const context=await browser.newContext({ignoreHTTPSErrors:true,locale:'ko-KR',viewport:{width:1440,height:1000}})
await context.addInitScript(token=>{localStorage.setItem('lang','ko');localStorage.setItem('access_token',token)},fixture.token)
const page=await context.newPage(),errors=[],urls=[],apiResults=[]
page.on('pageerror',error=>errors.push(error.message))
page.on('websocket',socket=>urls.push(socket.url()))
page.on('response',async response=>{const url=new URL(response.url()),path=url.pathname;if(['/api/admin/terminal/workspace','/api/admin/terminal/status'].includes(path)){const body=await response.json().catch(()=>({}));apiResults.push({path,deviceMatches:url.searchParams.get('device_id')===fixture.device_id,status:response.status(),code:body.code,keys:Object.keys(body.data||{}),rowIDType:typeof body.data?.row_id})}})
const gate={'X-Fixture-Gate':'local-test-only'}
const stats=async()=>(await context.request.get(fixture.origin+'/__fixture/stats',{headers:gate})).json()
const output=async(frame,text)=>frame.waitForFunction(text=>document.querySelector('.xterm-screen')?.textContent.includes(text),text)
const artifacts=new URL('../../runtime/unified-workspace/',import.meta.url)
await mkdir(artifacts,{recursive:true})
let complete=false
try {
  const report=await context.request.post(fixture.origin+'/api/client/install/official/report',{headers:{Authorization:'Bearer '+fixture.report_token},data:{id:fixture.device_id,service_running:true,desktop:'no_session',terminal:'available',platform:'linux',shell_user:'fixture-user',resources:{cpu_percent:13,memory_percent:55,disk_percent:92,disk_path:'/'}}})
  assert.equal(report.status(),204)
  const resolved=await context.request.get(fixture.origin+'/api/admin/terminal/workspace?device_id='+encodeURIComponent(fixture.device_id),{headers:{'api-token':fixture.token}})
  assert.equal(resolved.status(),200,'실제 인증 API의 작업창 장치 식별')
  await context.request.post(fixture.origin+'/__fixture/control',{headers:gate,data:{action:'forget-password'}})
  for(let session=0;session<2;session++) {
    if(session===0)await page.goto(fixture.origin+'/webcl/#/'+fixture.device_id+'?mode=terminal');else await page.locator('#terminal-reconnect').click()
    if(session===0){
      await page.locator('#password-form').waitFor({state:'visible'})
      assert.equal(await page.locator('#workspace-mode,.workspace-tabs').count(),0)
      const beforeCancel=(await stats()).Opened
      await page.locator('#password').fill('not-submitted')
      await page.locator('#cancel-password').click()
      await page.locator('#workspace-terminal iframe').waitFor({state:'detached'})
      assert.equal(await page.locator('#password').inputValue(),'')
      assert.equal((await stats()).Opened,beforeCancel)
      await page.locator('#terminal-reconnect').click()
      await page.locator('#password-form').waitFor({state:'visible'})
      await page.locator('#password').fill('wrong-fixture-password')
      await page.locator('#password-form button[type=submit]').click()
      await page.locator('#password-form').waitFor({state:'visible'})
      assert.equal(await page.locator('#password').inputValue(),'')
      await page.locator('#open-log').click()
      await page.screenshot({path:new URL('common-auth.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1')})
      assert.ok((await page.locator('#log-entries').innerText()).includes('장치 인증을 다시 확인하세요.'))
      for(const theme of ['light','dark'])for(const width of [1440,768,390]){
        await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
        const bounds=await page.locator('#password-form').boundingBox()
        assert.ok(bounds && bounds.x>=0 && bounds.x+bounds.width<=width)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        assert.equal(await page.locator('#password').isVisible(),true)
        assert.equal(await page.locator('#password-form button[type=submit]').isEnabled(),true)
        if(width===390)await page.screenshot({path:new URL('auth-'+theme+'-390.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1'),animations:'disabled'})
      }
      await page.setViewportSize({width:1440,height:1000})
      await page.locator('#password').fill(fixture.password)
      await page.locator('#password-form button[type=submit]').click()
    }
    const element=await page.locator('#workspace-terminal iframe').elementHandle()
    const frame=await element.contentFrame()
    await frame.waitForSelector('.xterm-helper-textarea',{state:'attached'})
    await output(frame,'모의 장치 터미널')
    await frame.locator('.xterm-helper-textarea').focus()
    const text='unified'+session+' A!a18'
    await page.keyboard.type(text)
    await output(frame,text)
    const connected=await stats()
    assert.equal(connected.Active,1)
    assert.equal(await page.locator('#remote-input').isDisabled(),true)
    // 별도 탭이나 터미널 제목/종료 chrome 없이 공통 작업영역을 사용한다.
    assert.equal(await page.locator('.workspace-tabs,#workspace-mode').count(),0)
    assert.equal(await frame.locator('.terminal-connect-form').count(),0)
    assert.equal(await page.locator('#password').inputValue(),'')
    assert.equal(await page.locator('.session-title strong').innerText(),'원격 화면')
    assert.equal(await page.locator('#canvas-layout #workspace-terminal').count(),1)
    assert.equal(await frame.locator('.terminal-inline>.el-dialog__header').isVisible(),false)
    assert.equal(await frame.getByRole('button',{name:'연결 종료',exact:true}).count(),0)
    assert.equal(await page.locator('#session-toolbar').isVisible(),true)
    assert.equal(await page.locator('.session-footer').isVisible(),true)
    // 공통 검색/설정/파일 도구를 기존 xterm과 파일 계정 경계에 연결한다.
    await page.locator('#terminal-find').click()
    await frame.getByRole('textbox',{name:'검색할 문자열',exact:true}).fill('unified')
    await frame.getByRole('button',{name:'검색 닫기',exact:true}).click()
    await page.locator('#open-settings').click()
    await frame.getByRole('dialog',{name:'터미널 설정',exact:true}).waitFor()
    await frame.getByRole('button',{name:'취소',exact:true}).click()
    if(session===0){
    await page.locator('#open-files').click()
    await frame.locator('.device-files-panel').waitFor({state:'visible'})
    assert.ok(await frame.locator('.terminal-files').evaluate(node=>node.getBoundingClientRect().right>=innerWidth-2),'파일 패널이 오른쪽에 있지 않습니다.')
    const divider=frame.getByRole('separator',{name:'파일 패널 너비 조절'});await divider.press('ArrowLeft');assert.equal(await divider.getAttribute('aria-valuenow'),'420');await divider.press('ArrowRight');assert.equal(await divider.getAttribute('aria-valuenow'),'400')
    await frame.waitForFunction(()=>document.querySelector('.files-location input')&&!document.querySelector('.files-location input').disabled)
    await frame.locator('.files-workspace').waitFor({state:'visible'})
    const commonFileAppearance=await frame.evaluate(()=>{const panel=document.querySelector('.device-files-panel'),base=panel.getBoundingClientRect();return Object.fromEntries(Object.entries({path:'.files-location',tools:'.files-toolbar',search:'.files-filter',header:'.el-table'}).map(([key,selector])=>[key,panel.querySelector(selector).getBoundingClientRect().top-base.top]))})
    await writeFile(new URL('file-appearance.json',artifacts),JSON.stringify(commonFileAppearance,null,2))
    const beforeLoading=await frame.locator('.file-list-stage').boundingBox()
    await frame.evaluate(()=>{const send=WebSocket.prototype.send;WebSocket.prototype.send=function(value){WebSocket.prototype.send=send;setTimeout(()=>send.call(this,value),900)}})
    await frame.locator('.files-toolbar button').nth(2).click();await frame.locator('.file-list-loading').waitFor({state:'visible'})
    assert.deepEqual(await frame.locator('.file-list-stage').boundingBox(),beforeLoading,'터미널 로딩 중 목록 영역 이동 금지')
    const spinner=await frame.locator('.file-loading-spinner').boundingBox();assert.ok(Math.abs(spinner.x+spinner.width/2-beforeLoading.x-beforeLoading.width/2)<1&&Math.abs(spinner.y+spinner.height/2-beforeLoading.y-beforeLoading.height/2)<1,'터미널 목록 중앙 로딩')
    await page.screenshot({path:new URL('files-loading.png',artifacts).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true})
    await frame.locator('.file-list-loading').waitFor({state:'hidden'});assert.deepEqual(await frame.locator('.file-list-stage').boundingBox(),beforeLoading)

    for(const theme of ['light','dark'])for(const width of [1440,768,390]){
      await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
      await frame.locator('.files-location input').focus();await page.waitForTimeout(150)
      const style=await frame.evaluate(()=>{const panel=document.querySelector('.device-files-panel'),row=panel.querySelector('.el-table__body tr'),cell=row.querySelector('td'),button=panel.querySelector('.files-row-actions button'),input=panel.querySelector('.files-location input'),wrapper=input.closest('.el-input__wrapper');return {row:row.getBoundingClientRect().height,left:parseFloat(getComputedStyle(cell).borderLeftWidth),font:parseFloat(getComputedStyle(cell).fontSize),outline:parseFloat(getComputedStyle(input).outlineWidth),focus:getComputedStyle(wrapper).boxShadow,gap:panel.getBoundingClientRect().right-button.getBoundingClientRect().right}})
      assert.ok(style.row>=37&&style.row<=39&&style.left===0&&style.font===12&&style.outline===0&&style.focus!=='none'&&style.gap>=16,'공통 파일 스타일/포커스: '+JSON.stringify(style))
      if(width===1440)await page.screenshot({path:new URL('files-common-'+theme+'.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1')})
    }
    await page.setViewportSize({width:1440,height:1000})
    const fileInputs=(await stats()).Inputs
    await page.locator('#open-files').focus()
    await page.keyboard.type('not-remote8')
    assert.equal((await stats()).Inputs,fileInputs)
    await page.locator('#open-files').click()
    }
    if(session===1){
      await context.request.post(fixture.origin+'/__fixture/control',{headers:gate,data:{action:'sandbox-files'}})
      await page.locator('#open-files').click()
      await frame.locator('.terminal-files').waitFor({state:'visible'})
      await page.waitForFunction(()=>document.querySelector('#log-entries')?.textContent.includes('안전한 파일 작업 제한'))
      assert.equal(await page.locator('.log-row').filter({hasText:'안전한 파일 작업 제한'}).count(),1)
      assert.equal((await page.locator('#log-entries').innerText()).includes('×2'),false,'파일 연결 실패 중복 알림')
      await frame.locator('.files-recovery').waitFor({state:'visible'})
      assert.equal(await page.locator('#utility-panel').isVisible(),false)
      assert.equal(await page.locator('#status').innerText(),'연결됨')
      await page.locator('#open-files').click()
    }
    assert.equal(await page.locator('#status').innerText(),'연결됨')
    assert.equal(await page.locator('#session-id').isVisible(),true)
    assert.deepEqual(await page.locator('.resource-stat b').allTextContents(),['13%','55%','92%']);assert.equal(await page.locator('.resource-stat.is-high').count(),1)
    if(await page.locator('#session-log').isHidden())await page.locator('#open-log').click()
    await page.locator('#log-entries').focus()
    const beforeLogInput=(await stats()).Inputs;await page.keyboard.type('log-only8');assert.equal((await stats()).Inputs,beforeLogInput)
    await page.waitForFunction(()=>document.querySelector('#log-entries')?.innerText.includes('장치 연결됨'))
    if(session===0){
      await page.locator('#terminal-copy').click()
      await page.locator('#open-settings').click();await frame.getByRole('dialog',{name:'터미널 설정',exact:true}).waitFor()
      await frame.getByRole('button',{name:'저장',exact:true}).click()
      await page.waitForFunction(()=>document.querySelector('#log-entries')?.textContent.includes('설정'))
      const popup=await frame.locator('.notification-dock.has-new').boundingBox();assert.ok(popup.width<=420&&popup.width>250,'알림은 작은 팝업이어야 합니다.');assert.ok(popup.x>500,'알림 팝업은 오른쪽에 있어야 합니다.')
      await page.screenshot({path:new URL('notification-popup.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1')})
      await page.waitForTimeout(5500);assert.ok((await page.locator('#log-entries').innerText()).includes('설정'),'일시 알림 종료 후 작업 로그 유지')
    }
    const log=await page.locator('#log-entries').innerText()
    assert.ok(log.includes('장치 연결됨'))
    for(const secret of [fixture.password,fixture.token,text,'wrong-fixture-password'])assert.equal(log.includes(secret),false)
    // 같은 출처여도 현재 자식 프레임이 아닌 발신자는 인증 상태를 바꾸지 못한다.
    await page.evaluate(device=>window.postMessage({type:'rede-terminal-auth-ready',device},location.origin),fixture.device_id)
    assert.equal(await page.locator('#password-form').isHidden(),true)
    if(session===0) {
      for(const theme of ['light','dark'])for(const width of [1440,768,390]) {
        await page.setViewportSize({width,height:900})
        await page.evaluate(theme=>{document.documentElement.dataset.theme=theme},theme)
        await frame.waitForFunction(theme=>document.documentElement.classList.contains('dark')===(theme==='dark'),theme)
        await page.waitForTimeout(150)
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        assert.ok(await page.locator('.session-title strong').evaluate(node=>node.getBoundingClientRect().height<=20),'공통 제목이 세로로 접혔습니다.')
        assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
        const resourceLine=await page.locator('.workspace-summary').boundingBox();assert.ok(resourceLine.height<=24);assert.equal(await page.locator('.resource-stat').count(),3)
        assert.ok(await page.locator('.session-footer').evaluate(node=>node.scrollWidth<=node.clientWidth),'하단 한 줄 상태바 overflow')
        assert.ok(await frame.locator('.xterm-screen').evaluate(node=>node.getBoundingClientRect().height>100))
        const scrollSpace=await frame.evaluate(()=>{const text=document.querySelector('.xterm-screen').getBoundingClientRect(),viewport=document.querySelector('.xterm-viewport').getBoundingClientRect(),host=document.querySelector('.terminal-screen').getBoundingClientRect();return {right:viewport.right-text.right,bottom:host.bottom-text.bottom,inside:viewport.right<=host.right}})
        assert.ok(scrollSpace.right>=19&&scrollSpace.bottom>=5&&scrollSpace.inside,'스크롤바가 터미널 마지막 열/행을 가립니다: '+JSON.stringify(scrollSpace))
        await page.screenshot({path:new URL(theme+'-'+width+'.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1')})
      }
      await page.setViewportSize({width:1440,height:1000})
      await page.locator('#clear-log').click();assert.equal(await page.locator('.log-row').count(),0)
      await page.locator('#close-log').click();assert.equal(await page.locator('#open-log').evaluate(node=>node===document.activeElement),true)
    }
    await page.locator('#disconnect').click();await page.locator('#disconnect').click()
    await page.waitForFunction(()=>!document.querySelector('#workspace-terminal iframe'))
    for(let i=0;i<40&&(await stats()).Active;i++)await page.waitForTimeout(100)
    assert.equal((await stats()).Active,0)
  }
  // 자식 프레임 출처를 흉내 낸 부모 메시지는 상태를 변경하지 못한다.
  await page.evaluate(()=>window.postMessage({type:'rede-terminal-state',device:'123',state:'ready'},location.origin))
  assert.notEqual(await page.locator('#status').innerText(),'터미널 연결됨')
  const anonymous=await browser.newContext({ignoreHTTPSErrors:true})
  const loginPage=await anonymous.newPage()
  await loginPage.goto(fixture.origin+'/webcl/#/'+fixture.device_id+'?mode=terminal')
  await loginPage.waitForFunction(()=>document.querySelector('#workspace-terminal iframe')?.contentWindow?.location.hash.startsWith('#/login'))
  await loginPage.locator('#disconnect').click();await loginPage.locator('#disconnect').click()
  await loginPage.locator('#workspace-terminal iframe').waitFor({state:'detached',timeout:2000})
  const invalidPage=await anonymous.newPage()
  invalidPage.on('pageerror',error=>errors.push(error.message))
  await invalidPage.goto(fixture.origin+'/webcl/#/bad%ZZ?mode=terminal')
  assert.equal(await invalidPage.locator('#device').inputValue(),'')
  assert.equal(await invalidPage.locator('#workspace-terminal iframe').count(),0)
  await anonymous.close()
  assert.deepEqual(errors,[])
  for(const url of urls){assert.equal(new URL(url).protocol,'wss:');assert.equal(new URL(url).search,'')}
  const result={scope:'로컬 TLS API·실제 두 웹 번들·기존 xterm·암호화 모의 장치, 운영/실제 OS 아님',sessions:2,requestMode:true,singleSurface:true,sharedToolbar:true,immutableRequest:true,sharedAuthentication:true,passwordRetry:true,passwordCancel:true,sharedLog:true,logSecretExclusion:true,operationNotifications:true,sandboxFailureKeepsTerminalWithoutNativeFallback:true,filePanelRight:true,inputIsolation:true,terminalInputOutput:true,resize:true,disconnectCleanup:true,loginPageClose:true,responsiveThemes:6,authenticationThemes:6,pageErrors:errors}
  await writeFile(new URL('result.json',artifacts),JSON.stringify(result,null,2))
  console.log(JSON.stringify(result));complete=true
} finally {
  if(!complete){console.error(JSON.stringify({errors,apiResults}));await page.screenshot({path:new URL('failure.png',artifacts).pathname.replace(/^\/([A-Z]:)/,'$1')}).catch(()=>{})}
  await context.close();await browser.close()
  const cleanup=await request.newContext({ignoreHTTPSErrors:true})
  await cleanup.post(fixture.origin+'/__fixture/done',{headers:gate}).catch(()=>{})
  await cleanup.dispose()
}
